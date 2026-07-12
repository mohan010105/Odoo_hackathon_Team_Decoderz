# -*- coding: utf-8 -*-
import logging

from odoo import api, fields, models
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)

APPROVAL_TYPES = [
    ('transfer', 'Transfer Approval'),
    ('booking', 'Booking Approval'),
    ('maintenance', 'Maintenance Approval'),
    ('audit', 'Audit Approval'),
]

APPROVAL_PRIORITY = [
    ('low', 'Low'),
    ('medium', 'Medium'),
    ('high', 'High'),
    ('critical', 'Critical'),
]

APPROVAL_STATUS = [
    ('pending', 'Pending'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected'),
]


class AfApproval(models.Model):
    """Centralized approval queue for all AssetFlow workflows."""

    _name = 'af.approval'
    _description = 'Approval'
    _order = 'request_date desc, id desc'
    _rec_name = 'title'

    # ------------------------------------------------------------------
    # Fields
    # ------------------------------------------------------------------
    name = fields.Char(
        string='Approval ID',
        readonly=True,
        copy=False,
        index=True,
        default='New',
    )
    approval_type = fields.Selection(
        selection=APPROVAL_TYPES,
        string='Type',
        required=True,
        index=True,
    )
    title = fields.Char(
        string='Title',
        required=True,
    )
    description = fields.Text(
        string='Description',
    )
    requested_by = fields.Many2one(
        comodel_name='res.users',
        string='Requested By',
        default=lambda self: self.env.user,
        required=True,
        index=True,
    )
    assigned_to = fields.Many2one(
        comodel_name='res.users',
        string='Assigned To',
        index=True,
    )
    department_id = fields.Many2one(
        comodel_name='af.department',
        string='Department',
        index=True,
        ondelete='set null',
    )
    asset_id = fields.Many2one(
        comodel_name='af.asset',
        string='Asset',
        index=True,
        ondelete='set null',
    )
    priority = fields.Selection(
        selection=APPROVAL_PRIORITY,
        string='Priority',
        default='medium',
        required=True,
        index=True,
    )
    status = fields.Selection(
        selection=APPROVAL_STATUS,
        string='Status',
        default='pending',
        required=True,
        tracking=True,
        index=True,
    )
    related_record_id = fields.Integer(
        string='Related Record ID',
        index=True,
    )
    related_model = fields.Char(
        string='Related Model',
    )
    request_date = fields.Datetime(
        string='Request Date',
        default=fields.Datetime.now,
        required=True,
        index=True,
    )
    response_date = fields.Datetime(
        string='Response Date',
    )
    remarks = fields.Text(
        string='Remarks',
    )

    # ------------------------------------------------------------------
    # SQL Constraints
    # ------------------------------------------------------------------
    _sql_constraints = [
        ('unique_name', 'UNIQUE(name)', 'Approval ID must be unique.'),
    ]

    # ------------------------------------------------------------------
    # ORM Overrides
    # ------------------------------------------------------------------
    @api.model_create_multi
    def create(self, vals_list):
        """Auto-generate approval ID (APR-000001) on creation."""
        for vals in vals_list:
            if vals.get('name', 'New') == 'New':
                vals['name'] = self.env['ir.sequence'].next_by_code(
                    'af.approval.sequence'
                ) or 'New'
        records = super().create(vals_list)
        _logger.info(
            "Created %d approval(s): %s",
            len(records),
            ', '.join(r.name for r in records),
        )
        return records

    # ------------------------------------------------------------------
    # Business Logic
    # ------------------------------------------------------------------
    def action_approve(self):
        """Approve a single pending request."""
        self.ensure_one()
        if self.status != 'pending':
            raise ValidationError("Only pending approvals can be approved.")
        self.write({
            'status': 'approved',
            'response_date': fields.Datetime.now(),
        })
        # Trigger the related model's approve action
        self._execute_related_action('approve')
        # Log activity
        self._log_approval_activity('approved')
        return True

    def action_reject(self):
        """Reject a single pending request."""
        self.ensure_one()
        if self.status != 'pending':
            raise ValidationError("Only pending approvals can be rejected.")
        self.write({
            'status': 'rejected',
            'response_date': fields.Datetime.now(),
        })
        # Trigger the related model's reject action
        self._execute_related_action('reject')
        # Log activity
        self._log_approval_activity('rejected')
        return True

    def action_bulk_approve(self):
        """Approve multiple pending requests."""
        pending = self.filtered(lambda r: r.status == 'pending')
        for record in pending:
            record.action_approve()
        return True

    def action_bulk_reject(self):
        """Reject multiple pending requests."""
        pending = self.filtered(lambda r: r.status == 'pending')
        for record in pending:
            record.action_reject()
        return True

    def _execute_related_action(self, action):
        """Execute approve/reject on the related record."""
        self.ensure_one()
        if not self.related_model or not self.related_record_id:
            return
        try:
            record = self.env[self.related_model].browse(self.related_record_id)
            if not record.exists():
                _logger.warning(
                    "Related record %s(%d) not found for approval %s",
                    self.related_model, self.related_record_id, self.name,
                )
                return
            method_name = f'action_{action}'
            if hasattr(record, method_name):
                getattr(record, method_name)()
        except Exception as exc:
            _logger.exception(
                "Error executing %s on %s(%d): %s",
                action, self.related_model, self.related_record_id, exc,
            )

    def _log_approval_activity(self, result):
        """Log an activity for the approval decision."""
        self.ensure_one()
        activity_type = f'transfer_{result}' if self.approval_type == 'transfer' else f'{self.approval_type}_{result}'
        # Only use valid activity types
        valid_types = [t[0] for t in [
            ('transfer_approved', ''), ('transfer_rejected', ''),
            ('booking_approved', ''), ('booking_cancelled', ''),
            ('maintenance_completed', ''), ('audit_completed', ''),
        ]]
        if activity_type not in valid_types:
            activity_type = 'system_alert'

        try:
            self.env['af.activity'].create({
                'activity_type': activity_type,
                'module': self.approval_type,
                'title': f"Approval {result.title()}: {self.title}",
                'description': f"Approval {self.name} was {result} by {self.env.user.name}."
                               + (f" Remarks: {self.remarks}" if self.remarks else ''),
                'performed_by': self.env.user.id,
                'department_id': self.department_id.id if self.department_id else False,
                'asset_id': self.asset_id.id if self.asset_id else False,
                'priority': self.priority,
                'related_record_id': self.related_record_id,
                'related_model': self.related_model,
            })
        except Exception as exc:
            _logger.warning("Could not log approval activity: %s", exc)
```

,Description:
