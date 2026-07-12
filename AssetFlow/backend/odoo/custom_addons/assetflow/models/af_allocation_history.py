# -*- coding: utf-8 -*-
import logging

from odoo import api, fields, models
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)


class AfAllocationHistory(models.Model):
    """Immutable audit trail for asset allocations and transfers."""

    _name = 'af.allocation.history'
    _description = 'Asset Allocation History'
    _order = 'timestamp desc'
    _rec_name = 'action'

    asset_id = fields.Many2one(
        comodel_name='af.asset',
        string='Asset',
        required=True,
        ondelete='cascade',
        index=True,
    )
    employee_id = fields.Many2one(
        comodel_name='af.employee',
        string='Employee',
        ondelete='restrict',
        index=True,
    )
    department_id = fields.Many2one(
        comodel_name='af.department',
        string='Department',
        ondelete='restrict',
        index=True,
    )
    action = fields.Char(
        string='Action',
        required=True,
        index=True,
    )
    user_id = fields.Many2one(
        comodel_name='res.users',
        string='Performed By',
        default=lambda self: self.env.user,
        required=True,
    )
    timestamp = fields.Datetime(
        string='Timestamp',
        default=fields.Datetime.now,
        required=True,
        index=True,
    )
    old_status = fields.Char(string='Old Status')
    new_status = fields.Char(string='New Status')

    def unlink(self):
        """Enforce business rule: history logs must never be deleted."""
        raise ValidationError("Audit logs and allocation history cannot be deleted.")
