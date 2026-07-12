# -*- coding: utf-8 -*-
"""
Activity Controller
===================
JSON endpoints for the Activity Center.
"""
import json
import logging

from odoo import http
from odoo.http import request

from ..services.activity_service import ActivityService

_logger = logging.getLogger(__name__)


class ActivityController(http.Controller):
    """JSON endpoints for activity timeline and management."""

    @http.route(
        '/assetflow/activities',
        type='http',
        auth='user',
        methods=['GET'],
        csrf=False,
    )
    def get_activities(self, **kwargs):
        """Return paginated activity timeline."""
        try:
            service = ActivityService(request.env)
            page = int(kwargs.get('page', 1))
            limit = int(kwargs.get('limit', 20))
            filters = {}
            for key in ['status', 'priority', 'module', 'activity_type',
                        'date_from', 'date_to', 'keyword']:
                if kwargs.get(key):
                    filters[key] = kwargs[key]

            data = service.get_timeline(
                filters=filters, page=page, limit=limit,
            )
            return request.make_response(
                json.dumps({'status': 'ok', 'data': data}),
                headers=[('Content-Type', 'application/json')],
            )
        except Exception as exc:
            _logger.exception("Error fetching activities: %s", exc)
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(exc)}),
                headers=[('Content-Type', 'application/json')],
                status=500,
            )

    @http.route(
        '/assetflow/activities/count',
        type='http',
        auth='user',
        methods=['GET'],
        csrf=False,
    )
    def get_activity_count(self, **kwargs):
        """Return unread activity count."""
        try:
            service = ActivityService(request.env)
            data = {
                'unread': service.get_unread_count(),
                'today': service.get_today_count(),
            }
            return request.make_response(
                json.dumps({'status': 'ok', 'data': data}),
                headers=[('Content-Type', 'application/json')],
            )
        except Exception as exc:
            _logger.exception("Error fetching activity count: %s", exc)
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(exc)}),
                headers=[('Content-Type', 'application/json')],
                status=500,
            )

    @http.route(
        '/assetflow/activities/mark-read',
        type='http',
        auth='user',
        methods=['POST'],
        csrf=False,
    )
    def mark_activities_read(self, **kwargs):
        """Mark specified activities as read."""
        try:
            body = json.loads(request.httprequest.data or '{}')
            activity_ids = body.get('ids', [])
            if activity_ids:
                activities = request.env['af.activity'].browse(activity_ids)
                activities.action_mark_read()
            return request.make_response(
                json.dumps({'status': 'ok'}),
                headers=[('Content-Type', 'application/json')],
            )
        except Exception as exc:
            _logger.exception("Error marking activities read: %s", exc)
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(exc)}),
                headers=[('Content-Type', 'application/json')],
                status=500,
            )

    @http.route(
        '/assetflow/activities/archive',
        type='http',
        auth='user',
        methods=['POST'],
        csrf=False,
    )
    def archive_activities(self, **kwargs):
        """Archive specified activities."""
        try:
            body = json.loads(request.httprequest.data or '{}')
            activity_ids = body.get('ids', [])
            if activity_ids:
                activities = request.env['af.activity'].browse(activity_ids)
                activities.action_archive()
            return request.make_response(
                json.dumps({'status': 'ok'}),
                headers=[('Content-Type', 'application/json')],
            )
        except Exception as exc:
            _logger.exception("Error archiving activities: %s", exc)
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(exc)}),
                headers=[('Content-Type', 'application/json')],
                status=500,
            )
