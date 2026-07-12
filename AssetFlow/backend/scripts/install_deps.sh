#!/usr/bin/env bash
# =============================================================================
# AssetFlow – Install / verify all Python dependencies
# =============================================================================
set -euo pipefail
ODOO_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../odoo/odoo-src" && pwd)"
echo "[deps] Installing Odoo 18 Python dependencies..."
python3.11 -m pip install -e "$ODOO_SRC" --no-deps -q
python3.11 -m pip install \
  Babel lxml lxml-html-clean Pillow passlib psutil psycopg2-binary \
  python-dateutil pytz requests werkzeug openpyxl PyPDF2 python-stdnum \
  num2words MarkupSafe Jinja2 decorator docutils chardet cryptography \
  polib libsass geoip2 freezegun cbor2 ofxparse html2text reportlab \
  asn1crypto pyopenssl rjsmin xlsxwriter zeep gevent greenlet pyusb \
  vobject python-barcode qrcode python-ldap -q
echo "[deps] All dependencies installed."
