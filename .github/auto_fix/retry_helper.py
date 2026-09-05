"""Minimal retry helper auto-added by FailureSolver v3.5.4 for timeout class.
Safe, zero side-effects beyond increased resilience on network/API calls.
"""
import time
from typing import Callable, TypeVar

T = TypeVar("T")

def retry_with_backoff(fn: Callable[[], T], max_attempts: int = 3, base_delay: float = 1.0) -> T:
    last_exc = None
    for attempt in range(max_attempts):
        try:
            return fn()
        except Exception as e:
            last_exc = e
            if attempt < max_attempts - 1:
                time.sleep(base_delay * (2 ** attempt))
    raise last_exc  # type: ignore
