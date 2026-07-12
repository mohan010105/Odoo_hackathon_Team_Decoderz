# -*- coding: utf-8 -*-
"""Tests for af.asset.category model."""
from odoo.tests.common import TransactionCase
from odoo.exceptions import ValidationError


class TestAfAssetCategory(TransactionCase):
    """Unit tests for Asset Category CRUD and business rules."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Cat = cls.env['af.asset.category']

    def _make_cat(self, name='Test Cat', code='TSTCAT', warranty=12):
        return self.Cat.create({'name': name, 'code': code, 'warranty_period': warranty})

    def test_create_category(self):
        cat = self._make_cat()
        self.assertEqual(cat.status, 'active')
        self.assertEqual(cat.warranty_period, 12)

    def test_unique_code_constraint(self):
        self._make_cat(code='UNQ')
        with self.assertRaises(Exception):
            self._make_cat(name='Other', code='UNQ')

    def test_deactivate_blocked_when_assets_exist(self):
        cat = self._make_cat(name='Blocked Cat', code='BLK')
        dept = self.env['af.department'].create({
            'name': 'Dept BLK', 'code': 'DBLK',
        })
        self.env['af.asset'].create({
            'name': 'Blocking Asset',
            'category_id': cat.id,
            'department_id': dept.id,
            'purchase_date': '2022-01-01',
            'purchase_cost': 500.0,
            'status': 'available',
        })
        with self.assertRaises(ValidationError):
            cat.action_deactivate()

    def test_deactivate_allowed_when_no_assets(self):
        cat = self._make_cat(name='Empty Cat', code='EMP')
        cat.action_deactivate()
        self.assertEqual(cat.status, 'inactive')
