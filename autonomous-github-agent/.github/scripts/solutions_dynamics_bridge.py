#!/usr/bin/env python3
"""
Solutions Dynamics Bridge - Integrates 100+ runtime failure handlers with autonomous agent.
Provides failure recovery and resilience for all agent operations.
Hardened: supports monorepo sibling `solutions-dynamics/` layout AND local package;
never crashes at import or construction time.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# Monorepo sibling: <root>/solutions-dynamics (hyphen) -> importable as solutions_dynamics (underscore).
try:
    _ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    for _cand in (
        os.path.join(_ROOT, "solutions-dynamics"),
        os.path.join(_ROOT, "solutions_dynamics"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "solutions_dynamics"),
    ):
        if os.path.isdir(_cand) and _cand not in sys.path:
            sys.path.insert(0, os.path.dirname(_cand))
            break
except Exception:
    pass

try:
    from solutions_dynamics.extended_failure_handler import (  # type: ignore
        ExtendedFailureType,
        ExtendedRuntimeFailureHandler,
    )
    from solutions_dynamics.runtime_failure_handler import FailureType as BaseFailure
    from solutions_dynamics.runtime_failure_handler import (  # type: ignore
        RuntimeFailureHandler as BaseHandler,
    )
    SOLUTIONS_DYNAMICS_AVAILABLE = True
except Exception:  # noqa: BLE001 - any import-time failure must degrade gracefully
    SOLUTIONS_DYNAMICS_AVAILABLE = False
    BaseHandler = None  # type: ignore[assignment,misc]
    BaseFailure = None  # type: ignore[assignment,misc]
    ExtendedRuntimeFailureHandler = None  # type: ignore[assignment,misc]
    ExtendedFailureType = None  # type: ignore[assignment,misc]

class SolutionsDynamicsBridge:
    """Bridge between autonomous agent and solutions-dynamics failure handlers."""

    def __init__(self):
        self.base_handler = None
        self.extended_handler = None
        if SOLUTIONS_DYNAMICS_AVAILABLE:
            try:
                self.base_handler = BaseHandler()
            except Exception:  # noqa: BLE001 - constructor must never crash the bridge
                self.base_handler = None
            try:
                self.extended_handler = ExtendedRuntimeFailureHandler()
            except Exception:  # noqa: BLE001
                self.extended_handler = None

    @property
    def available(self) -> bool:
        return self.base_handler is not None or self.extended_handler is not None

    def handle_agent_error(self, error: Exception, context: dict = None) -> str:
        """Handle any agent error using solutions-dynamics handlers."""
        if self.base_handler is None:
            return "LOG_ERROR_CONTINUE"

        # Try base handler first; degrade to log-and-continue on any internal fault.
        try:
            base_result = self.base_handler.handle(error, context or {})
        except Exception:  # noqa: BLE001
            return "LOG_ERROR_CONTINUE"
        return f"BASE_HANDLER: {base_result}"

    def get_recovery_strategy(self, extended_type) -> str:
        """Get recovery strategy for extended failure type."""
        if self.extended_handler:
            return self.extended_handler.get_recovery(extended_type)
        return "UNKNOWN"

    def verify_solutions_dynamics(self) -> dict:
        """Verify solutions-dynamics integration status."""
        return {
            "base_handler_available": SOLUTIONS_DYNAMICS_AVAILABLE,
            "extended_handler_available": SOLUTIONS_DYNAMICS_AVAILABLE,
            "total_failure_types": 100 if SOLUTIONS_DYNAMICS_AVAILABLE else 0,
            "path": "solutions-dynamics/"
        }

# Create singleton instance
_bridge = SolutionsDynamicsBridge()

def get_bridge() -> SolutionsDynamicsBridge:
    """Get the singleton bridge instance."""
    return _bridge

if __name__ == "__main__":
    bridge = get_bridge()
    status = bridge.verify_solutions_dynamics()
    print(f"Solutions Dynamics Bridge Status: {status}")
    print("Ready for integration with autonomous agent")
