# -*- coding: utf-8 -*-
import logging

from odoo import api, fields, models
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)


class AfTransferRequest(models.Model):
    """Model representing a transfer request for an allocated asset between employees."""

    _name = 'af.transfer.request'
    _description = 'Transfer Request'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'name desc'

    name = fields.Char(
        string='Transfer Number',
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
    current_holder_id = fields.Many2one(
        comodel_name='af.employee',
        string='Current Holder',
        compute='_compute_current_holder_id',
        store=True,
        readonly=True,
        index=True,
    )
    requested_employee_id = fields.Many2one(
        comodel_name='af.employee',
        string='Requested Employee',
        required=True,
        tracking=True,
        index=True,
    )
    requested_department_id = fields.Many2one(
        comodel_name='af.department',
        string='Requested Department',
        compute='_compute_requested_department_id',
        store=True,
        readonly=False,
        required=True,
        tracking=True,
        index=True,
    )
    reason = fields.Text(
        string='Reason for Transfer',
        required=True,
    )
    request_date = fields.Date(
        string='Request Date',
        required=True,
        default=fields.Date.today,
        tracking=True,
    )
    status = fields.Selection(
        selection=[
            ('pending', 'Pending Approval'),
            ('approved', 'Approved'),
            ('rejected', 'Rejected'),
            ('completed', 'Completed'),
            ('cancelled', 'Cancelled'),
        ],
        string='Approval Status',
        default='pending',
        required=True,
        tracking=True,
        index=True,
    )
    remarks = fields.Text(string='Remarks')

    @api.depends('asset_id')
    def _compute_current_holder_id(self):
        for record in self:
            record.current_holder_id = record.asset_id.employee_id if record.asset_id else False

    @api.depends('requested_employee_id')
    def _compute_requested_department_id(self):
        for record in self:
            if record.requested_employee_id:
                record.requested_department_id = record.requested_employee_id.department_id

    @api.constrains('asset_id', 'requested_employee_id')
    def _check_transfer_rules(self):
        for rec in self:
            if rec.asset_id and rec.asset_id.status != 'allocated':
                raise ValidationError("Only allocated assets may be transferred.")
            if rec.requested_employee_id and rec.requested_employee_id.status != 'active':
                raise ValidationError("Only active employees may receive transfers.")
            if rec.requested_employee_id and rec.current_holder_id and rec.requested_employee_id == rec.current_holder_id:
                raise ValidationError("Transfer source and target employees cannot be the same.")
            if rec.requested_department_id and rec.requested_department_id.status != 'active':
                raise ValidationError("Only active departments may receive transfers.")
            if not rec.reason or not rec.reason.strip():
                raise ValidationError("Reason for transfer cannot be empty.")

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'New') == 'New':
                vals['name'] = self.env['ir.sequence'].next_by_code('af.transfer.request.sequence') or 'New'
        records = super().create(vals_list)
        # Log Activity & Create Approval Center Record
        from ..services.activity_service import ActivityService
        activity_srv = ActivityService(self.env)
        for record in records:
            activity_srv.log_activity(
                activity_type='transfer_requested',
                module='transfer',
                title=f"Transfer Requested: {record.asset_id.display_name}",
                description=f"Transfer request for asset {record.asset_id.display_name} from {record.current_holder_id.name if record.current_holder_id else 'N/A'} to {record.requested_employee_id.name} is pending approval.",
                asset_id=record.asset_id.id,
                employee_id=record.requested_employee_id.id,
                department_id=record.requested_department_id.id,
                priority='medium',
                related_record_id=record.id,
                related_model='af.transfer.request',
            )
            # Create Approval Center Record
            self.env['af.approval'].sudo().create({
                'approval_type': 'transfer',
                'title': f"Transfer Request: {record.name}",
                'description': f"Request to transfer asset {record.asset_id.display_name} to {record.requested_employee_id.name}. Reason: {record.reason}",
                'requested_by': record.create_uid.id or self.env.user.id,
                'department_id': record.requested_department_id.id,
                'asset_id': record.asset_id.id,
                'priority': 'medium',
                'status': 'pending',
                'related_record_id': record.id,
                'related_model': 'af.transfer.request',
            })
        return records

    def action_approve(self):
        self.ensure_one()
        if self.status != 'pending':
            raise ValidationError("Only pending requests can be approved.")
        self.write({'status': 'approved'})

        # Synchronize corresponding approval record
        approval = self.env['af.approval'].sudo().search([
            ('related_model', '=', 'af.transfer.request'),
            ('related_record_id', '=', self.id),
            ('status', '=', 'pending'),
        ], limit=1)
        if approval:
            approval.write({
                'status': 'approved',
                'response_date': fields.Datetime.now(),
            })

        # Log Activity & Notification
        from ..services.activity_service import ActivityService
        notify_users = []
        if self.requested_employee_id.user_id:
            notify_users.append(self.requested_employee_id.user_id.id)
        if self.current_holder_id and self.current_holder_id.user_id:
            notify_users.append(self.current_holder_id.user_id.id)
        ActivityService(self.env).log_activity(
            activity_type='transfer_approved',
            module='transfer',
            title=f"Transfer Approved: {self.name}",
            description=f"Transfer request for asset {self.asset_id.display_name} to {self.requested_employee_id.name} has been approved.",
            asset_id=self.asset_id.id,
            employee_id=self.requested_employee_id.id,
            department_id=self.requested_department_id.id,
            priority='medium',
            related_record_id=self.id,
            related_model='af.transfer.request',
            notify_users=notify_users,
            notification_category='success',
        )
        return True

    def action_reject(self):
        self.ensure_one()
        if self.status != 'pending':
            raise ValidationError("Only pending requests can be rejected.")
        self.write({'status': 'rejected'})

        # Synchronize corresponding approval record
        approval = self.env['af.approval'].sudo().search([
            ('related_model', '=', 'af.transfer.request'),
            ('related_record_id', '=', self.id),
            ('status', '=', 'pending'),
        ], limit=1)
        if approval:
            approval.write({
                'status': 'rejected',
                'response_date': fields.Datetime.now(),
            })

        # Log Activity & Notification
        from ..services.activity_service import ActivityService
        notify_users = []
        if self.requested_employee_id.user_id:
            notify_users.append(self.requested_employee_id.user_id.id)
        ActivityService(self.env).log_activity(
            activity_type='transfer_rejected',
            module='transfer',
            title=f"Transfer Rejected: {self.name}",
            description=f"Transfer request for asset {self.asset_id.display_name} to {self.requested_employee_id.name} has been rejected.",
            asset_id=self.asset_id.id,
            employee_id=self.requested_employee_id.id,
            department_id=self.requested_department_id.id,
            priority='medium',
            related_record_id=self.id,
            related_model='af.transfer.request',
            notify_users=notify_users,
            notification_category='warning',
        )
        return True

    def action_cancel(self):
        self.ensure_one()
        if self.status not in ['pending', 'approved']:
            raise ValidationError("Only pending or approved requests can be cancelled.")
        self.write({'status': 'cancelled'})
        return True

    def action_complete(self):
        self.ensure_one()
        if self.status != 'approved':
            raise ValidationError("Only approved requests can be completed.")
        
        # Verify target constraints are still valid
        if self.requested_employee_id.status != 'active':
            raise ValidationError(f"Requested employee '{self.requested_employee_id.name}' is inactive.")
        if self.requested_department_id.status != 'active':
            raise ValidationError(f"Requested department '{self.requested_department_id.name}' is inactive.")
        if self.asset_id.status != 'allocated':
            raise ValidationError("Asset is no longer allocated.")

        # Update historical allocation
        old_allocation = self.env['af.asset.allocation'].search([
            ('asset_id', '=', self.asset_id.id),
            ('status', '=', 'allocated'),
        ], limit=1)
        
        if old_allocation:
            old_allocation.write({
                'status': 'returned',
                'actual_return_date': fields.Date.today(),
                'remarks': f"Asset transferred to {self.requested_employee_id.name} (Ref: {self.name})",
            })

        # Create new allocation
        self.env['af.asset.allocation'].create({
            'asset_id': self.asset_id.id,
            'employee_id': self.requested_employee_id.id,
            'department_id': self.requested_department_id.id,
            'allocation_date': fields.Date.today(),
            'expected_return_date': old_allocation.expected_return_date if old_allocation else fields.Date.today(),
            'status': 'allocated',
            'remarks': f"Transferred from {self.current_holder_id.name if self.current_holder_id else 'N/A'} (Ref: {self.name})",
        })

        # Log history before changing holder
        self.env['af.allocation.history'].create({
            'asset_id': self.asset_id.id,
            'employee_id': self.requested_employee_id.id,
            'department_id': self.requested_department_id.id,
            'action': 'transfer',
            'old_status': 'allocated',
            'new_status': 'allocated',
        })

        # Write to Asset
        self.asset_id.write({
            'employee_id': self.requested_employee_id.id,
            'department_id': self.requested_department_id.id,
        })

        self.write({'status': 'completed'})
        return True
