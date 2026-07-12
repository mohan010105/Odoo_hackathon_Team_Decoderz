# -*- coding: utf-8 -*-
import json
import logging

from odoo import api, fields, models
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)

ACTIVITY_TYPES = [
    ('asset_created', 'Asset Created'),
    ('asset_updated', 'Asset Updated'),
    ('asset_allocated', 'Asset Allocated'),
    ('asset_returned', 'Asset Returned'),
    ('transfer_requested', 'Transfer Requested'),
    ('transfer_approved', 'Transfer Approved'),
    ('transfer_rejected', 'Transfer Rejected'),
    ('booking_created', 'Booking Created'),
    ('booking_approved', 'Booking Approved'),
    ('booking_cancelled', 'Booking Cancelled'),
    ('maintenance_raised', 'Maintenance Raised'),
    ('maintenance_assigned', 'Maintenance Assigned'),
    ('maintenance_completed', 'Maintenance Completed'),
    ('audit_started', 'Audit Started'),
    ('audit_completed', 'Audit Completed'),
    ('report_generated', 'Report Generated'),
    ('user_login', 'User Login'),
    ('user_logout', 'User Logout'),
    ('system_alert', 'System Alert'),
]

ACTIVITY_MODULES = [
    ('asset', 'Assets'),
    ('allocation', 'Allocation'),
    ('transfer', 'Transfers'),
    ('booking', 'Resource Booking'),
    ('maintenance', 'Maintenance'),
    ('audit', 'Asset Audit'),
    ('report', 'Reports'),
    ('auth', 'Authentication'),
    ('system', 'System'),
]

ACTIVITY_PRIORITY = [
    ('low', 'Low'),
    ('medium', 'Medium'),
    ('high', 'High'),
    ('critical', 'Critical'),
]

ACTIVITY_STATUS = [
    ('unread', 'Unread'),
    ('read', 'Read'),
    ('archived', 'Archived'),
]


class AfActivity(models.Model):
    """Centralized immutable activity feed for all AssetFlow modules."""

    _name = 'af.activity'
    _description = 'Activity'
    _order = 'timestamp desc, id desc'
    _rec_name = 'title'

    # ------------------------------------------------------------------
    # Fields
    # ------------------------------------------------------------------
    name = fields.Char(
        string='Activity ID',
        readonly=True,
        copy=False,
        index=True,
        default='New',
    )
    activity_type = fields.Selection(
        selection=ACTIVITY_TYPES,
        string='Activity Type',
        required=True,
        index=True,
    )
    module = fields.Selection(
        selection=ACTIVITY_MODULES,
        string='Module',
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
    performed_by = fields.Many2one(
        comodel_name='res.users',
        string='Performed By',
        default=lambda self: self.env.user,
        required=True,
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
        string='Affected Asset',
        index=True,
        ondelete='set null',
    )
    employee_id = fields.Many2one(
        comodel_name='af.employee',
        string='Affected Employee',
        index=True,
        ondelete='set null',
    )
    timestamp = fields.Datetime(
        string='Timestamp',
        default=fields.Datetime.now,
        required=True,
        index=True,
    )
    priority = fields.Selection(
        selection=ACTIVITY_PRIORITY,
        string='Priority',
        default='medium',
        required=True,
        index=True,
    )
    status = fields.Selection(
        selection=ACTIVITY_STATUS,
        string='Status',
        default='unread',
        required=True,
        index=True,
    )
    related_record_id = fields.Integer(
        string='Related Record ID',
        index=True,
    )
    related_model = fields.Char(
        string='Related Model',
        index=True,
    )
    action_url = fields.Char(
        string='Action URL',
    )
    metadata = fields.Text(
        string='Metadata (JSON)',
        default='{}',
    )

    # ------------------------------------------------------------------
    # Computed fields
    # ------------------------------------------------------------------
    date_group = fields.Char(
        string='Date Group',
        compute='_compute_date_group',
        store=True,
        index=True,
    )
    priority_color = fields.Integer(
        string='Priority Color',
        compute='_compute_priority_color',
    )

    # ------------------------------------------------------------------
    # SQL Constraints
    # ------------------------------------------------------------------
    _sql_constraints = [
        ('unique_name', 'UNIQUE(name)', 'Activity ID must be unique.'),
    ]

    # ------------------------------------------------------------------
    # Compute
    # ------------------------------------------------------------------
    @api.depends('timestamp')
    def _compute_date_group(self):
        from datetime import timedelta
        today = fields.Date.today()
        for rec in self:
            if not rec.timestamp:
                rec.date_group = 'Unknown'
                continue
            activity_date = rec.timestamp.date()
            if activity_date == today:
                rec.date_group = 'Today'
            elif activity_date == today - timedelta(days=1):
                rec.date_group = 'Yesterday'
            elif activity_date >= today - timedelta(days=7):
                rec.date_group = 'Last 7 Days'
            elif activity_date >= today - timedelta(days=30):
                rec.date_group = 'Last 30 Days'
            else:
                rec.date_group = 'Older'

    def _compute_priority_color(self):
        color_map = {'low': 10, 'medium': 2, 'high': 3, 'critical': 1}
        for rec in self:
            rec.priority_color = color_map.get(rec.priority, 0)

    # ------------------------------------------------------------------
    # ORM Overrides
    # ------------------------------------------------------------------
    @api.model_create_multi
    def create(self, vals_list):
        """Auto-generate activity ID (ACT-000001) on creation."""
        for vals in vals_list:
            if vals.get('name', 'New') == 'New':
                vals['name'] = self.env['ir.sequence'].next_by_code(
                    'af.activity.sequence'
                ) or 'New'
        records = super().create(vals_list)
        _logger.info(
            "Created %d activity record(s): %s",
            len(records),
            ', '.join(r.name for r in records),
        )
        return records

    def unlink(self):
        """Block deletion — activities are immutable audit records."""
        raise ValidationError(
            "Activities cannot be deleted. Use 'Archive' to hide them."
        )

    # ------------------------------------------------------------------
    # Business Logic
    # ------------------------------------------------------------------
    def action_mark_read(self):
        """Mark selected activities as read."""
        self.filtered(lambda r: r.status == 'unread').write({'status': 'read'})

    def action_archive(self):
        """Archive selected activities."""
        self.filtered(lambda r: r.status != 'archived').write({'status': 'archived'})

    def action_mark_unread(self):
        """Mark selected activities as unread."""
        self.filtered(lambda r: r.status == 'read').write({'status': 'unread'})

    def get_metadata_dict(self):
        """Return metadata as Python dict."""
        self.ensure_one()
        try:
            return json.loads(self.metadata or '{}')
        except (json.JSONDecodeError, TypeError):
            return {}
