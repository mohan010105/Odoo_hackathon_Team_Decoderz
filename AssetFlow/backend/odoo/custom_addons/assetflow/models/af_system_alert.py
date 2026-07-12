# -*- coding: utf-8 -*-
import logging

from odoo import api, fields, models
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)

ALERT_TYPES = [
    ('overdue_return', 'Overdue Return'),
    ('maintenance_delay', 'Maintenance Delay'),
    ('booking_conflict', 'Booking Conflict'),
    ('audit_pending', 'Audit Pending'),
    ('inactive_asset', 'Inactive Asset'),
    ('license_expiry', 'License Expiry'),
    ('warranty_expiry', 'Warranty Expiry'),
    ('asset_missing', 'Asset Missing'),
    ('asset_damaged', 'Asset Damaged'),
    ('critical_maintenance', 'Critical Maintenance'),
]

ALERT_SEVERITY = [
    ('low', 'Low'),
    ('medium', 'Medium'),
    ('high', 'High'),
    ('critical', 'Critical'),
]

ALERT_STATUS = [
    ('active', 'Active'),
    ('acknowledged', 'Acknowledged'),
    ('resolved', 'Resolved'),
]


class AfSystemAlert(models.Model):
    """Automated system alerts for critical conditions in AssetFlow."""

    _name = 'af.system.alert'
    _description = 'System Alert'
    _order = 'detected_at desc, id desc'
    _rec_name = 'title'

    # ------------------------------------------------------------------
    # Fields
    # ------------------------------------------------------------------
    name = fields.Char(
        string='Alert ID',
        readonly=True,
        copy=False,
        index=True,
        default='New',
    )
    alert_type = fields.Selection(
        selection=ALERT_TYPES,
        string='Alert Type',
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
    severity = fields.Selection(
        selection=ALERT_SEVERITY,
        string='Severity',
        default='medium',
        required=True,
        index=True,
    )
    status = fields.Selection(
        selection=ALERT_STATUS,
        string='Status',
        default='active',
        required=True,
        tracking=True,
        index=True,
    )
    asset_id = fields.Many2one(
        comodel_name='af.asset',
        string='Asset',
        index=True,
        ondelete='set null',
    )
    employee_id = fields.Many2one(
        comodel_name='af.employee',
        string='Employee',
        index=True,
        ondelete='set null',
    )
    department_id = fields.Many2one(
        comodel_name='af.department',
        string='Department',
        index=True,
        ondelete='set null',
    )
    related_record_id = fields.Integer(
        string='Related Record ID',
        index=True,
    )
    related_model = fields.Char(
        string='Related Model',
    )
    detected_at = fields.Datetime(
        string='Detected At',
        default=fields.Datetime.now,
        required=True,
        index=True,
    )
    acknowledged_at = fields.Datetime(
        string='Acknowledged At',
    )
    resolved_at = fields.Datetime(
        string='Resolved At',
    )
    acknowledged_by = fields.Many2one(
        comodel_name='res.users',
        string='Acknowledged By',
    )

    # ------------------------------------------------------------------
    # Computed
    # ------------------------------------------------------------------
    severity_color = fields.Integer(
        string='Severity Color',
        compute='_compute_severity_color',
    )

    # ------------------------------------------------------------------
    # SQL Constraints
    # ------------------------------------------------------------------
    _sql_constraints = [
        ('unique_name', 'UNIQUE(name)', 'Alert ID must be unique.'),
    ]

    # ------------------------------------------------------------------
    # Compute
    # ------------------------------------------------------------------
    def _compute_severity_color(self):
        color_map = {'low': 10, 'medium': 2, 'high': 3, 'critical': 1}
        for rec in self:
            rec.severity_color = color_map.get(rec.severity, 0)

    # ------------------------------------------------------------------
    # ORM Overrides
    # ------------------------------------------------------------------
    @api.model_create_multi
    def create(self, vals_list):
        """Auto-generate alert ID (ALT-000001) on creation."""
        for vals in vals_list:
            if vals.get('name', 'New') == 'New':
                vals['name'] = self.env['ir.sequence'].next_by_code(
                    'af.system.alert.sequence'
                ) or 'New'
        records = super().create(vals_list)
        _logger.info(
            "Created %d system alert(s): %s",
            len(records),
            ', '.join(r.name for r in records),
        )
        return records

    # ------------------------------------------------------------------
    # Business Logic
    # ------------------------------------------------------------------
    def action_acknowledge(self):
        """Acknowledge an active alert."""
        self.ensure_one()
        if self.status != 'active':
            raise ValidationError("Only active alerts can be acknowledged.")
        self.write({
            'status': 'acknowledged',
            'acknowledged_at': fields.Datetime.now(),
            'acknowledged_by': self.env.user.id,
        })
        return True

    def action_resolve(self):
        """Resolve an alert."""
        self.ensure_one()
        if self.status == 'resolved':
            raise ValidationError("Alert is already resolved.")
        self.write({
            'status': 'resolved',
            'resolved_at': fields.Datetime.now(),
        })
        return True

    @api.model
    def scan_overdue_returns(self):
        """Scan for overdue asset returns and create alerts."""
        today = fields.Date.today()
        overdue_allocations = self.env['af.asset.allocation'].search([
            ('status', '=', 'allocated'),
            ('expected_return_date', '<', today),
        ])
        created = 0
        for alloc in overdue_allocations:
            # Avoid duplicate alerts
            existing = self.search_count([
                ('alert_type', '=', 'overdue_return'),
                ('related_record_id', '=', alloc.id),
                ('related_model', '=', 'af.asset.allocation'),
                ('status', '!=', 'resolved'),
            ])
            if not existing:
                self.create({
                    'alert_type': 'overdue_return',
                    'title': f"Overdue Return: {alloc.asset_id.display_name}",
                    'description': (
                        f"Asset {alloc.asset_id.display_name} allocated to "
                        f"{alloc.employee_id.name} was expected to be returned "
                        f"on {alloc.expected_return_date}. It is now overdue."
                    ),
                    'severity': 'high',
                    'asset_id': alloc.asset_id.id,
                    'employee_id': alloc.employee_id.id,
                    'department_id': alloc.department_id.id,
                    'related_record_id': alloc.id,
                    'related_model': 'af.asset.allocation',
                })
                created += 1
        _logger.info("Overdue return scan: %d new alerts created.", created)
        return created

    @api.model
    def scan_inactive_assets(self):
        """Scan for assets under maintenance for extended periods."""
        from datetime import timedelta
        cutoff = fields.Date.today() - timedelta(days=30)
        # Find assets that have been under maintenance status
        stale = self.env['af.asset'].search([
            ('status', '=', 'under_maintenance'),
            ('write_date', '<', fields.Datetime.to_string(
                fields.Datetime.from_string(str(cutoff) + ' 00:00:00')
            )),
        ])
        created = 0
        for asset in stale:
            existing = self.search_count([
                ('alert_type', '=', 'inactive_asset'),
                ('related_record_id', '=', asset.id),
                ('related_model', '=', 'af.asset'),
                ('status', '!=', 'resolved'),
            ])
            if not existing:
                self.create({
                    'alert_type': 'inactive_asset',
                    'title': f"Extended Maintenance: {asset.display_name}",
                    'description': (
                        f"Asset {asset.display_name} has been under maintenance "
                        f"for more than 30 days."
                    ),
                    'severity': 'medium',
                    'asset_id': asset.id,
                    'department_id': asset.department_id.id if asset.department_id else False,
                    'related_record_id': asset.id,
                    'related_model': 'af.asset',
                })
                created += 1
        _logger.info("Inactive asset scan: %d new alerts created.", created)
        return created

    @api.model
    def scan_warranty_expiry(self):
        """Scan for assets whose warranty is expiring within 30 days."""
        from datetime import timedelta
        from dateutil.relativedelta import relativedelta
        today = fields.Date.today()
        warning_horizon = today + timedelta(days=30)

        assets = self.env['af.asset'].search([
            ('status', 'not in', ['disposed']),
            ('purchase_date', '!=', False),
            ('category_id', '!=', False),
        ])
        created = 0
        for asset in assets:
            if not asset.category_id.warranty_period:
                continue
            warranty_end = asset.purchase_date + relativedelta(
                months=asset.category_id.warranty_period
            )
            if today <= warranty_end <= warning_horizon:
                existing = self.search_count([
                    ('alert_type', '=', 'warranty_expiry'),
                    ('related_record_id', '=', asset.id),
                    ('related_model', '=', 'af.asset'),
                    ('status', '!=', 'resolved'),
                ])
                if not existing:
                    self.create({
                        'alert_type': 'warranty_expiry',
                        'title': f"Warranty Expiring: {asset.display_name}",
                        'description': (
                            f"Warranty for asset {asset.display_name} "
                            f"(category: {asset.category_id.name}) expires on "
                            f"{warranty_end}. Consider renewal or replacement."
                        ),
                        'severity': 'medium',
                        'asset_id': asset.id,
                        'department_id': asset.department_id.id if asset.department_id else False,
                        'related_record_id': asset.id,
                        'related_model': 'af.asset',
                    })
                    created += 1
        _logger.info("Warranty expiry scan: %d new alerts created.", created)
        return created

    @api.model
    def scan_maintenance_delay(self):
        """Scan for assets under maintenance for more than 14 days (shorter threshold than inactive)."""
        from datetime import timedelta
        cutoff = fields.Date.today() - timedelta(days=14)
        stale = self.env['af.asset'].search([
            ('status', '=', 'under_maintenance'),
            ('write_date', '<', fields.Datetime.to_string(
                fields.Datetime.from_string(str(cutoff) + ' 00:00:00')
            )),
        ])
        created = 0
        for asset in stale:
            existing = self.search_count([
                ('alert_type', '=', 'maintenance_delay'),
                ('related_record_id', '=', asset.id),
                ('related_model', '=', 'af.asset'),
                ('status', '!=', 'resolved'),
            ])
            if not existing:
                self.create({
                    'alert_type': 'maintenance_delay',
                    'title': f"Maintenance Delay: {asset.display_name}",
                    'description': (
                        f"Asset {asset.display_name} has been under maintenance "
                        f"for more than 14 days. Please review and expedite."
                    ),
                    'severity': 'high',
                    'asset_id': asset.id,
                    'department_id': asset.department_id.id if asset.department_id else False,
                    'related_record_id': asset.id,
                    'related_model': 'af.asset',
                })
                created += 1
        _logger.info("Maintenance delay scan: %d new alerts created.", created)
        return created

    @api.model
    def run_all_scans(self):
        """Run all alert scans — called by scheduled action."""
        _logger.info("Running all system alert scans...")
        results = {
            'overdue_returns': self.scan_overdue_returns(),
            'inactive_assets': self.scan_inactive_assets(),
            'warranty_expiry': self.scan_warranty_expiry(),
            'maintenance_delay': self.scan_maintenance_delay(),
        }
        total = sum(results.values())
        _logger.info("System alert scan complete: %d total new alerts.", total)
        return results

