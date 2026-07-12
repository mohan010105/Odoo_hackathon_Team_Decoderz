# PowerShell script to start Odoo on Windows, managing PostgreSQL checks and auto-update

$PROJECT_ROOT = Resolve-Path "$PSScriptRoot/../.."
$envResolveScript = @"
import os, urllib.parse
env_file = os.path.abspath(os.path.join(r'$PROJECT_ROOT', '.env'))
if os.path.exists(env_file):
    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                parts = line.split('=', 1)
                if len(parts) == 2:
                    k = parts[0].strip()
                    v = parts[1].strip().strip('"').strip("'")
                    os.environ[k] = v

host = os.environ.get('SUPABASE_DB_HOST')
port = os.environ.get('SUPABASE_DB_PORT')
name = os.environ.get('SUPABASE_DB_NAME')
user = os.environ.get('SUPABASE_DB_USER')
pw = os.environ.get('SUPABASE_DB_PASSWORD')

if not host and os.environ.get('DATABASE_URL'):
    try:
        parsed = urllib.parse.urlparse(os.environ.get('DATABASE_URL'))
        host = parsed.hostname
        port = str(parsed.port) if parsed.port else '5432'
        name = parsed.path.lstrip('/')
        user = parsed.username
        pw = parsed.password
    except Exception:
        pass

host = host or os.environ.get('PGHOST', 'localhost')
port = port or os.environ.get('PGPORT', '5432')
name = name or os.environ.get('PGDATABASE', 'assetflow_odoo')
user = user or os.environ.get('PGUSER', '')
pw = pw or os.environ.get('PGPASSWORD', '')

print(f"PORT={os.environ.get('PORT', '8069')}")
print(f"PGHOST={host}")
print(f"PGPORT={port}")
print(f"PGDATABASE={name}")
print(f"PGUSER={user}")
print(f"PGPASSWORD={pw}")
"@

$envOutputs = python -c $envResolveScript
$PORT = "8069"
$PGDATABASE = "assetflow_odoo"
$PGHOST = "localhost"
$PGPORT = "5432"
$PGUSER = ""
$PGPASSWORD = ""

$envOutputs | ForEach-Object {
    if ($_ -match "^([^=]+)=(.*)$") {
        $key = $Matches[1]
        $val = $Matches[2]
        $env:$key = $val
        if ($key -eq "PORT") { $PORT = $val }
        if ($key -eq "PGHOST") { $PGHOST = $val }
        if ($key -eq "PGPORT") { $PGPORT = $val }
        if ($key -eq "PGDATABASE") { $PGDATABASE = $val }
        if ($key -eq "PGUSER") { $PGUSER = $val }
        if ($key -eq "PGPASSWORD") { $PGPASSWORD = $val }
    }
}

$sslMode = "prefer"
if ($PGHOST -like "*supabase*" -or ($PGHOST -ne "localhost" -and $PGHOST -ne "127.0.0.1" -and $PGHOST -ne "")) {
    $sslMode = "require"
    $env:PGSSLMODE = "require"
    Write-Host "[setup] Remote/Supabase database detected. Enabling SSL connection."
}

Write-Host "=============================================="
Write-Host "  AssetFlow ERP – Odoo 18 Windows Dev Server"
Write-Host "  Port    : $PORT"
Write-Host "  DB      : $PGDATABASE"
Write-Host "  Host    : $PGHOST"
Write-Host "  SSL     : $sslMode"
Write-Host "=============================================="

# Ensure the database exists
Write-Host "[setup] Ensuring database '$PGDATABASE' exists..."

$dbCheckScript = @"
import psycopg2
import os
db_name = '$PGDATABASE'
host = '$PGHOST'
is_supabase = 'supabase' in host or (host != 'localhost' and host != '127.0.0.1' and host != '')

conn_params = {
    'host': host,
    'port': int('$PGPORT'),
    'user': '$PGUSER',
    'password': '$PGPASSWORD',
}

if is_supabase:
    try:
        conn = psycopg2.connect(dbname=db_name, **conn_params)
        conn.close()
        print('exists')
    except Exception as e:
        print('error:', e)
else:
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
    try:
        conn = psycopg2.connect(dbname='postgres', **conn_params)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        cur.execute('SELECT 1 FROM pg_database WHERE datname = %s', (db_name,))
        if not cur.fetchone():
            cur.execute(f'CREATE DATABASE "{db_name}"')
            print('created')
        else:
            print('exists')
        cur.close()
        conn.close()
    except Exception as e:
        print('error:', e)
"@

$dbStatus = python -c $dbCheckScript
if ($dbStatus -like "*error*") {
    Write-Error "[setup] Failed to connect/create database: $dbStatus"
    exit 1
} else {
    Write-Host "[setup] Database check status: $dbStatus"
}

# Detect whether the assetflow module is already installed
$moduleCheckScript = @"
import psycopg2
try:
    conn = psycopg2.connect(
        host='$PGHOST',
        port=int('$PGPORT'),
        user='$PGUSER',
        password='$PGPASSWORD',
        dbname='$PGDATABASE',
    )
    cur = conn.cursor()
    cur.execute("SELECT state FROM ir_module_module WHERE name = 'assetflow'")
    row = cur.fetchone()
    print('installed' if row and row[0] == 'installed' else 'new')
    cur.close(); conn.close()
except Exception:
    print('new')
"@

$moduleStatus = python -c $moduleCheckScript
$action = "--update=assetflow"
if ($moduleStatus -trim() -eq "new") {
    $action = "--init=assetflow"
    Write-Host "[start] First run — running with --init and demo data."
} else {
    Write-Host "[start] Module already installed — running with --update."
}

$ODOO_SRC = "$PROJECT_ROOT/backend/odoo/odoo-src"
$CUSTOM_ADDONS = "$PROJECT_ROOT/backend/odoo/custom_addons"
$ADDONS_PATH = "$ODOO_SRC/addons,$CUSTOM_ADDONS"

Write-Host "[start] Launching Odoo server..."

python "$ODOO_SRC/odoo-bin" `
    --addons-path="$ADDONS_PATH" `
    --http-port="$PORT" `
    --db_host="$PGHOST" `
    --db_port="$PGPORT" `
    --db_user="$PGUSER" `
    --db_password="$PGPASSWORD" `
    --database="$PGDATABASE" `
    --db_sslmode="$sslMode" `
    $action `
    --without-demo=False `
    --log-level=info
