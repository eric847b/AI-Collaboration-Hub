"""Singularity Operator v0.5.13 - Ultimate self-improving AI system.

v0.5.13: Release metadata and runtime version synchronized.
v0.5.11: Continuous upgrade from live ROI ranking (AGA roi_top_ref).
v0.5.10: AGA Actions → singularity-operator metrics feedback loop.
v0.5.9: Optional zero-dep vector similarity + multi-modal tags.
"""

from .everything_db import EverythingDB
from .self_improver import SelfImprover
from .groq_wrapper import call_ai, get_provider_status
from .github_seamless import GitHubSeamless
from .orchestrator import SingularityOrchestrator
from .chaos_engine import ChaosEngine
from .serendipity_engine import SerendipityEngine
from .browser_automation import BrowserAutomation
from .userscript_gen import UserscriptGenerator

__version__ = "0.5.13"
__all__ = [
    "EverythingDB",
    "SelfImprover",
    "call_ai",
    "GitHubSeamless",
    "SingularityOrchestrator",
    "ChaosEngine",
    "SerendipityEngine",
    "BrowserAutomation",
    "UserscriptGenerator",
]
