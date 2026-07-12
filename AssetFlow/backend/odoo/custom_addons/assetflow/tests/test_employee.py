# -*- coding: utf-8 -*-
"""Tests for af.employee model."""
from odoo.tests.common import TransactionCase
from odoo.exceptions import ValidationError


class TestAfEmployee(TransactionCase):
    """Unit tests for Employee CRUD and business rules."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Emp = cls.env['af.employee']
        cls.dept = cls.env['af.department'].create({
            'name': 'Test Department',
            'code': 'TSTEMP',
            'status': 'active',
        })

    def _make_emp(self, name='Test User', email=None, role='employee', status='active'):
        email = email or f"{name.lower().replace(' ', '.')}@test.com"
        return self.Emp.create({
            'name': name,
            'email': email,
            'department_id': self.dept.id,
            'role': role,
            'status': status,
            'joining_date': '2020-01-01',
        })

    # ------------------------------------------------------------------
    # Auto ID
    # ------------------------------------------------------------------
    def test_employee_id_auto_generated(self):
        emp = self._make_emp()
        self.assertTrue(emp.employee_id.startswith('EMP-'))
        self.assertNotEqual(emp.employee_id, 'New')

    def test_employee_ids_are_unique(self):
        emp1 = self._make_emp(name='Alpha', email='alpha@test.com')
        emp2 = self._make_emp(name='Beta', email='beta@test.com')
        self.assertNotEqual(emp1.employee_id, emp2.employee_id)

    # ------------------------------------------------------------------
    # Constraints
    # ------------------------------------------------------------------
    def test_unique_email_constraint(self):
        self._make_emp(name='User One', email='dup@test.com')
        with self.assertRaises(Exception):
            self._make_emp(name='User Two', email='dup@test.com')

    # ------------------------------------------------------------------
    # Status transitions
    # ------------------------------------------------------------------
    def test_deactivate_blocked_when_assets_allocated(self):
        emp = self._make_emp(name='Asset Owner', email='assetowner@test.com')
        cat = self.env['af.asset.category'].create({
            'name': 'Test Cat', 'code': 'TSTCAT',
        })
        self.env['af.asset'].create({
            'name': 'Test Asset',
            'category_id': cat.id,
            'department_id': self.dept.id,
            'employee_id': emp.id,
            'purchase_date': '2022-01-01',
            'purchase_cost': 100.0,
            'status': 'allocated',
        })
        with self.assertRaises(ValidationError):
            emp.action_deactivate()
