# -*- coding: utf-8 -*-
"""Tests for Activity Center, Notification Center, Approvals, and System Alerts."""
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
    # Activity Status Transitions
    # ------------------------------------------------------------------
    def test_activity_mark_read_and_archive(self):
        """Test marking activities as read and then archiving them."""
        asset = self._make_asset('Read archive test')
        activity = self.env['af.activity'].search([
            ('asset_id', '=', asset.id),
        ], limit=1)
        self.assertTrue(activity)
        self.assertEqual(activity.status, 'unread')

        # Mark as read
        activity.action_mark_read()
        self.assertEqual(activity.status, 'read')

        # Mark back as unread
        activity.action_mark_unread()
        self.assertEqual(activity.status, 'unread')

        # Mark as read again and archive
        activity.action_mark_read()
        activity.action_archive()
        self.assertEqual(activity.status, 'archived')

    def test_activity_date_group_computed(self):
        """Test that date_group is computed correctly for today's activities."""
        asset = self._make_asset('Date group test')
        activity = self.env['af.activity'].search([
            ('asset_id', '=', asset.id),
        ], limit=1)
        self.assertTrue(activity)
        self.assertEqual(activity.date_group, 'Today')

    def test_activity_auto_id_sequence(self):
        """Test that activity IDs are auto-generated with ACT- prefix."""
        asset = self._make_asset('Seq test')
        activity = self.env['af.activity'].search([
            ('asset_id', '=', asset.id),
        ], limit=1)
        self.assertTrue(activity.name)
        self.assertTrue(activity.name.startswith('ACT-'))

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

    def test_notification_mark_all_read(self):
        """Test marking all notifications as read for a user."""
        # Create several unread notifications
        for i in range(3):
            self.env['af.notification'].create({
                'recipient_id': self.test_user.id,
                'title': f'Notif {i}',
                'category': 'info',
                'priority': 'medium',
            })
        unread_count = self.env['af.notification'].search_count([
            ('recipient_id', '=', self.test_user.id),
            ('status', '=', 'unread'),
        ])
        self.assertGreaterEqual(unread_count, 3)

        # Mark all read
        self.env['af.notification'].with_user(self.test_user).action_mark_all_read()
        unread_after = self.env['af.notification'].search_count([
            ('recipient_id', '=', self.test_user.id),
            ('status', '=', 'unread'),
        ])
        self.assertEqual(unread_after, 0)

    def test_notification_archive(self):
        """Test archiving a notification."""
        notif = self.env['af.notification'].create({
            'recipient_id': self.test_user.id,
            'title': 'Archive Test',
            'category': 'warning',
            'priority': 'high',
        })
        notif.action_archive()
        self.assertEqual(notif.status, 'archived')

    def test_notification_auto_id_sequence(self):
        """Test that notification IDs use NTF- prefix."""
        notif = self.env['af.notification'].create({
            'recipient_id': self.test_user.id,
            'title': 'Seq test',
            'category': 'info',
            'priority': 'low',
        })
        self.assertTrue(notif.name.startswith('NTF-'))

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

    def test_approval_reject(self):
        """Test rejecting an approval record."""
        approval = self.env['af.approval'].create({
            'approval_type': 'transfer',
            'title': 'Test Reject Approval',
            'description': 'Testing rejection flow',
            'priority': 'medium',
        })
        self.assertEqual(approval.status, 'pending')
        approval.action_reject()
        self.assertEqual(approval.status, 'rejected')
        self.assertTrue(approval.response_date)

    def test_approval_bulk_operations(self):
        """Test bulk approve/reject of multiple approvals."""
        approvals = self.env['af.approval']
        for i in range(3):
            approvals |= self.env['af.approval'].create({
                'approval_type': 'maintenance',
                'title': f'Bulk Test {i}',
                'priority': 'low',
            })
        # Bulk approve
        approvals.action_bulk_approve()
        for a in approvals:
            self.assertEqual(a.status, 'approved')

    def test_approval_cannot_approve_non_pending(self):
        """Test that non-pending approvals cannot be approved."""
        approval = self.env['af.approval'].create({
            'approval_type': 'booking',
            'title': 'Already approved',
            'priority': 'medium',
        })
        approval.action_approve()
        with self.assertRaises(ValidationError):
            approval.action_approve()

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

    def test_system_alert_acknowledge_and_resolve(self):
        """Test the full lifecycle of a system alert: active → acknowledged → resolved."""
        alert = self.env['af.system.alert'].create({
            'alert_type': 'asset_damaged',
            'title': 'Lifecycle Test Alert',
            'description': 'Testing alert lifecycle',
            'severity': 'medium',
        })
        self.assertEqual(alert.status, 'active')

        alert.action_acknowledge()
        self.assertEqual(alert.status, 'acknowledged')
        self.assertTrue(alert.acknowledged_at)
        self.assertTrue(alert.acknowledged_by)

        alert.action_resolve()
        self.assertEqual(alert.status, 'resolved')
        self.assertTrue(alert.resolved_at)

    def test_system_alert_duplicate_prevention(self):
        """Test that duplicate alerts are not created for the same condition."""
        asset = self._make_asset('Dedup test')
        alloc = self.env['af.asset.allocation'].create({
            'asset_id': asset.id,
            'employee_id': self.employee.id,
            'allocation_date': '2023-01-01',
            'expected_return_date': '2023-01-10',
            'status': 'allocated',
        })
        asset.write({'status': 'allocated', 'employee_id': self.employee.id})

        # Run twice
        count1 = self.env['af.system.alert'].scan_overdue_returns()
        count2 = self.env['af.system.alert'].scan_overdue_returns()

        # Second scan should not create duplicates
        alerts = self.env['af.system.alert'].search([
            ('related_model', '=', 'af.asset.allocation'),
            ('related_record_id', '=', alloc.id),
            ('alert_type', '=', 'overdue_return'),
        ])
        self.assertEqual(len(alerts), 1)

    # ------------------------------------------------------------------
    # Dashboard Service
    # ------------------------------------------------------------------
    def test_dashboard_service_kpis(self):
        """Test that dashboard service returns correct KPI structure."""
        from ..services.dashboard_service import DashboardService
        service = DashboardService(self.env)
        kpis = service.get_kpis()

        # All expected keys must be present
        expected_keys = [
            'total_assets', 'available', 'allocated', 'under_maintenance',
            'disposed', 'total_departments', 'active_departments',
            'total_employees', 'active_employees',
            'unread_notifications', 'pending_approvals',
            'critical_alerts', 'unread_activities', 'today_activities',
        ]
        for key in expected_keys:
            self.assertIn(key, kpis, f"Missing KPI key: {key}")
            self.assertIsInstance(kpis[key], int, f"KPI '{key}' should be int")

    # ------------------------------------------------------------------
    # Activity Service Timeline
    # ------------------------------------------------------------------
    def test_activity_service_timeline_query(self):
        """Test the activity service timeline returns paginated results."""
        from ..services.activity_service import ActivityService
        # Create a few activities via asset creation
        for i in range(3):
            self._make_asset(f'Timeline asset {i}')

        service = ActivityService(self.env)
        result = service.get_timeline(page=1, limit=10)

        self.assertIn('records', result)
        self.assertIn('total', result)
        self.assertIn('page', result)
        self.assertIn('pages', result)
        self.assertGreaterEqual(result['total'], 3)
        self.assertEqual(result['page'], 1)

    def test_activity_service_timeline_with_filters(self):
        """Test the activity service timeline supports filtering."""
        from ..services.activity_service import ActivityService
        self._make_asset('Filtered asset')

        service = ActivityService(self.env)
        result = service.get_timeline(
            filters={'module': 'asset', 'status': 'unread'},
            page=1, limit=5,
        )
        self.assertGreaterEqual(result['total'], 1)
        for rec in result['records']:
            self.assertEqual(rec['module'], 'asset')
            self.assertEqual(rec['status'], 'unread')

    # ------------------------------------------------------------------
    # Notification Service
    # ------------------------------------------------------------------
    def test_notification_service_counts(self):
        """Test notification service count methods."""
        from ..services.notification_service import NotificationService
        # Create notifications
        self.env['af.notification'].create({
            'recipient_id': self.test_user.id,
            'title': 'Count test',
            'category': 'critical',
            'priority': 'critical',
        })
        service = NotificationService(self.env)
        counts = service.get_counts(self.test_user.id)

        self.assertIn('unread', counts)
        self.assertIn('critical', counts)
        self.assertIn('total', counts)
        self.assertGreaterEqual(counts['unread'], 1)
        self.assertGreaterEqual(counts['critical'], 1)

