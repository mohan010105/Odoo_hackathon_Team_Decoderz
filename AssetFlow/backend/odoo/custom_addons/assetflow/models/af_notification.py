# -*- coding: utf-8 -*-
import logging

from odoo import api, fields, models
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)

NOTIFICATION_CATEGORY = [
    ('success', 'Success'),
    ('info', 'Information'),
    ('warning', 'Warning'),
    ('critical', 'Critical'),
    ('approval', 'Approval'),
    ('reminder', 'Reminder'),
]

NOTIFICATION_PRIORITY = [
    ('low', 'Low'),
    ('medium', 'Medium'),
    ('high', 'High'),
    ('critical', 'Critical'),
]

NOTIFICATION_STATUS = [
    ('unread', 'Unread'),
    ('read', 'Read'),
    ('archived', 'Archived'),
]


class AfNotification(models.Model):
    """Per-user notification system for AssetFlow."""

    _name = 'af.notification'
    _description = 'Notification'
    _order = 'created_time desc, id desc'
    _rec_name = 'title'

    # ------------------------------------------------------------------
    # Fields
    # ------------------------------------------------------------------
    name = fields.Char(
        string='Notification ID',
        readonly=True,
        copy=False,
        index=True,
        default='New',
    )
    recipient_id = fields.Many2one(
        comodel_name='res.users',
        string='Recipient',
        required=True,
        index=True,
        ondelete='cascade',
    )
    department_id = fields.Many2one(
        comodel_name='af.department',
        string='Department',
        index=True,
        ondelete='set null',
    )
    title = fields.Char(
        string='Title',
        required=True,
    )
    description = fields.Text(
        string='Description',
    )
    priority = fields.Selection(
        selection=NOTIFICATION_PRIORITY,
        string='Priority',
        default='medium',
        required=True,
        index=True,
    )
    category = fields.Selection(
        selection=NOTIFICATION_CATEGORY,
        string='Category',
        required=True,
        index=True,
    )
    created_time = fields.Datetime(
        string='Created Time',
        default=fields.Datetime.now,
        required=True,
        index=True,
    )
    read_time = fields.Datetime(
        string='Read Time',
    )
    status = fields.Selection(
        selection=NOTIFICATION_STATUS,
        string='Status',
        default='unread',
        required=True,
        index=True,
    )
    action_button = fields.Char(
        string='Action Button Label',
        default='View',
    )
    action_url = fields.Char(
        string='Action URL',
    )
    related_activity_id = fields.Many2one(
        comodel_name='af.activity',
        string='Source Activity',
        index=True,
        ondelete='set null',
    )

    # ------------------------------------------------------------------
    # Computed
    # ------------------------------------------------------------------
    category_icon = fields.Char(
        string='Category Icon',
        compute='_compute_category_icon',
    )

    # ------------------------------------------------------------------
    # SQL Constraints
    # ------------------------------------------------------------------
    _sql_constraints = [
        ('unique_name', 'UNIQUE(name)', 'Notification ID must be unique.'),
    ]

    # ------------------------------------------------------------------
    # Compute
    # ------------------------------------------------------------------
    def _compute_category_icon(self):
        icon_map = {
            'success': 'fa-check-circle',
            'info': 'fa-info-circle',
            'warning': 'fa-exclamation-triangle',
            'critical': 'fa-times-circle',
            'approval': 'fa-gavel',
            'reminder': 'fa-bell',
        }
        for rec in self:
            rec.category_icon = icon_map.get(rec.category, 'fa-bell')

    # ------------------------------------------------------------------
    # ORM Overrides
    # ------------------------------------------------------------------
    @api.model_create_multi
    def create(self, vals_list):
        """Auto-generate notification ID (NTF-000001) on creation."""
        for vals in vals_list:
            if vals.get('name', 'New') == 'New':
                vals['name'] = self.env['ir.sequence'].next_by_code(
                    'af.notification.sequence'
                ) or 'New'
        records = super().create(vals_list)
        _logger.info(
            "Created %d notification(s) for user(s): %s",
            len(records),
            ', '.join(str(r.recipient_id.id) for r in records),
        )
        return records

    # ------------------------------------------------------------------
    # Business Logic
    # ------------------------------------------------------------------
    def action_mark_read(self):
        """Mark selected notifications as read."""
        now = fields.Datetime.now()
        self.filtered(lambda r: r.status == 'unread').write({
            'status': 'read',
            'read_time': now,
        })

    def action_mark_all_read(self):
        """Mark all unread notifications for current user as read."""
        now = fields.Datetime.now()
        unread = self.search([
            ('recipient_id', '=', self.env.user.id),
            ('status', '=', 'unread'),
        ])
        unread.write({'status': 'read', 'read_time': now})
        return True

    def action_archive(self):
        """Archive selected notifications."""
        self.filtered(lambda r: r.status != 'archived').write({'status': 'archived'})

    def action_mark_unread(self):
        """Mark selected notifications as unread."""
        self.filtered(lambda r: r.status == 'read').write({
            'status': 'unread',
            'read_time': False,
        })
