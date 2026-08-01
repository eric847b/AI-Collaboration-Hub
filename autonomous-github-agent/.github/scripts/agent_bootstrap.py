#!/usr/bin/env python3
"""
v5.2 bootstrap — run before agent main to enable consensus gate.

Usage in workflow (optional):
  python autonomous-github-agent/.github/scripts/agent_bootstrap.py
  python autonomous-github-agent/.github/scripts/agent.py

Or import at top of agent.py:
  import agent_bootstrap  # noqa: F401 — patches execute path via env
"""

from __future__ import annotations

import os
import sys

# Ensure scripts dir is importable
_SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if _SCRIPTS not in sys.path:
    sys.path.insert(0, _SCRIPTS)

# Default-on consensus for issue/PR/todo paths
os.environ.setdefault("NEXUS_CONSENSUS", "1")

try:
    from agent_hooks import gate_with_consensus  # noqa: F401
    print("agent_bootstrap: consensus gate available")
except ImportError as e:
    print(f"agent_bootstrap: consensus gate not available ({e})")
