# -*- coding: utf-8 -*-
import logging

from odoo import api, fields, models
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)


class AfAssetAllocation(models.Model):
    """Transaction model tracking asset allocations to employees and departments."""

    _name = 'af.asset.allocation'
    _description = 'Asset Allocation'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'name desc'

    name = fields.Char(
        string='Allocation Number',
        readonly=True,
        copy=False,
        index=True,
        default='New',
    )
    asset_id = fields.Many2one(
        comodel_name='af.asset',
        string='Asset',
        required=True,
        tracking=True,
        index=True,
    )
    employee_id = fields.Many2one(
        comodel_name='af.employee',
        string='Employee',
        required=True,
        tracking=True,
        index=True,
    )
    department_id = fields.Many2one(
        comodel_name='af.department',
        string='Department',
        compute='_compute_department_id',
        store=True,
        readonly=False,
        required=True,
        tracking=True,
        index=True,
    )
    allocation_date = fields.Date(
        string='Allocation Date',
        required=True,
        default=fields.Date.today,
        tracking=True,
    )
    expected_return_date = fields.Date(
        string='Expected Return Date',
        required=True,
        tracking=True,
    )
    actual_return_date = fields.Date(
        string='Actual Return Date',
        tracking=True,
    )
    status = fields.Selection(
        selection=[
            ('draft', 'Draft'),
            ('allocated', 'Allocated'),
            ('returned', 'Returned'),
            ('cancelled', 'Cancelled'),
        ],
        string='Status',
        default='draft',
        required=True,
        tracking=True,
        index=True,
    )
    remarks = fields.Text(string='Remarks')

    created_by = fields.Many2one(
        comodel_name='res.users',
        string='Created By',
        default=lambda self: self.env.user,
        readonly=True,
    )
    created_on = fields.Datetime(
        string='Created On',
        default=fields.Datetime.now,
        readonly=True,
    )
    updated_on = fields.Datetime(
        string='Updated On',
        default=fields.Datetime.now,
        readonly=True,
    )

    @api.depends('employee_id')
    def _compute_department_id(self):
        for record in self:
            if record.employee_id:
                record.department_id = record.employee_id.department_id

    @api.constrains('allocation_date', 'expected_return_date')
    def _check_dates(self):
        for rec in self:
            if rec.allocation_date and rec.expected_return_date:
                if rec.expected_return_date <= rec.allocation_date:
                    raise ValidationError("Expected Return Date must always be after Allocation Date.")

    @api.constrains('employee_id')
    def _check_employee_active(self):
        for rec in self:
            if rec.employee_id and rec.employee_id.status != 'active':
                raise ValidationError(f"Inactive Employee '{rec.employee_id.name}' cannot receive assets.")

    @api.constrains('department_id')
    def _check_department_active(self):
        for rec in self:
            if rec.department_id and rec.department_id.status != 'active':
                raise ValidationError(f"Inactive Department '{rec.department_id.name}' cannot receive assets.")

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'New') == 'New':
                vals['name'] = self.env['ir.sequence'].next_by_code('af.asset.allocation.sequence') or 'New'
        return super().create(vals_list)

    def write(self, vals):
        vals['updated_on'] = fields.Datetime.now()
        return super().write(vals)

    def action_allocate(self):
        self.ensure_one()
        if self.status != 'draft':
            raise ValidationError("Only allocations in 'Draft' status can be allocated.")
        
        # Check asset status
        if self.asset_id.status != 'available':
            raise ValidationError(f"Only assets with status 'Available' can be allocated. Current asset status is '{self.asset_id.status}'.")

        # Double check active constraints
        if self.employee_id.status != 'active':
            raise ValidationError(f"Employee '{self.employee_id.name}' is inactive.")
        if self.department_id.status != 'active':
            raise ValidationError(f"Department '{self.department_id.name}' is inactive.")

        # Check duplicate allocation
        dup = self.env['af.asset.allocation'].search_count([
            ('asset_id', '=', self.asset_id.id),
            ('status', '=', 'allocated'),
            ('id', '!=', self.id),
        ])
        if dup:
            raise ValidationError("This asset is already allocated under another active allocation.")

        # Perform allocation
        self.write({'status': 'allocated'})
        self.asset_id.write({
            'employee_id': self.employee_id.id,
            'department_id': self.department_id.id,
            'status': 'allocated',
        })

        # Log history
        self.env['af.allocation.history'].create({
            'asset_id': self.asset_id.id,
            'employee_id': self.employee_id.id,
            'department_id': self.department_id.id,
            'action': 'allocate',
            'old_status': 'available',
            'new_status': 'allocated',
        })

        # Log Activity & Notification
        from ..services.activity_service import ActivityService
        notify_users = [self.employee_id.user_id.id] if self.employee_id.user_id else []
        ActivityService(self.env).log_activity(
            activity_type='asset_allocated',
            module='allocation',
            title=f"Asset Allocated: {self.asset_id.display_name}",
            description=f"Asset {self.asset_id.display_name} has been allocated to {self.employee_id.name}.",
            asset_id=self.asset_id.id,
            employee_id=self.employee_id.id,
            department_id=self.department_id.id,
            priority='medium',
            related_record_id=self.id,
            related_model='af.asset.allocation',
            notify_users=notify_users,
            notification_category='success',
        )
        return True

    def action_return(self):
        self.ensure_one()
        if self.status != 'allocated':
            raise ValidationError("Only 'Allocated' assets can be returned.")

        self.write({
            'status': 'returned',
            'actual_return_date': fields.Date.today(),
        })

        # Log history before changing status on asset
        self.env['af.allocation.history'].create({
            'asset_id': self.asset_id.id,
            'employee_id': self.employee_id.id,
            'department_id': self.department_id.id,
            'action': 'return',
            'old_status': 'allocated',
            'new_status': 'available',
        })

        # Log Activity & Notification
        from ..services.activity_service import ActivityService
        notify_users = [self.employee_id.user_id.id] if self.employee_id.user_id else []
        ActivityService(self.env).log_activity(
            activity_type='asset_returned',
            module='allocation',
            title=f"Asset Returned: {self.asset_id.display_name}",
            description=f"Asset {self.asset_id.display_name} allocated to {self.employee_id.name} has been returned.",
            asset_id=self.asset_id.id,
            employee_id=self.employee_id.id,
            department_id=self.department_id.id,
            priority='medium',
            related_record_id=self.id,
            related_model='af.asset.allocation',
            notify_users=notify_users,
            notification_category='info',
        )

        # Update asset status
        self.asset_id.write({
            'employee_id': False,
            'status': 'available',
        })
        return True

    def action_cancel(self):
        self.ensure_one()
        if self.status not in ['draft', 'allocated']:
            raise ValidationError("Only allocations in 'Draft' or 'Allocated' status can be cancelled.")

        old_status = self.status
        self.write({'status': 'cancelled'})

        if old_status == 'allocated':
            # Revert asset status
            self.asset_id.write({
                'employee_id': False,
                'status': 'available',
            })
            self.env['af.allocation.history'].create({
                'asset_id': self.asset_id.id,
                'employee_id': self.employee_id.id,
                'department_id': self.department_id.id,
                'action': 'cancel',
                'old_status': 'allocated',
                'new_status': 'available',
            })
        return True
