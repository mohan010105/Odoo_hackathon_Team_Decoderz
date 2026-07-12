# -*- coding: utf-8 -*-
"""
Notification Controller
=======================
JSON endpoints for the Notification Center.
"""
import json
import logging

from odoo import http
from odoo.http import request

from ..services.notification_service import NotificationService

_logger = logging.getLogger(__name__)


class NotificationController(http.Controller):
    """JSON endpoints for notification management."""

    @http.route(
        '/assetflow/notifications',
        type='http',
        auth='user',
        methods=['GET'],
        csrf=False,
    )
    def get_notifications(self, **kwargs):
        """Return paginated notifications for current user."""
        try:
            service = NotificationService(request.env)
            page = int(kwargs.get('page', 1))
            limit = int(kwargs.get('limit', 20))
            filters = {}
            for key in ['status', 'category', 'priority', 'keyword']:
                if kwargs.get(key):
                    filters[key] = kwargs[key]

            data = service.get_notifications(
                user_id=request.env.user.id,
                filters=filters, page=page, limit=limit,
            )
            return request.make_response(
                json.dumps({'status': 'ok', 'data': data}),
                headers=[('Content-Type', 'application/json')],
            )
        except Exception as exc:
            _logger.exception("Error fetching notifications: %s", exc)
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(exc)}),
                headers=[('Content-Type', 'application/json')],
                status=500,
            )

    @http.route(
        '/assetflow/notifications/count',
        type='http',
        auth='user',
        methods=['GET'],
        csrf=False,
    )
    def get_notification_count(self, **kwargs):
        """Return notification counts for current user."""
        try:
            service = NotificationService(request.env)
            data = service.get_counts(request.env.user.id)
            return request.make_response(
                json.dumps({'status': 'ok', 'data': data}),
                headers=[('Content-Type', 'application/json')],
            )
        except Exception as exc:
            _logger.exception("Error fetching notification count: %s", exc)
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(exc)}),
                headers=[('Content-Type', 'application/json')],
                status=500,
            )

    @http.route(
        '/assetflow/notifications/mark-read',
        type='http',
        auth='user',
        methods=['POST'],
        csrf=False,
    )
    def mark_notifications_read(self, **kwargs):
        """Mark specified notifications as read."""
        try:
            body = json.loads(request.httprequest.data or '{}')
            notification_ids = body.get('ids', [])
            if notification_ids:
                notifications = request.env['af.notification'].browse(notification_ids)
                notifications.action_mark_read()
            return request.make_response(
                json.dumps({'status': 'ok'}),
                headers=[('Content-Type', 'application/json')],
            )
        except Exception as exc:
            _logger.exception("Error marking notifications read: %s", exc)
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(exc)}),
                headers=[('Content-Type', 'application/json')],
                status=500,
            )

    @http.route(
        '/assetflow/notifications/mark-all-read',
        type='http',
        auth='user',
        methods=['POST'],
        csrf=False,
    )
    def mark_all_notifications_read(self, **kwargs):
        """Mark all notifications as read for current user."""
        try:
            request.env['af.notification'].action_mark_all_read()
            return request.make_response(
                json.dumps({'status': 'ok'}),
                headers=[('Content-Type', 'application/json')],
            )
        except Exception as exc:
            _logger.exception("Error marking all notifications read: %s", exc)
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(exc)}),
                headers=[('Content-Type', 'application/json')],
                status=500,
            )
