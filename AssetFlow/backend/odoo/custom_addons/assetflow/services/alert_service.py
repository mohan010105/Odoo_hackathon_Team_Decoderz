# -*- coding: utf-8 -*-
"""
Alert Service
=============
Service layer for system alert management and scanning.
Provides methods for detecting anomalies and managing alert lifecycle.
"""
import logging

_logger = logging.getLogger(__name__)


class AlertService:
    """Stateless helper for system alert operations."""

    def __init__(self, env):
        self.env = env

    # ------------------------------------------------------------------
    # Scan Operations (delegated to model)
    # ------------------------------------------------------------------
    def scan_all(self):
        """Run all alert scanners. Called by cron job."""
        return self.env['af.system.alert'].run_all_scans()

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------
    def get_active_alerts(self, filters=None, page=1, limit=20):
        """Return paginated active alerts."""
        domain = [('status', '!=', 'resolved')]
        filters = filters or {}

        if filters.get('status'):
            domain = [('status', '=', filters['status'])]
        if filters.get('alert_type'):
            domain.append(('alert_type', '=', filters['alert_type']))
        if filters.get('severity'):
            domain.append(('severity', '=', filters['severity']))

        Alert = self.env['af.system.alert']
        total = Alert.search_count(domain)
        offset = (page - 1) * limit
        records = Alert.search(domain, limit=limit, offset=offset)

        pages = (total + limit - 1) // limit if limit else 1

        return {
            'records': [{
                'id': r.id,
                'name': r.name,
                'alert_type': r.alert_type,
                'title': r.title,
                'description': r.description or '',
                'severity': r.severity,
                'status': r.status,
                'asset': r.asset_id.display_name if r.asset_id else '',
                'employee': r.employee_id.name if r.employee_id else '',
                'department': r.department_id.name if r.department_id else '',
                'detected_at': str(r.detected_at) if r.detected_at else '',
            } for r in records],
            'total': total,
            'page': page,
            'pages': pages,
        }

    def get_critical_count(self):
        """Return count of active critical alerts."""
        return self.env['af.system.alert'].search_count([
            ('status', '=', 'active'),
            ('severity', '=', 'critical'),
        ])

    def get_active_count(self):
        """Return count of all active alerts."""
        return self.env['af.system.alert'].search_count([
            ('status', '=', 'active'),
        ])
```
