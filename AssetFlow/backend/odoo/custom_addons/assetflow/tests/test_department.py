# -*- coding: utf-8 -*-
"""Tests for af.department model."""
from odoo.tests.common import TransactionCase
from odoo.exceptions import ValidationError


class TestAfDepartment(TransactionCase):
    """Unit tests for Department CRUD and business rules."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Dept = cls.env['af.department']

    def _make_dept(self, name='Test Dept', code='TST', status='active'):
        return self.Dept.create({'name': name, 'code': code, 'status': status})

    # ------------------------------------------------------------------
    # Creation
    # ------------------------------------------------------------------
    def test_create_department(self):
        dept = self._make_dept()
        self.assertEqual(dept.name, 'Test Dept')
        self.assertEqual(dept.code, 'TST')
        self.assertEqual(dept.status, 'active')

    def test_unique_code_constraint(self):
        self._make_dept(code='UNIQ')
        with self.assertRaises(Exception):
            self._make_dept(name='Another', code='UNIQ')

    def test_unique_name_constraint(self):
        self._make_dept(name='Unique Name', code='UN1')
        with self.assertRaises(Exception):
            self._make_dept(name='Unique Name', code='UN2')

    # ------------------------------------------------------------------
    # Status transitions
    # ------------------------------------------------------------------
    def test_activate_department(self):
        dept = self._make_dept(status='inactive')
        dept.action_activate()
        self.assertEqual(dept.status, 'active')

    def test_deactivate_department_no_employees(self):
        dept = self._make_dept()
        dept.action_deactivate()
        self.assertEqual(dept.status, 'inactive')

    def test_deactivate_blocked_when_active_employees(self):
        dept = self._make_dept()
        self.env['af.employee'].create({
            'name': 'Test Emp',
            'email': 'test@test.com',
            'department_id': dept.id,
            'role': 'employee',
            'status': 'active',
            'joining_date': '2020-01-01',
        })
        with self.assertRaises(ValidationError):
            dept.action_deactivate()

    # ------------------------------------------------------------------
    # Computed fields
    # ------------------------------------------------------------------
    def test_employee_count(self):
        dept = self._make_dept(code='EC1')
        self.assertEqual(dept.employee_count, 0)
        self.env['af.employee'].create({
            'name': 'Emp A',
            'email': 'empa@test.com',
            'department_id': dept.id,
            'role': 'employee',
            'status': 'active',
            'joining_date': '2020-01-01',
        })
        dept._compute_employee_count()
        self.assertEqual(dept.employee_count, 1)
