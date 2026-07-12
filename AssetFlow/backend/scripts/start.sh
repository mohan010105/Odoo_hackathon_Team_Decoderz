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
PORT="${PORT:-8069}"

echo "=============================================="
echo "  AssetFlow ERP – Odoo 18 Dev Server"
echo "  Port    : $PORT"
echo "  DB      : ${PGDATABASE:-assetflow_odoo}"
echo "=============================================="

# Ensure the database exists
echo "[setup] Ensuring database '${PGDATABASE:-assetflow_odoo}' exists..."
python3.11 - <<'PYEOF'
import os, psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
db_name = os.environ.get("PGDATABASE", "assetflow_odoo")
conn_params = {
    "host":     os.environ.get("PGHOST", "localhost"),
    "port":     int(os.environ.get("PGPORT", 5432)),
    "user":     os.environ.get("PGUSER", ""),
    "password": os.environ.get("PGPASSWORD", ""),
    "dbname":   "postgres",
}
conn = psycopg2.connect(**conn_params)
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
    --db_host="${PGHOST:-localhost}" \
    --db_port="${PGPORT:-5432}" \
    --db_user="${PGUSER}" \
    --db_password="${PGPASSWORD}" \
    --database="${PGDATABASE:-assetflow_odoo}" \
    $ODOO_ACTION \
    --without-demo=False \
    --log-level=info \
    "$@"
