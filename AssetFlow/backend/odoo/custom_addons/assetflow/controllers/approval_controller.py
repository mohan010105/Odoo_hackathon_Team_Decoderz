# -*- coding: utf-8 -*-
"""
Approval Controller
===================
JSON endpoints for the Approval Center.
"""
import json
import logging

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class ApprovalController(http.Controller):
    """JSON endpoints for approval management."""

    @http.route(
        '/assetflow/approvals',
        type='http',
        auth='user',
        methods=['GET'],
        csrf=False,
    )
    def get_approvals(self, **kwargs):
        """Return approvals list."""
        try:
            page = int(kwargs.get('page', 1))
            limit = int(kwargs.get('limit', 20))
            domain = []

            status = kwargs.get('status', 'pending')
            if status:
                domain.append(('status', '=', status))
            if kwargs.get('approval_type'):
                domain.append(('approval_type', '=', kwargs['approval_type']))

            Approval = request.env['af.approval']
            total = Approval.search_count(domain)
            offset = (page - 1) * limit
            records = Approval.search(domain, limit=limit, offset=offset)

            pages = (total + limit - 1) // limit if limit else 1

            data = {
                'records': [{
                    'id': r.id,
                    'name': r.name,
                    'approval_type': r.approval_type,
                    'title': r.title,
                    'description': r.description or '',
                    'requested_by': r.requested_by.name if r.requested_by else '',
                    'assigned_to': r.assigned_to.name if r.assigned_to else '',
                    'department': r.department_id.name if r.department_id else '',
                    'asset': r.asset_id.display_name if r.asset_id else '',
                    'priority': r.priority,
                    'status': r.status,
                    'request_date': str(r.request_date) if r.request_date else '',
                } for r in records],
                'total': total,
                'page': page,
                'pages': pages,
            }
            return request.make_response(
                json.dumps({'status': 'ok', 'data': data}),
                headers=[('Content-Type', 'application/json')],
            )
        except Exception as exc:
            _logger.exception("Error fetching approvals: %s", exc)
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(exc)}),
                headers=[('Content-Type', 'application/json')],
                status=500,
            )

    @http.route(
        '/assetflow/approvals/approve',
        type='http',
        auth='user',
        methods=['POST'],
        csrf=False,
    )
    def approve(self, **kwargs):
        """Approve one or more pending requests."""
        try:
            body = json.loads(request.httprequest.data or '{}')
            approval_ids = body.get('ids', [])
            remarks = body.get('remarks', '')
            if approval_ids:
                approvals = request.env['af.approval'].browse(approval_ids)
                if remarks:
                    approvals.write({'remarks': remarks})
                approvals.action_bulk_approve()
            return request.make_response(
                json.dumps({'status': 'ok'}),
                headers=[('Content-Type', 'application/json')],
            )
        except Exception as exc:
            _logger.exception("Error approving: %s", exc)
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(exc)}),
                headers=[('Content-Type', 'application/json')],
                status=500,
            )

    @http.route(
        '/assetflow/approvals/reject',
        type='http',
        auth='user',
        methods=['POST'],
        csrf=False,
    )
    def reject(self, **kwargs):
        """Reject one or more pending requests."""
        try:
            body = json.loads(request.httprequest.data or '{}')
            approval_ids = body.get('ids', [])
            remarks = body.get('remarks', '')
            if approval_ids:
                approvals = request.env['af.approval'].browse(approval_ids)
                if remarks:
                    approvals.write({'remarks': remarks})
                approvals.action_bulk_reject()
            return request.make_response(
                json.dumps({'status': 'ok'}),
                headers=[('Content-Type', 'application/json')],
            )
        except Exception as exc:
            _logger.exception("Error rejecting: %s", exc)
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(exc)}),
                headers=[('Content-Type', 'application/json')],
                status=500,
            )
