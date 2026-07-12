# -*- coding: utf-8 -*-
"""Tests for Activity Center, Notification Center, and Approvals."""
from odoo.tests.common import TransactionCase
from odoo.exceptions import ValidationError
from odoo import fields


class TestActivityCenter(TransactionCase):
    """Unit tests for the Unified Activity Center & Notification Hub."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Asset = cls.env['af.asset']
        cls.dept = cls.env['af.department'].create({
            'name': 'Activity Test Dept', 'code': 'ACTDT',
        })
        cls.cat = cls.env['af.asset.category'].create({
            'name': 'Activity Test Cat', 'code': 'ACTCAT',
        })
        # Create a test employee with user linked
        cls.test_user = cls.env['res.users'].create({
            'name': 'Activity User',
            'login': 'actuser',
            'email': 'actuser@test.com',
            'groups_id': [(4, cls.env.ref('assetflow.group_assetflow_employee').id)],
        })
        cls.employee = cls.env['af.employee'].create({
            'name': 'Activity Emp',
            'email': 'actuser@test.com',
            'department_id': cls.dept.id,
            'role': 'employee',
            'status': 'active',
            'joining_date': '2020-01-01',
            'user_id': cls.test_user.id,
        })
        # Another user for manager
        cls.manager_user = cls.env['res.users'].create({
            'name': 'Activity Manager',
            'login': 'actmanager',
            'email': 'actmgr@test.com',
            'groups_id': [(4, cls.env.ref('assetflow.group_assetflow_manager').id)],
        })

    def _make_asset(self, name='Test Asset'):
        return self.Asset.create({
            'name': name,
            'category_id': self.cat.id,
            'department_id': self.dept.id,
            'purchase_date': '2022-01-01',
            'purchase_cost': 1000.0,
            'status': 'available',
        })

    # ------------------------------------------------------------------
    # Activity Generation
    # ------------------------------------------------------------------
    def test_activity_logged_on_asset_creation(self):
        """Test that an activity is automatically logged when an asset is created."""
        asset = self._make_asset('Asset for Activity Log')
        activity = self.env['af.activity'].search([
            ('asset_id', '=', asset.id),
            ('activity_type', '=', 'asset_created'),
        ])
        self.assertTrue(activity)
        self.assertEqual(activity.title, f"Asset Created: {asset.display_name}")

    def test_activity_logged_on_status_change(self):
        """Test that activity is logged when asset status changes."""
        asset = self._make_asset('Asset status log')
        asset.write({'status': 'under_maintenance'})
        activity = self.env['af.activity'].search([
            ('asset_id', '=', asset.id),
            ('activity_type', '=', 'asset_updated'),
        ], limit=1)
        self.assertTrue(activity)
        self.assertIn("under_maintenance", activity.description)

    def test_activity_immutability(self):
        """Test that activity history cannot be deleted."""
        asset = self._make_asset('Asset immutable')
        activity = self.env['af.activity'].search([('asset_id', '=', asset.id)], limit=1)
        self.assertTrue(activity)
        with self.assertRaises(ValidationError):
            activity.unlink()

    # ------------------------------------------------------------------
    # Notification Flow
    # ------------------------------------------------------------------
    def test_notification_creation_and_read(self):
        """Test sending a notification and marking it as read."""
        notif = self.env['af.notification'].create({
            'recipient_id': self.test_user.id,
            'title': 'Test Notification',
            'description': 'Details here',
            'category': 'info',
            'priority': 'medium',
        })
        self.assertEqual(notif.status, 'unread')

        # Mark read
        notif.action_mark_read()
        self.assertEqual(notif.status, 'read')
        self.assertTrue(notif.read_time)

    # ------------------------------------------------------------------
    # Approval Flow
    # ------------------------------------------------------------------
    def test_approval_created_on_transfer_request(self):
        """Test that a transfer request automatically creates a pending approval in the Approval Center."""
        asset = self._make_asset('Transfer Asset')
        # Assign first so it's allocated
        self.env['af.asset.allocation'].create({
            'asset_id': asset.id,
            'employee_id': self.employee.id,
            'expected_return_date': '2023-12-31',
            'status': 'allocated',
        })
        # Set asset status to allocated
        asset.write({'status': 'allocated', 'employee_id': self.employee.id})

        # Another employee
        emp2 = self.env['af.employee'].create({
            'name': 'Target Employee',
            'email': 'target@test.com',
            'department_id': self.dept.id,
            'role': 'employee',
            'status': 'active',
            'joining_date': '2020-01-01',
        })

        transfer = self.env['af.transfer.request'].create({
            'asset_id': asset.id,
            'requested_employee_id': emp2.id,
            'reason': 'Need laptop for project',
        })

        # Check approval record exists and is pending
        approval = self.env['af.approval'].search([
            ('related_model', '=', 'af.transfer.request'),
            ('related_record_id', '=', transfer.id),
        ])
        self.assertTrue(approval)
        self.assertEqual(approval.status, 'pending')

        # Approve the approval record
        approval.action_approve()
        self.assertEqual(approval.status, 'approved')
        self.assertEqual(transfer.status, 'approved')

    # ------------------------------------------------------------------
    # System Alert Scan
    # ------------------------------------------------------------------
    def test_overdue_return_alerts(self):
        """Test scanning for overdue allocations generates high-severity system alerts."""
        asset = self._make_asset('Alert laptop')
        # Set allocation dates in the past
        alloc = self.env['af.asset.allocation'].create({
            'asset_id': asset.id,
            'employee_id': self.employee.id,
            'allocation_date': '2023-01-01',
            'expected_return_date': '2023-01-10',
            'status': 'allocated',
        })
        asset.write({'status': 'allocated', 'employee_id': self.employee.id})

        # Scan for overdue
        self.env['af.system.alert'].scan_overdue_returns()

        # Check alert created
        alert = self.env['af.system.alert'].search([
            ('related_model', '=', 'af.asset.allocation'),
            ('related_record_id', '=', alloc.id),
        ])
        self.assertTrue(alert)
        self.assertEqual(alert.alert_type, 'overdue_return')
        self.assertEqual(alert.severity, 'high')
