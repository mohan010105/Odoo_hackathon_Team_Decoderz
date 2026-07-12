# -*- coding: utf-8 -*-
import logging

from odoo import api, fields, models
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)

CATEGORY_STATUS = [
    ('active', 'Active'),
    ('inactive', 'Inactive'),
]


class AfAssetCategory(models.Model):
    """Taxonomy for classifying assets (e.g. Laptops, Furniture)."""

    _name = 'af.asset.category'
    _description = 'Asset Category'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'name asc'
    _rec_name = 'name'

    # ------------------------------------------------------------------
    # Fields
    # ------------------------------------------------------------------
    name = fields.Char(
        string='Category Name',
        required=True,
        tracking=True,
        index=True,
    )
    code = fields.Char(
        string='Category Code',
        required=True,
        size=10,
        tracking=True,
        index=True,
    )
    description = fields.Text(string='Description')
    warranty_period = fields.Integer(
        string='Warranty Period (months)',
        default=12,
        help='Default warranty period in months for assets in this category.',
    )
    status = fields.Selection(
        selection=CATEGORY_STATUS,
        string='Status',
        default='active',
        required=True,
        tracking=True,
        index=True,
    )

    # Reverse relation
    asset_ids = fields.One2many(
        comodel_name='af.asset',
        inverse_name='category_id',
        string='Assets',
    )
    asset_count = fields.Integer(
        string='Total Assets',
        compute='_compute_asset_count',
        store=True,
    )

    # ------------------------------------------------------------------
    # SQL Constraints
    # ------------------------------------------------------------------
    _sql_constraints = [
        ('unique_code', 'UNIQUE(code)', 'Category code must be unique.'),
        ('unique_name', 'UNIQUE(name)', 'Category name must be unique.'),
        (
            'positive_warranty',
            'CHECK(warranty_period >= 0)',
            'Warranty period must be a non-negative integer.',
        ),
    ]

    # ------------------------------------------------------------------
    # Compute methods
    # ------------------------------------------------------------------
    @api.depends('asset_ids')
    def _compute_asset_count(self):
        for record in self:
            record.asset_count = len(record.asset_ids)

    # ------------------------------------------------------------------
    # Business logic
    # ------------------------------------------------------------------
    def action_activate(self):
        self.write({'status': 'active'})

    def action_deactivate(self):
        self._check_no_active_assets()
        self.write({'status': 'inactive'})

    def _check_no_active_assets(self):
        for cat in self:
            count = self.env['af.asset'].search_count([
                ('category_id', '=', cat.id),
                ('status', 'not in', ['disposed']),
            ])
            if count:
                raise ValidationError(
                    f"Cannot deactivate '{cat.name}': "
                    f"{count} non-disposed asset(s) still use this category."
                )
