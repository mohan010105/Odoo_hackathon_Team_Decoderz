# -*- coding: utf-8 -*-
{
    'name': 'AssetFlow - Enterprise Asset Management',
    'version': '18.0.1.0.0',
    'category': 'Asset Management',
    'summary': 'Enterprise Asset & Resource Management System',
    'description': """
AssetFlow ERP - Phase 1
=======================
Enterprise Asset & Resource Management System built on Odoo 18 Community.

Features:
- Department management with hierarchical structure
- Employee management with role-based access
- Asset category taxonomy with warranty tracking
- Full asset lifecycle management (Active → Disposed)
- Soft delete (archive) for all entities
- Auto-generated asset tags (AF-000001)
- Auto-generated employee IDs (EMP-00001)
- Operational Dashboard with KPI metrics
- Role-based security (Admin, Asset Manager, Employee)
    """,
    'author': 'AssetFlow',
    'website': 'https://assetflow.io',
    'depends': ['base', 'mail'],
    'data': [
        'security/groups.xml',
        'security/ir.model.access.csv',
        'security/record_rules.xml',
        'data/sequences.xml',
        'data/cron.xml',
        'views/menu.xml',
        'views/department_views.xml',
        'views/employee_views.xml',
        'views/asset_category_views.xml',
        'views/asset_views.xml',
        'views/asset_allocation_views.xml',
        'views/transfer_request_views.xml',
        'views/allocation_history_views.xml',
        'views/activity_views.xml',
        'views/notification_views.xml',
        'views/approval_views.xml',
        'views/system_alert_views.xml',
        'views/dashboard_views.xml',
    ],
    'demo': [
        'demo/demo_data.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'assetflow/static/src/css/assetflow.css',
        ],
    },
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
    'images': ['static/src/img/main_screenshot.png'],
}
