#!/usr/bin/env python3
"""
Solutions Dynamics - Runtime Failure Handling Toolkit
100+ failure types with automated recovery strategies
"""

from .runtime_failure_handler import (
    RuntimeFailureHandler,
    FailureType,
    FailureContext,
    with_failure_recovery
)

from .extended_failure_handler import (
    ExtendedRuntimeFailureHandler,
    ExtendedFailureType
)

__all__ = [
    'RuntimeFailureHandler',
    'FailureType',
    'FailureContext',
    'ExtendedRuntimeFailureHandler',
    'ExtendedFailureType',
    'with_failure_recovery'
]

__version__ = "1.0.0"
__author__ = "Solutions Dynamics Engine"