# -*- coding: utf-8 -*-
"""Tests for af.asset model."""
from odoo.tests.common import TransactionCase
from odoo.exceptions import ValidationError


class TestAfAsset(TransactionCase):
    """Unit tests for Asset CRUD, auto-tagging, and lifecycle."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Asset = cls.env['af.asset']
        cls.dept = cls.env['af.department'].create({
            'name': 'Asset Test Dept', 'code': 'ATSDT',
        })
        cls.cat = cls.env['af.asset.category'].create({
            'name': 'Asset Test Cat', 'code': 'ATCAT',
        })

    def _make_asset(self, name='Test Asset', status='available', employee=False):
        vals = {
            'name': name,
            'category_id': self.cat.id,
            'department_id': self.dept.id,
            'purchase_date': '2022-01-01',
            'purchase_cost': 1000.0,
            'status': status,
        }
        if employee:
            vals['employee_id'] = employee.id
        return self.Asset.create(vals)

    # ------------------------------------------------------------------
    # Auto-tag
    # ------------------------------------------------------------------
    def test_asset_tag_auto_generated(self):
        asset = self._make_asset()
        self.assertTrue(asset.tag.startswith('AF-'))
        self.assertNotEqual(asset.tag, 'New')

    def test_asset_tags_are_sequential_and_unique(self):
        a1 = self._make_asset(name='Asset One')
        a2 = self._make_asset(name='Asset Two')
        self.assertNotEqual(a1.tag, a2.tag)

    # ------------------------------------------------------------------
    # Soft delete
    # ------------------------------------------------------------------
    def test_unlink_blocked_when_not_disposed(self):
        asset = self._make_asset()
        self.assertEqual(asset.status, 'available')
        with self.assertRaises(ValidationError):
            asset.unlink()

    def test_unlink_allowed_when_disposed(self):
        asset = self._make_asset()
        asset.action_dispose()
        self.assertEqual(asset.status, 'disposed')
        asset.unlink()  # Should not raise

    # ------------------------------------------------------------------
    # State transitions
    # ------------------------------------------------------------------
    def test_dispose_clears_employee(self):
        emp = self.env['af.employee'].create({
            'name': 'Disp Emp',
            'email': 'disp@test.com',
            'department_id': self.dept.id,
            'role': 'employee',
            'status': 'active',
            'joining_date': '2020-01-01',
        })
        asset = self._make_asset(status='allocated', employee=emp)
        asset.action_dispose()
        self.assertEqual(asset.status, 'disposed')
        self.assertFalse(asset.employee_id)

    def test_cannot_modify_disposed_asset(self):
        asset = self._make_asset()
        asset.action_dispose()
        with self.assertRaises(ValidationError):
            asset.action_set_available()

    # ------------------------------------------------------------------
    # Financial validation
    # ------------------------------------------------------------------
    def test_negative_purchase_cost_blocked(self):
        with self.assertRaises(Exception):
            self.Asset.create({
                'name': 'Bad Asset',
                'category_id': self.cat.id,
                'department_id': self.dept.id,
                'purchase_date': '2022-01-01',
                'purchase_cost': -100.0,
                'status': 'available',
            })
