# -*- coding: utf-8 -*-
"""Tests for af.asset.allocation and af.transfer.request models."""
from odoo.tests.common import TransactionCase
from odoo.exceptions import ValidationError


class TestAfAllocation(TransactionCase):
    """Unit tests for asset allocation and transfer workflows, history, and validations."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Asset = cls.env['af.asset']
        cls.Allocation = cls.env['af.asset.allocation']
        cls.Transfer = cls.env['af.transfer.request']
        cls.History = cls.env['af.allocation.history']

        cls.dept_active = cls.env['af.department'].create({
            'name': 'Active Dept', 'code': 'ACTDP', 'status': 'active',
        })
        cls.dept_inactive = cls.env['af.department'].create({
            'name': 'Inactive Dept', 'code': 'INACTDP', 'status': 'inactive',
        })
        cls.cat = cls.env['af.asset.category'].create({
            'name': 'Laptops', 'code': 'LAPTOP',
        })

        cls.emp_active_1 = cls.env['af.employee'].create({
            'name': 'Active Employee One',
            'email': 'emp1@test.com',
            'department_id': cls.dept_active.id,
            'status': 'active',
            'joining_date': '2020-01-01',
        })
        cls.emp_active_2 = cls.env['af.employee'].create({
            'name': 'Active Employee Two',
            'email': 'emp2@test.com',
            'department_id': cls.dept_active.id,
            'status': 'active',
            'joining_date': '2020-01-01',
        })
        cls.emp_inactive = cls.env['af.employee'].create({
            'name': 'Inactive Employee',
            'email': 'emp_inact@test.com',
            'department_id': cls.dept_active.id,
            'status': 'inactive',
            'joining_date': '2020-01-01',
        })

        cls.asset_1 = cls.Asset.create({
            'name': 'Laptop Dell 1',
            'category_id': cls.cat.id,
            'purchase_date': '2022-01-01',
            'purchase_cost': 1200.0,
            'status': 'available',
        })
        cls.asset_2 = cls.Asset.create({
            'name': 'Laptop Dell 2',
            'category_id': cls.cat.id,
            'purchase_date': '2022-01-01',
            'purchase_cost': 1200.0,
            'status': 'available',
        })

    # ------------------------------------------------------------------
    # Allocation Workflow Tests
    # ------------------------------------------------------------------
    def test_allocation_lifecycle(self):
        # 1. Create in draft
        alloc = self.Allocation.create({
            'asset_id': self.asset_1.id,
            'employee_id': self.emp_active_1.id,
            'allocation_date': '2026-07-01',
            'expected_return_date': '2026-07-31',
            'status': 'draft',
        })
        self.assertEqual(alloc.status, 'draft')
        self.assertEqual(alloc.department_id, self.dept_active)

        # 2. Execute Allocate
        alloc.action_allocate()
        self.assertEqual(alloc.status, 'allocated')
        self.assertEqual(self.asset_1.status, 'allocated')
        self.assertEqual(self.asset_1.employee_id, self.emp_active_1)

        # Check history
        hist = self.History.search([('asset_id', '=', self.asset_1.id)], order='timestamp desc', limit=1)
        self.assertEqual(hist.action, 'allocate')
        self.assertEqual(hist.employee_id, self.emp_active_1)

        # 3. Return Asset
        alloc.action_return()
        self.assertEqual(alloc.status, 'returned')
        self.assertEqual(self.asset_1.status, 'available')
        self.assertFalse(self.asset_1.employee_id)
        self.assertEqual(alloc.actual_return_date, fields.Date.today())

        # Check history again
        hist2 = self.History.search([('asset_id', '=', self.asset_1.id)], order='timestamp desc', limit=1)
        self.assertEqual(hist2.action, 'return')

    def test_expected_return_date_validation(self):
        with self.assertRaises(ValidationError):
            self.Allocation.create({
                'asset_id': self.asset_1.id,
                'employee_id': self.emp_active_1.id,
                'allocation_date': '2026-07-15',
                'expected_return_date': '2026-07-10',  # Past Expected Date
            })

    def test_inactive_employee_department_allocations_blocked(self):
        # Inactive Employee
        with self.assertRaises(ValidationError):
            self.Allocation.create({
                'asset_id': self.asset_1.id,
                'employee_id': self.emp_inactive.id,
                'expected_return_date': '2026-08-01',
            })

        # Inactive Department
        alloc = self.Allocation.create({
            'asset_id': self.asset_1.id,
            'employee_id': self.emp_active_1.id,
            'expected_return_date': '2026-08-01',
        })
        # Simulate department deactivation
        alloc.department_id = self.dept_inactive.id
        with self.assertRaises(ValidationError):
            alloc.action_allocate()

    def test_duplicate_allocation_blocked(self):
        alloc1 = self.Allocation.create({
            'asset_id': self.asset_1.id,
            'employee_id': self.emp_active_1.id,
            'expected_return_date': '2026-08-01',
        })
        alloc1.action_allocate()

        alloc2 = self.Allocation.create({
            'asset_id': self.asset_1.id,
            'employee_id': self.emp_active_2.id,
            'expected_return_date': '2026-08-01',
        })
        with self.assertRaises(ValidationError):
            alloc2.action_allocate()

    # ------------------------------------------------------------------
    # Transfer Workflow Tests
    # ------------------------------------------------------------------
    def test_transfer_lifecycle(self):
        # Allocate asset first
        alloc = self.Allocation.create({
            'asset_id': self.asset_2.id,
            'employee_id': self.emp_active_1.id,
            'expected_return_date': '2026-08-01',
        })
        alloc.action_allocate()

        # Create transfer request
        req = self.Transfer.create({
            'asset_id': self.asset_2.id,
            'requested_employee_id': self.emp_active_2.id,
            'reason': 'Developer shift requirements.',
        })
        self.assertEqual(req.status, 'pending')
        self.assertEqual(req.current_holder_id, self.emp_active_1)

        # Approve transfer
        req.action_approve()
        self.assertEqual(req.status, 'approved')

        # Complete transfer
        req.action_complete()
        self.assertEqual(req.status, 'completed')
        self.assertEqual(self.asset_2.employee_id, self.emp_active_2)
        self.assertEqual(alloc.status, 'returned')

        # Check history
        hist = self.History.search([('asset_id', '=', self.asset_2.id)], order='timestamp desc', limit=1)
        self.assertEqual(hist.action, 'transfer')
        self.assertEqual(hist.employee_id, self.emp_active_2)

    def test_transfer_to_self_blocked(self):
        alloc = self.Allocation.create({
            'asset_id': self.asset_2.id,
            'employee_id': self.emp_active_1.id,
            'expected_return_date': '2026-08-01',
        })
        alloc.action_allocate()

        with self.assertRaises(ValidationError):
            self.Transfer.create({
                'asset_id': self.asset_2.id,
                'requested_employee_id': self.emp_active_1.id,  # Same holder
                'reason': 'Self transfer.',
            })

    def test_cannot_delete_history(self):
        alloc = self.Allocation.create({
            'asset_id': self.asset_1.id,
            'employee_id': self.emp_active_1.id,
            'expected_return_date': '2026-08-01',
        })
        alloc.action_allocate()
        
        hist = self.History.search([('asset_id', '=', self.asset_1.id)])
        self.assertTrue(hist)
        with self.assertRaises(ValidationError):
            hist.unlink()
ClassTestAfAllocation = TestAfAllocation
