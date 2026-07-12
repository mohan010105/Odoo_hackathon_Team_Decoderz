# -*- coding: utf-8 -*-
"""
Alert Controller
================
JSON endpoints for System Alerts.
"""
import json
import logging

from odoo import http
from odoo.http import request

from ..services.alert_service import AlertService

_logger = logging.getLogger(__name__)


class AlertController(http.Controller):
    """JSON endpoints for system alert management."""

    @http.route(
        '/assetflow/alerts',
        type='http',
        auth='user',
        methods=['GET'],
        csrf=False,
    )
    def get_alerts(self, **kwargs):
        """Return active system alerts."""
        try:
            service = AlertService(request.env)
            page = int(kwargs.get('page', 1))
            limit = int(kwargs.get('limit', 20))
            filters = {}
            for key in ['status', 'alert_type', 'severity']:
                if kwargs.get(key):
                    filters[key] = kwargs[key]

            data = service.get_active_alerts(
                filters=filters, page=page, limit=limit,
            )
            return request.make_response(
                json.dumps({'status': 'ok', 'data': data}),
                headers=[('Content-Type', 'application/json')],
            )
        except Exception as exc:
            _logger.exception("Error fetching alerts: %s", exc)
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(exc)}),
                headers=[('Content-Type', 'application/json')],
                status=500,
            )

    @http.route(
        '/assetflow/alerts/acknowledge',
        type='http',
        auth='user',
        methods=['POST'],
        csrf=False,
    )
    def acknowledge_alert(self, **kwargs):
        """Acknowledge an alert."""
        try:
            body = json.loads(request.httprequest.data or '{}')
            alert_id = body.get('id')
            if alert_id:
                alert = request.env['af.system.alert'].browse(alert_id)
                alert.action_acknowledge()
            return request.make_response(
                json.dumps({'status': 'ok'}),
                headers=[('Content-Type', 'application/json')],
            )
        except Exception as exc:
            _logger.exception("Error acknowledging alert: %s", exc)
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(exc)}),
                headers=[('Content-Type', 'application/json')],
                status=500,
            )

    @http.route(
        '/assetflow/alerts/resolve',
        type='http',
        auth='user',
        methods=['POST'],
        csrf=False,
    )
    def resolve_alert(self, **kwargs):
        """Resolve an alert."""
        try:
            body = json.loads(request.httprequest.data or '{}')
            alert_id = body.get('id')
            if alert_id:
                alert = request.env['af.system.alert'].browse(alert_id)
                alert.action_resolve()
            return request.make_response(
                json.dumps({'status': 'ok'}),
                headers=[('Content-Type', 'application/json')],
            )
        except Exception as exc:
            _logger.exception("Error resolving alert: %s", exc)
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(exc)}),
                headers=[('Content-Type', 'application/json')],
                status=500,
            )

    @http.route(
        '/assetflow/alerts/count',
        type='http',
        auth='user',
        methods=['GET'],
        csrf=False,
    )
    def get_alert_count(self, **kwargs):
        """Return alert counts."""
        try:
            service = AlertService(request.env)
            data = {
                'active': service.get_active_count(),
                'critical': service.get_critical_count(),
            }
            return request.make_response(
                json.dumps({'status': 'ok', 'data': data}),
                headers=[('Content-Type', 'application/json')],
            )
        except Exception as exc:
            _logger.exception("Error fetching alert counts: %s", exc)
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(exc)}),
                headers=[('Content-Type', 'application/json')],
                status=500,
            )
