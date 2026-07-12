# -*- coding: utf-8 -*-
"""
Notification Service
====================
Service layer for notification management. Controllers and other services
call this; they never query the notification model directly.
Designed with future WebSocket push in mind.
"""
import logging

_logger = logging.getLogger(__name__)


class NotificationService:
    """Stateless helper for notification CRUD and queries."""

    def __init__(self, env):
        self.env = env

    # ------------------------------------------------------------------
    # Core API
    # ------------------------------------------------------------------
    def send_notification(
        self,
        recipient_id,
        title,
        category='info',
        description='',
        priority='medium',
        department_id=False,
        action_button='View',
        action_url='',
        related_activity_id=False,
    ):
        """Create a notification for a specific user.

        Returns:
            af.notification recordset
        """
        vals = {
            'recipient_id': recipient_id,
            'title': title,
            'category': category,
            'description': description,
            'priority': priority,
            'department_id': department_id,
            'action_button': action_button,
            'action_url': action_url,
            'related_activity_id': related_activity_id,
        }
        try:
            return self.env['af.notification'].sudo().create(vals)
        except Exception as exc:
            _logger.exception("Failed to create notification: %s", exc)
            return self.env['af.notification']

    def send_bulk_notifications(
        self,
        recipient_ids,
        title,
        category='info',
        description='',
        priority='medium',
        department_id=False,
        action_button='View',
        action_url='',
        related_activity_id=False,
    ):
        """Create notifications for multiple users at once."""
        vals_list = [
            {
                'recipient_id': uid,
                'title': title,
                'category': category,
                'description': description,
                'priority': priority,
                'department_id': department_id,
                'action_button': action_button,
                'action_url': action_url,
                'related_activity_id': related_activity_id,
            }
            for uid in recipient_ids
        ]
        try:
            return self.env['af.notification'].sudo().create(vals_list)
        except Exception as exc:
            _logger.exception("Failed to create bulk notifications: %s", exc)
            return self.env['af.notification']

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------
    def get_notifications(self, user_id, filters=None, page=1, limit=20):
        """Return paginated notifications for a user."""
        domain = [('recipient_id', '=', user_id)]
        filters = filters or {}

        if filters.get('status'):
            domain.append(('status', '=', filters['status']))
        if filters.get('category'):
            domain.append(('category', '=', filters['category']))
        if filters.get('priority'):
            domain.append(('priority', '=', filters['priority']))
        if filters.get('keyword'):
            keyword = filters['keyword']
            domain.append('|')
            domain.append(('title', 'ilike', keyword))
            domain.append(('description', 'ilike', keyword))

        Notification = self.env['af.notification']
        total = Notification.search_count(domain)
        offset = (page - 1) * limit
        records = Notification.search(domain, limit=limit, offset=offset)

        pages = (total + limit - 1) // limit if limit else 1

        return {
            'records': [{
                'id': r.id,
                'name': r.name,
                'title': r.title,
                'description': r.description or '',
                'priority': r.priority,
                'category': r.category,
                'status': r.status,
                'created_time': str(r.created_time) if r.created_time else '',
                'read_time': str(r.read_time) if r.read_time else '',
                'action_button': r.action_button or 'View',
                'action_url': r.action_url or '',
            } for r in records],
            'total': total,
            'page': page,
            'pages': pages,
        }

    def get_unread_count(self, user_id):
        """Return unread notification count for a user."""
        return self.env['af.notification'].search_count([
            ('recipient_id', '=', user_id),
            ('status', '=', 'unread'),
        ])

    def get_critical_count(self, user_id):
        """Return critical unread notification count."""
        return self.env['af.notification'].search_count([
            ('recipient_id', '=', user_id),
            ('status', '=', 'unread'),
            ('priority', '=', 'critical'),
        ])

    def get_counts(self, user_id):
        """Return all notification counts."""
        return {
            'unread': self.get_unread_count(user_id),
            'critical': self.get_critical_count(user_id),
            'total': self.env['af.notification'].search_count([
                ('recipient_id', '=', user_id),
                ('status', '!=', 'archived'),
            ]),
        }
