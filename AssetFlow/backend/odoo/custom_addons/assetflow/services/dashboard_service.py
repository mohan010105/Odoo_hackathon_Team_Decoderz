# -*- coding: utf-8 -*-
"""
Dashboard Service
=================
Encapsulates all KPI and aggregate queries used by the dashboard.
Controllers and views call this service; they never build queries directly.
"""
import logging

_logger = logging.getLogger(__name__)


class DashboardService:
    """Stateless helper that queries the DB and returns dashboard KPIs."""

    def __init__(self, env):
        self.env = env

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def get_kpis(self) -> dict:
        """Return top-level KPI counts for the dashboard."""
        Asset = self.env['af.asset']
        unread_notifications = self.env['af.notification'].search_count([
            ('recipient_id', '=', self.env.user.id),
            ('status', '=', 'unread'),
        ])
        pending_approvals = self.env['af.approval'].search_count([
            ('status', '=', 'pending'),
        ])
        critical_alerts = self.env['af.system.alert'].search_count([
            ('status', '=', 'active'),
            ('severity', '=', 'critical'),
        ])
        unread_activities = self.env['af.activity'].search_count([
            ('status', '=', 'unread'),
        ])
        today_activities = self.env['af.activity'].search_count([
            ('date_group', '=', 'Today'),
        ])

        return {
            'total_assets': Asset.search_count([]),
            'available': Asset.search_count([('status', '=', 'available')]),
            'allocated': Asset.search_count([('status', '=', 'allocated')]),
            'under_maintenance': Asset.search_count([('status', '=', 'under_maintenance')]),
            'disposed': Asset.search_count([('status', '=', 'disposed')]),
            'total_departments': self.env['af.department'].search_count([]),
            'active_departments': self.env['af.department'].search_count([
                ('status', '=', 'active'),
            ]),
            'total_employees': self.env['af.employee'].search_count([]),
            'active_employees': self.env['af.employee'].search_count([
                ('status', '=', 'active'),
            ]),
            'unread_notifications': unread_notifications,
            'pending_approvals': pending_approvals,
            'critical_alerts': critical_alerts,
            'unread_activities': unread_activities,
            'today_activities': today_activities,
        }

    def get_assets_by_category(self) -> list[dict]:
        """Return asset counts grouped by category."""
        categories = self.env['af.asset.category'].search([])
        result = []
        for cat in categories:
            count = self.env['af.asset'].search_count([
                ('category_id', '=', cat.id),
            ])
            result.append({'category': cat.name, 'count': count})
        return sorted(result, key=lambda r: r['count'], reverse=True)

    def get_assets_by_department(self) -> list[dict]:
        """Return asset counts grouped by department."""
        departments = self.env['af.department'].search([])
        result = []
        for dept in departments:
            count = self.env['af.asset'].search_count([
                ('department_id', '=', dept.id),
            ])
            result.append({'department': dept.name, 'count': count})
        return sorted(result, key=lambda r: r['count'], reverse=True)

    def get_assets_by_condition(self) -> list[dict]:
        """Return asset counts grouped by condition."""
        condition_map = {
            'excellent': 'Excellent',
            'good': 'Good',
            'fair': 'Fair',
            'poor': 'Poor',
        }
        Asset = self.env['af.asset']
        return [
            {
                'condition': label,
                'count': Asset.search_count([('condition', '=', key)]),
            }
            for key, label in condition_map.items()
        ]
