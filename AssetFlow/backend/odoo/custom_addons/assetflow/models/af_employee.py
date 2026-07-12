# -*- coding: utf-8 -*-
import logging

from odoo import api, fields, models
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
EMPLOYEE_ROLE = [
    ('admin', 'Admin'),
    ('asset_manager', 'Asset Manager'),
    ('department_head', 'Department Head'),
    ('employee', 'Employee'),
]

EMPLOYEE_STATUS = [
    ('active', 'Active'),
    ('inactive', 'Inactive'),
    ('on_leave', 'On Leave'),
]


class AfEmployee(models.Model):
    """Employee record within a department."""

    _name = 'af.employee'
    _description = 'Employee'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'name asc'
    _rec_name = 'name'

    # ------------------------------------------------------------------
    # Fields
    # ------------------------------------------------------------------
    employee_id = fields.Char(
        string='Employee ID',
        readonly=True,
        copy=False,
        index=True,
        default='New',
    )
    name = fields.Char(
        string='Full Name',
        required=True,
        tracking=True,
        index=True,
    )
    email = fields.Char(
        string='Email',
        required=True,
        tracking=True,
        index=True,
    )
    phone = fields.Char(string='Phone')
    department_id = fields.Many2one(
        comodel_name='af.department',
        string='Department',
        required=True,
        tracking=True,
        index=True,
        ondelete='restrict',
    )
    user_id = fields.Many2one(
        comodel_name='res.users',
        string='Odoo User',
        ondelete='set null',
        index=True,
        tracking=True,
    )
    role = fields.Selection(
        selection=EMPLOYEE_ROLE,
        string='Role',
        default='employee',
        required=True,
        tracking=True,
        index=True,
    )
    status = fields.Selection(
        selection=EMPLOYEE_STATUS,
        string='Status',
        default='active',
        required=True,
        tracking=True,
        index=True,
    )
    joining_date = fields.Date(string='Joining Date', required=True)
    notes = fields.Text(string='Notes')

    # Reverse relation
    asset_ids = fields.One2many(
        comodel_name='af.asset',
        inverse_name='employee_id',
        string='Assigned Assets',
    )
    asset_count = fields.Integer(
        string='Assets',
        compute='_compute_asset_count',
        store=True,
    )

    # ------------------------------------------------------------------
    # SQL Constraints
    # ------------------------------------------------------------------
    _sql_constraints = [
        ('unique_employee_id', 'UNIQUE(employee_id)', 'Employee ID must be unique.'),
        ('unique_email', 'UNIQUE(email)', 'Employee email must be unique.'),
    ]

    # ------------------------------------------------------------------
    # Compute methods
    # ------------------------------------------------------------------
    @api.depends('asset_ids')
    def _compute_asset_count(self):
        for record in self:
            record.asset_count = len(record.asset_ids)

    # ------------------------------------------------------------------
    # ORM overrides
    # ------------------------------------------------------------------
    @api.model_create_multi
    def create(self, vals_list):
        """Auto-generate Employee ID (EMP-00001) on creation."""
        for vals in vals_list:
            if vals.get('employee_id', 'New') == 'New':
                vals['employee_id'] = self.env['ir.sequence'].next_by_code(
                    'af.employee.sequence'
                ) or 'New'
        records = super().create(vals_list)
        _logger.info(
            "Created employee(s): %s",
            ', '.join(r.employee_id for r in records),
        )
        return records

    # ------------------------------------------------------------------
    # Business logic
    # ------------------------------------------------------------------
    def action_activate(self):
        self.write({'status': 'active'})

    def action_deactivate(self):
        self._check_no_active_assets()
        self.write({'status': 'inactive'})

    def _check_no_active_assets(self):
        """Raise if the employee still has assets allocated to them."""
        for emp in self:
            active_assets = self.env['af.asset'].search_count([
                ('employee_id', '=', emp.id),
                ('status', 'not in', ['disposed', 'under_maintenance']),
            ])
            if active_assets:
                raise ValidationError(
                    f"Cannot deactivate '{emp.name}': "
                    f"{active_assets} asset(s) still allocated. "
                    "Reallocate or dispose of them first."
                )

    @api.constrains('department_id', 'status')
    def _check_active_department(self):
        """Employee cannot be active in an inactive department."""
        for emp in self:
            if (emp.status == 'active'
                    and emp.department_id.status == 'inactive'):
                raise ValidationError(
                    f"Cannot set '{emp.name}' to active — "
                    f"department '{emp.department_id.name}' is inactive."
                )
