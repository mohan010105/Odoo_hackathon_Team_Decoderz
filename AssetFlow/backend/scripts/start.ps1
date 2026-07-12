# PowerShell script to start Odoo on Windows, managing PostgreSQL checks and auto-update

$PORT = if ($env:PORT) { $env:PORT } else { "8069" }
$PGDATABASE = if ($env:PGDATABASE) { $env:PGDATABASE } else { "assetflow_odoo" }
$PGHOST = if ($env:PGHOST) { $env:PGHOST } else { "localhost" }
$PGPORT = if ($env:PGPORT) { $env:PGPORT } else { "5432" }
$PGUSER = if ($env:PGUSER) { $env:PGUSER } else { "" }
$PGPASSWORD = if ($env:PGPASSWORD) { $env:PGPASSWORD } else { "" }

Write-Host "=============================================="
Write-Host "  AssetFlow ERP – Odoo 18 Windows Dev Server"
Write-Host "  Port    : $PORT"
Write-Host "  DB      : $PGDATABASE"
Write-Host "=============================================="

# Ensure the database exists
Write-Host "[setup] Ensuring database '$PGDATABASE' exists..."

$dbCheckScript = @"
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
db_name = '$PGDATABASE'
conn_params = {
    'host': '$PGHOST',
    'port': int('$PGPORT'),
    'user': '$PGUSER',
    'password': '$PGPASSWORD',
    'dbname': 'postgres',
}
try:
    conn = psycopg2.connect(**conn_params)
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

$PROJECT_ROOT = Resolve-Path "$PSScriptRoot/../.."
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
    $action `
    --without-demo=False `
    --log-level=info
