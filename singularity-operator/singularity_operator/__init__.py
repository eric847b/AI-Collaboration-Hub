"""Singularity Operator v0.6 — self-improving AI system.

EverythingDB + SelfImprover + Multi-AI Orchestration + GitHubSeamless.
Groq SDK ≥1.6 via groq_wrapper.
"""

from .everything_db import EverythingDB
from .github_seamless import GitHubSeamless
from .groq_wrapper import GroqWrapper, SingularityGroq, call_ai, get_provider_status
from .orchestrator import SingularityOrchestrator
from .self_improver import SelfImprover

__version__ = "0.6.0"
__all__ = [
    "EverythingDB",
    "SelfImprover",
    "call_ai",
    "get_provider_status",
    "GroqWrapper",
    "SingularityGroq",
    "GitHubSeamless",
    "SingularityOrchestrator",
]
