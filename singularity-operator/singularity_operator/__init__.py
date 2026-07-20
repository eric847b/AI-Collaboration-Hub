"""Singularity Operator v0.5.0 - Ultimate self-improving AI system.
EverythingDB + SelfImprover + Multi-AI Orchestration + GitHubSeamless + Serendipity/Chaos primitives.

Core: Universal sequence completion for all knowable data. Self-evolution via AI. Autonomous repo actions.

Upgrade path: Iterative PDCA to singularity. Serendipity capture + disciplined chaos = resilience + speed to perfection."""

from .everything_db import EverythingDB
from .self_improver import SelfImprover
from .groq_wrapper import call_ai, get_provider_status
from .github_seamless import GitHubSeamless
from .orchestrator import SingularityOrchestrator

__version__ = "0.5.0"
__all__ = ["EverythingDB", "SelfImprover", "call_ai", "GitHubSeamless", "SingularityOrchestrator"]
