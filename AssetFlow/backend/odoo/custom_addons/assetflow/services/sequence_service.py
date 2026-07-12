# -*- coding: utf-8 -*-
"""
Sequence Service
================
Centralises sequence retrieval so models never call ir.sequence directly.
All auto-generated identifier logic lives here.
"""
import logging

_logger = logging.getLogger(__name__)

# Sequence codes — must match data/sequences.xml
ASSET_SEQUENCE_CODE = 'af.asset.sequence'
EMPLOYEE_SEQUENCE_CODE = 'af.employee.sequence'


def get_next_asset_tag(env) -> str:
    """Return the next asset tag (e.g. AF-000001)."""
    tag = env['ir.sequence'].next_by_code(ASSET_SEQUENCE_CODE)
    if not tag:
        _logger.error(
            "Sequence '%s' not found. Check data/sequences.xml is loaded.",
            ASSET_SEQUENCE_CODE,
        )
        return 'New'
    return tag


def get_next_employee_id(env) -> str:
    """Return the next employee ID (e.g. EMP-00001)."""
    emp_id = env['ir.sequence'].next_by_code(EMPLOYEE_SEQUENCE_CODE)
    if not emp_id:
        _logger.error(
            "Sequence '%s' not found. Check data/sequences.xml is loaded.",
            EMPLOYEE_SEQUENCE_CODE,
        )
        return 'New'
    return emp_id
