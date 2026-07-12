# PowerShell script to install Python dependencies for Odoo on Windows

Write-Host "[deps] Installing Odoo 18 Python dependencies..."
python -m pip install -e "$PSScriptRoot/../odoo/odoo-src" --no-deps -q
python -m pip install `
  Babel lxml lxml-html-clean Pillow passlib psutil psycopg2-binary `
  python-dateutil pytz requests werkzeug openpyxl PyPDF2 python-stdnum `
  num2words MarkupSafe Jinja2 decorator docutils chardet cryptography `
  polib libsass geoip2 freezegun cbor2 ofxparse html2text reportlab `
  asn1crypto pyopenssl rjsmin xlsxwriter zeep gevent greenlet pyusb `
  vobject python-barcode qrcode -q

Write-Host "[deps] Trying to install python-ldap (optional)..."
try {
  python -m pip install python-ldap -q
} catch {
  Write-Warning "[deps] python-ldap installation failed. This is typical on Windows and non-blocking."
}

Write-Host "[deps] All dependencies installed."
