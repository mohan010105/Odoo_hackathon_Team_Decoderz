# -*- coding: utf-8 -*-
import logging

from odoo import api, fields, models
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
ASSET_STATUS = [
    ('available', 'Available'),
    ('allocated', 'Allocated'),
    ('under_maintenance', 'Under Maintenance'),
    ('disposed', 'Disposed'),
]

ASSET_CONDITION = [
    ('excellent', 'Excellent'),
    ('good', 'Good'),
    ('fair', 'Fair'),
    ('poor', 'Poor'),
]


class AfAsset(models.Model):
    """Physical or digital asset tracked by AssetFlow."""

    _name = 'af.asset'
    _description = 'Asset'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'tag asc'
    _rec_name = 'display_name'

    # ------------------------------------------------------------------
    # Identity fields
    # ------------------------------------------------------------------
    name = fields.Char(
        string='Asset Name',
        required=True,
        tracking=True,
        index=True,
    )
    tag = fields.Char(
        string='Asset Tag',
        readonly=True,
        copy=False,
        index=True,
        default='New',
    )
    serial_number = fields.Char(
        string='Serial Number',
        copy=False,
        index=True,
    )
    description = fields.Text(string='Description')

    # ------------------------------------------------------------------
    # Classification
    # ------------------------------------------------------------------
    category_id = fields.Many2one(
        comodel_name='af.asset.category',
        string='Category',
        required=True,
        tracking=True,
        index=True,
        ondelete='restrict',
    )

    # ------------------------------------------------------------------
    # Ownership / location
    # ------------------------------------------------------------------
    department_id = fields.Many2one(
        comodel_name='af.department',
        string='Department',
        tracking=True,
        index=True,
        ondelete='restrict',
    )
    employee_id = fields.Many2one(
        comodel_name='af.employee',
        string='Assigned To',
        tracking=True,
        index=True,
        ondelete='set null',
    )
    location = fields.Char(string='Location / Desk')

    # ------------------------------------------------------------------
    # Financial
    # ------------------------------------------------------------------
    purchase_date = fields.Date(string='Purchase Date', required=True)
    purchase_cost = fields.Float(
        string='Purchase Cost',
        digits=(12, 2),
        required=True,
    )
    current_value = fields.Float(
        string='Current Value',
        digits=(12, 2),
    )
    vendor = fields.Char(string='Vendor')

    # ------------------------------------------------------------------
    # State
    # ------------------------------------------------------------------
    condition = fields.Selection(
        selection=ASSET_CONDITION,
        string='Condition',
        default='good',
        required=True,
        tracking=True,
    )
    status = fields.Selection(
        selection=ASSET_STATUS,
        string='Status',
        default='available',
        required=True,
        tracking=True,
        index=True,
    )
    bookable = fields.Boolean(
        string='Bookable',
        default=False,
        tracking=True,
        help='Whether this asset can be reserved/booked by employees.',
    )

    # ------------------------------------------------------------------
    # Computed / display
    # ------------------------------------------------------------------
    display_name = fields.Char(
        string='Display Name',
        compute='_compute_display_name',
        store=True,
    )

    # ------------------------------------------------------------------
    # SQL Constraints
    # ------------------------------------------------------------------
    _sql_constraints = [
        ('unique_tag', 'UNIQUE(tag)', 'Asset tag must be unique.'),
        ('unique_serial', 'UNIQUE(serial_number)', 'Serial number must be unique.'),
        (
            'positive_cost',
            'CHECK(purchase_cost >= 0)',
            'Purchase cost must be non-negative.',
        ),
        (
            'positive_value',
            'CHECK(current_value >= 0)',
            'Current value must be non-negative.',
        ),
    ]

    # ------------------------------------------------------------------
    # Compute methods
    # ------------------------------------------------------------------
    @api.depends('name', 'tag')
    def _compute_display_name(self):
        for record in self:
            tag = record.tag if record.tag and record.tag != 'New' else '—'
            record.display_name = f"[{tag}] {record.name}"

    # ------------------------------------------------------------------
    # ORM overrides
    # ------------------------------------------------------------------
    @api.model_create_multi
    def create(self, vals_list):
        """Auto-generate asset tag (AF-000001) on creation."""
        for vals in vals_list:
            if vals.get('tag', 'New') == 'New':
                vals['tag'] = self.env['ir.sequence'].next_by_code(
                    'af.asset.sequence'
                ) or 'New'
        records = super().create(vals_list)
        _logger.info(
            "Created asset(s): %s",
            ', '.join(r.tag for r in records),
        )
        # Log activities
        from ..services.activity_service import ActivityService
        activity_srv = ActivityService(self.env)
        for record in records:
            activity_srv.log_activity(
                activity_type='asset_created',
                module='asset',
                title=f"Asset Created: {record.display_name}",
                description=f"Asset {record.display_name} has been added to the system.",
                asset_id=record.id,
                department_id=record.department_id.id if record.department_id else False,
                priority='low',
                related_record_id=record.id,
                related_model='af.asset',
            )
        return records

    def write(self, vals):
        old_data = {rec.id: (rec.status, rec.condition) for rec in self}
        res = super().write(vals)
        from ..services.activity_service import ActivityService
        activity_srv = ActivityService(self.env)
        for record in self:
            old_status, old_condition = old_data.get(record.id, (None, None))
            if 'status' in vals and vals['status'] != old_status:
                activity_srv.log_activity(
                    activity_type='asset_updated',
                    module='asset',
                    title=f"Asset Status Changed: {record.display_name}",
                    description=f"Status of asset {record.display_name} changed from {old_status} to {vals['status']}.",
                    asset_id=record.id,
                    department_id=record.department_id.id if record.department_id else False,
                    priority='medium',
                    related_record_id=record.id,
                    related_model='af.asset',
                )
        return res

    def unlink(self):
        """Block hard delete — use soft-delete (dispose) instead."""
        for asset in self:
            if asset.status != 'disposed':
                raise ValidationError(
                    f"Asset '{asset.tag}' cannot be deleted directly. "
                    "Change its status to 'Disposed' first."
                )
        return super().unlink()

    # ------------------------------------------------------------------
    # Business logic / state transitions
    # ------------------------------------------------------------------
    def action_set_available(self):
        """Mark asset as available and clear employee assignment."""
        self._ensure_not_disposed()
        self.write({'status': 'available', 'employee_id': False})

    def action_set_maintenance(self):
        """Mark asset as under maintenance."""
        self._ensure_not_disposed()
        self.write({'status': 'under_maintenance', 'employee_id': False})

    def action_dispose(self):
        """Soft-delete: mark asset as disposed."""
        self.write({'status': 'disposed', 'employee_id': False})
        _logger.warning(
            "Asset '%s' (%s) has been disposed.", self.tag, self.name
        )

    def _ensure_not_disposed(self):
        for asset in self:
            if asset.status == 'disposed':
                raise ValidationError(
                    f"Asset '{asset.tag}' has been disposed and cannot be modified."
                )

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------
    @api.constrains('purchase_date', 'purchase_cost')
    def _check_financial_fields(self):
        for asset in self:
            if asset.purchase_cost < 0:
                raise ValidationError(
                    f"Purchase cost for '{asset.name}' must be non-negative."
                )
            if asset.current_value and asset.current_value < 0:
                raise ValidationError(
                    f"Current value for '{asset.name}' must be non-negative."
                )

    @api.constrains('employee_id', 'status')
    def _check_allocation_consistency(self):
        for asset in self:
            if asset.employee_id and asset.status != 'allocated':
                raise ValidationError(
                    f"Asset '{asset.tag}' is assigned to "
                    f"'{asset.employee_id.name}' but status is not 'Allocated'. "
                    "Set status to 'Allocated' when assigning an employee."
                )
