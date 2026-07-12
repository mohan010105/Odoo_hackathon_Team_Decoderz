# -*- coding: utf-8 -*-
"""
Activity Service
================
Central service for creating activities and generating associated notifications.
All modules should call this service to log activities instead of directly
creating af.activity records. This ensures consistent behavior and provides
a single dispatch point for future WebSocket integration.
"""
import json
import logging
from odoo import fields

_logger = logging.getLogger(__name__)


class ActivityService:
    """Stateless service for activity logging and timeline queries."""

    def __init__(self, env):
        self.env = env

    # ------------------------------------------------------------------
    # Core API
    # ------------------------------------------------------------------
    def log_activity(
        self,
        activity_type,
        module,
        title,
        description='',
        performed_by=None,
        department_id=False,
        asset_id=False,
        employee_id=False,
        priority='medium',
        related_record_id=False,
        related_model='',
        action_url='',
        metadata=None,
        notify_users=None,
        notification_category='info',
    ):
        """Create an activity record and optionally generate notifications.

        Args:
            activity_type: One of ACTIVITY_TYPES selection keys
            module: One of ACTIVITY_MODULES selection keys
            title: Human-readable title
            description: Detailed description
            performed_by: res.users record id (defaults to current user)
            department_id: af.department id
            asset_id: af.asset id
            employee_id: af.employee id
            priority: low/medium/high/critical
            related_record_id: ID of the source record
            related_model: Technical model name
            action_url: Deep link URL
            metadata: dict of extra data (will be JSON serialized)
            notify_users: list of res.users ids to notify
            notification_category: category for generated notifications

        Returns:
            af.activity recordset
        """
        if performed_by is None:
            performed_by = self.env.user.id

        vals = {
            'activity_type': activity_type,
            'module': module,
            'title': title,
            'description': description,
            'performed_by': performed_by,
            'department_id': department_id,
            'asset_id': asset_id,
            'employee_id': employee_id,
            'priority': priority,
            'related_record_id': related_record_id,
            'related_model': related_model,
            'action_url': action_url,
            'metadata': json.dumps(metadata or {}),
        }

        try:
            activity = self.env['af.activity'].sudo().create(vals)
        except Exception as exc:
            _logger.exception("Failed to log activity: %s", exc)
            return self.env['af.activity']

        # Auto-generate notifications if recipients specified
        if notify_users:
            self._generate_notifications(
                activity, notify_users, notification_category,
            )

        return activity

    # ------------------------------------------------------------------
    # Notification Generation
    # ------------------------------------------------------------------
    def _generate_notifications(self, activity, user_ids, category):
        """Create notifications for each specified user."""
        Notification = self.env['af.notification'].sudo()
        vals_list = []
        for uid in user_ids:
            # Avoid notifying the performer about their own action
            if uid == activity.performed_by.id:
                continue
            vals_list.append({
                'recipient_id': uid,
                'department_id': activity.department_id.id if activity.department_id else False,
                'title': activity.title,
                'description': activity.description,
                'priority': activity.priority,
                'category': category,
                'action_url': activity.action_url,
                'related_activity_id': activity.id,
            })
        if vals_list:
            try:
                Notification.create(vals_list)
            except Exception as exc:
                _logger.exception("Failed to create notifications: %s", exc)

    # ------------------------------------------------------------------
    # Timeline Queries
    # ------------------------------------------------------------------
    def get_timeline(self, user_id=None, filters=None, page=1, limit=20):
        """Return paginated activity timeline.

        Args:
            user_id: Optional user id to filter by performed_by
            filters: dict with optional keys:
                - status: 'unread'/'read'/'archived'
                - priority: 'low'/'medium'/'high'/'critical'
                - module: module selection key
                - activity_type: activity type selection key
                - date_from: date string
                - date_to: date string
                - keyword: search term
            page: page number (1-indexed)
            limit: records per page

        Returns:
            dict with 'records', 'total', 'page', 'pages'
        """
        domain = []
        filters = filters or {}

        if user_id:
            domain.append(('performed_by', '=', user_id))

        if filters.get('status'):
            domain.append(('status', '=', filters['status']))
        if filters.get('priority'):
            domain.append(('priority', '=', filters['priority']))
        if filters.get('module'):
            domain.append(('module', '=', filters['module']))
        if filters.get('activity_type'):
            domain.append(('activity_type', '=', filters['activity_type']))
        if filters.get('date_from'):
            domain.append(('timestamp', '>=', filters['date_from']))
        if filters.get('date_to'):
            domain.append(('timestamp', '<=', filters['date_to']))
        if filters.get('keyword'):
            keyword = filters['keyword']
            domain.append('|')
            domain.append(('title', 'ilike', keyword))
            domain.append(('description', 'ilike', keyword))

        Activity = self.env['af.activity']
        total = Activity.search_count(domain)
        offset = (page - 1) * limit
        records = Activity.search(domain, limit=limit, offset=offset)

        pages = (total + limit - 1) // limit if limit else 1

        return {
            'records': [{
                'id': r.id,
                'name': r.name,
                'activity_type': r.activity_type,
                'module': r.module,
                'title': r.title,
                'description': r.description,
                'performed_by': r.performed_by.name if r.performed_by else '',
                'department': r.department_id.name if r.department_id else '',
                'asset': r.asset_id.display_name if r.asset_id else '',
                'employee': r.employee_id.name if r.employee_id else '',
                'timestamp': str(r.timestamp) if r.timestamp else '',
                'priority': r.priority,
                'status': r.status,
                'date_group': r.date_group,
                'action_url': r.action_url or '',
            } for r in records],
            'total': total,
            'page': page,
            'pages': pages,
        }

    def get_unread_count(self, user_id=None):
        """Return count of unread activities."""
        domain = [('status', '=', 'unread')]
        if user_id:
            domain.append(('performed_by', '=', user_id))
        return self.env['af.activity'].search_count(domain)

    def get_today_count(self):
        """Return count of today's activities."""
        domain = [('date_group', '=', 'Today')]
        return self.env['af.activity'].search_count(domain)
