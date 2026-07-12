#!/usr/bin/env bash
# =============================================================================
# AssetFlow – Odoo 18 Development Server
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ODOO_SRC="$PROJECT_ROOT/backend/odoo/odoo-src"
CUSTOM_ADDONS="$PROJECT_ROOT/backend/odoo/custom_addons"
CONFIG_FILE="$PROJECT_ROOT/backend/config/odoo.conf"
# Load env variables and resolve DB configurations
export PROJECT_ROOT
env_file="$PROJECT_ROOT/.env"
if [ -f "$env_file" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
        # Ignore comments and empty lines
        if [[ ! "$line" =~ ^# ]] && [[ "$line" =~ = ]]; then
            key=$(echo "$line" | cut -d'=' -f1 | xargs)
            val=$(echo "$line" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
            export "$key"="$val"
        fi
    done < "$env_file"
fi

# Resolve DB configurations via python helper
RESOLVED_ENV=$(python3.11 - <<'PYEOF'
import os, urllib.parse
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
port_http = os.environ.get('PORT', '8069')

print(f"PORT={port_http}")
print(f"PGHOST={host}")
print(f"PGPORT={port}")
print(f"PGDATABASE={name}")
print(f"PGUSER={user}")
print(f"PGPASSWORD={pw}")
PYEOF
)

# Parse output
while IFS= read -r line; do
    if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
        key="${BASH_REMATCH[1]}"
        val="${BASH_REMATCH[2]}"
        export "$key"="$val"
    fi
done <<< "$RESOLVED_ENV"

PORT="${PORT:-8069}"
PGDATABASE="${PGDATABASE:-assetflow_odoo}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-}"
PGPASSWORD="${PGPASSWORD:-}"

ssl_mode="prefer"
if [[ "$PGHOST" =~ supabase ]] || { [ "$PGHOST" != "localhost" ] && [ "$PGHOST" != "127.0.0.1" ] && [ -n "$PGHOST" ]; }; then
    ssl_mode="require"
    export PGSSLMODE="require"
    echo "[setup] Remote/Supabase database detected. Enabling SSL connection."
fi

echo "=============================================="
echo "  AssetFlow ERP – Odoo 18 Dev Server"
echo "  Port    : $PORT"
echo "  DB      : $PGDATABASE"
echo "  Host    : $PGHOST"
echo "  SSL     : $ssl_mode"
echo "=============================================="

# Ensure the database exists
echo "[setup] Ensuring database '$PGDATABASE' exists..."
python3.11 - <<'PYEOF'
import os, psycopg2
db_name = os.environ.get("PGDATABASE", "assetflow_odoo")
host = os.environ.get("PGHOST", "localhost")
is_supabase = "supabase" in host or (host != "localhost" and host != "127.0.0.1" and host != "")

conn_params = {
    "host":     host,
    "port":     int(os.environ.get("PGPORT", 5432)),
    "user":     os.environ.get("PGUSER", ""),
    "password": os.environ.get("PGPASSWORD", ""),
}

if is_supabase:
    try:
        conn = psycopg2.connect(dbname=db_name, **conn_params)
        conn.close()
        print(f"[setup] Database '{db_name}' verified.")
    except Exception as e:
        print(f"[setup] Failed to connect to database: {e}")
        os._exit(1)
else:
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
    try:
        conn = psycopg2.connect(dbname="postgres", **conn_params)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
        if not cur.fetchone():
            cur.execute(f'CREATE DATABASE "{db_name}"')
            print(f"[setup] Database '{db_name}' created.")
        else:
            print(f"[setup] Database '{db_name}' already exists.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[setup] Failed to check/create database: {e}")
        os._exit(1)
PYEOF

# Build addons path
ADDONS_PATH="$ODOO_SRC/addons,$CUSTOM_ADDONS"

echo "[start] Launching Odoo server..."
# Detect whether the assetflow module is already installed
MODULE_INSTALLED=$(python3.11 - <<'PYEOF'
import os, psycopg2
try:
    conn = psycopg2.connect(
        host=os.environ.get("PGHOST", "localhost"),
        port=int(os.environ.get("PGPORT", 5432)),
        user=os.environ.get("PGUSER", ""),
        password=os.environ.get("PGPASSWORD", ""),
        dbname=os.environ.get("PGDATABASE", "assetflow_odoo"),
    )
    cur = conn.cursor()
    cur.execute("SELECT state FROM ir_module_module WHERE name = 'assetflow'")
    row = cur.fetchone()
    print("installed" if row and row[0] == "installed" else "new")
    cur.close(); conn.close()
except Exception:
    print("new")
PYEOF
)

if [ "$MODULE_INSTALLED" = "installed" ]; then
    ODOO_ACTION="--update=assetflow"
    echo "[start] Module already installed — running with --update."
else
    ODOO_ACTION="--init=assetflow"
    echo "[start] First run — running with --init and demo data."
fi

exec python3.11 "$ODOO_SRC/odoo-bin" \
    --addons-path="$ADDONS_PATH" \
    --http-port="$PORT" \
    --db_host="$PGHOST" \
    --db_port="$PGPORT" \
    --db_user="$PGUSER" \
    --db_password="$PGPASSWORD" \
    --database="$PGDATABASE" \
    --db_sslmode="$ssl_mode" \
    $ODOO_ACTION \
    --without-demo=False \
    --log-level=info \
    "$@"
