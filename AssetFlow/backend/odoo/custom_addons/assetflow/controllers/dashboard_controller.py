# -*- coding: utf-8 -*-
"""
Dashboard Controller
====================
Thin JSON endpoint exposing KPI data for the dashboard view.
All business logic is delegated to DashboardService.
"""
import json
import logging

from odoo import http
from odoo.http import request

from ..services.dashboard_service import DashboardService

_logger = logging.getLogger(__name__)


class AssetFlowDashboardController(http.Controller):
    """Provides JSON endpoints consumed by the AssetFlow dashboard."""

    @http.route(
        '/assetflow/dashboard/kpis',
        type='http',
        auth='user',
        methods=['GET'],
        csrf=False,
    )
    def get_kpis(self, **kwargs):
        """Return KPI metrics as JSON."""
        try:
            service = DashboardService(request.env)
            data = service.get_kpis()
            return request.make_response(
                json.dumps({'status': 'ok', 'data': data}),
                headers=[('Content-Type', 'application/json')],
            )
        except Exception as exc:  # noqa: BLE001
            _logger.exception("Error fetching dashboard KPIs: %s", exc)
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(exc)}),
                headers=[('Content-Type', 'application/json')],
                status=500,
            )

    @http.route(
        '/assetflow/dashboard/summary',
        type='http',
        auth='user',
        methods=['GET'],
        csrf=False,
    )
    def get_summary(self, **kwargs):
        """Return full dashboard summary (KPIs + breakdowns)."""
        try:
            service = DashboardService(request.env)
            data = {
                'kpis': service.get_kpis(),
                'by_category': service.get_assets_by_category(),
                'by_department': service.get_assets_by_department(),
                'by_condition': service.get_assets_by_condition(),
            }
            return request.make_response(
                json.dumps({'status': 'ok', 'data': data}),
                headers=[('Content-Type', 'application/json')],
            )
        except Exception as exc:  # noqa: BLE001
            _logger.exception("Error fetching dashboard summary: %s", exc)
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(exc)}),
                headers=[('Content-Type', 'application/json')],
                status=500,
            )
