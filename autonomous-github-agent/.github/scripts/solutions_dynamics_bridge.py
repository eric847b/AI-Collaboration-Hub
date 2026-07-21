#!/usr/bin/env python3
"""
Solutions Dynamics Bridge - Integrates 100+ runtime failure handlers with autonomous agent.
Provides failure recovery and resilience for all agent operations.
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))

try:
    from solutions_dynamics.runtime_failure_handler import RuntimeFailureHandler as BaseHandler, FailureType as BaseFailure
    from solutions_dynamics.extended_failure_handler import ExtendedRuntimeFailureHandler, ExtendedFailureType
    SOLUTIONS_DYNAMICS_AVAILABLE = True
except ImportError:
    SOLUTIONS_DYNAMICS_AVAILABLE = False
    print("Warning: Solutions Dynamics handlers not available")

class SolutionsDynamicsBridge:
    """Bridge between autonomous agent and solutions-dynamics failure handlers."""
    
    def __init__(self):
        self.base_handler = BaseHandler() if SOLUTIONS_DYNAMICS_AVAILABLE else None
        self.extended_handler = ExtendedRuntimeFailureHandler() if SOLUTIONS_DYNAMICS_AVAILABLE else None
    
    def handle_agent_error(self, error: Exception, context: dict = None) -> str:
        """Handle any agent error using solutions-dynamics handlers."""
        if not SOLUTIONS_DYNAMICS_AVAILABLE:
            return "LOG_ERROR_CONTINUE"
        
        # Try base handler first
        base_result = self.base_handler.handle(error, context or {})
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