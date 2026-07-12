# -*- coding: utf-8 -*-
import logging

from odoo import api, fields, models
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
DEPARTMENT_STATUS = [
    ('active', 'Active'),
    ('inactive', 'Inactive'),
]


class AfDepartment(models.Model):
    """Organisational department owning employees and assets."""

    _name = 'af.department'
    _description = 'Department'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'name asc'
    _rec_name = 'name'

    # ------------------------------------------------------------------
    # Fields
    # ------------------------------------------------------------------
    name = fields.Char(
        string='Department Name',
        required=True,
        tracking=True,
        index=True,
    )
    code = fields.Char(
        string='Department Code',
        required=True,
        size=10,
        tracking=True,
        index=True,
    )
    description = fields.Text(string='Description')
    status = fields.Selection(
        selection=DEPARTMENT_STATUS,
        string='Status',
        default='active',
        required=True,
        tracking=True,
        index=True,
    )
    head_id = fields.Many2one(
        comodel_name='af.employee',
        string='Department Head',
        tracking=True,
        ondelete='set null',
    )

    # Reverse relations
    employee_ids = fields.One2many(
        comodel_name='af.employee',
        inverse_name='department_id',
        string='Employees',
    )
    asset_ids = fields.One2many(
        comodel_name='af.asset',
        inverse_name='department_id',
        string='Assets',
    )

    # Computed counters
    employee_count = fields.Integer(
        string='Employees',
        compute='_compute_employee_count',
        store=True,
    )
    asset_count = fields.Integer(
        string='Assets',
        compute='_compute_asset_count',
        store=True,
    )

    # ------------------------------------------------------------------
    # Constraints
    # ------------------------------------------------------------------
    _sql_constraints = [
        ('unique_code', 'UNIQUE(code)', 'Department code must be unique.'),
        ('unique_name', 'UNIQUE(name)', 'Department name must be unique.'),
    ]

    # ------------------------------------------------------------------
    # Compute methods
    # ------------------------------------------------------------------
    @api.depends('employee_ids')
    def _compute_employee_count(self):
        for record in self:
            record.employee_count = len(record.employee_ids)

    @api.depends('asset_ids')
    def _compute_asset_count(self):
        for record in self:
            record.asset_count = len(record.asset_ids)

    # ------------------------------------------------------------------
    # Business logic
    # ------------------------------------------------------------------
    def action_activate(self):
        """Set department status to active."""
        self.write({'status': 'active'})
        _logger.info("Department '%s' activated.", self.name)

    def action_deactivate(self):
        """Set department status to inactive."""
        self._check_no_active_employees()
        self.write({'status': 'inactive'})
        _logger.info("Department '%s' deactivated.", self.name)

    def _check_no_active_employees(self):
        """Raise if the department still has active employees."""
        for dept in self:
            active_count = self.env['af.employee'].search_count([
                ('department_id', '=', dept.id),
                ('status', '=', 'active'),
            ])
            if active_count:
                raise ValidationError(
                    f"Cannot deactivate '{dept.name}': "
                    f"it still has {active_count} active employee(s). "
                    "Reassign or deactivate them first."
                )

    # ------------------------------------------------------------------
    # ORM overrides
    # ------------------------------------------------------------------
    @api.constrains('head_id')
    def _check_head_belongs_to_department(self):
        """Department head must belong to this department."""
        for dept in self:
            if dept.head_id and dept.head_id.department_id != dept:
                raise ValidationError(
                    f"Department head '{dept.head_id.name}' must belong "
                    f"to the '{dept.name}' department."
                )
