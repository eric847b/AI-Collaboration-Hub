#!/usr/bin/env python3
"""
v6.0 agent hooks — inject Nexus consensus into issue/PR/todo task execution.

Import from agent.py (or call before high-impact edits):

    from agent_hooks import gate_with_consensus
    if not gate_with_consensus(task, call_llm, profile):
        skip / document only
"""

from __future__ import annotations

import logging
import os
from typing import Any, Callable, Dict, Optional

log = logging.getLogger("agent_hooks")

try:
    from agent_nexus_bridge import consult_nexus, should_proceed
    HAS_BRIDGE = True
except ImportError:
    HAS_BRIDGE = False


def gate_with_consensus(
    task: Dict[str, Any],
    call_llm_fn: Optional[Callable] = None,
    profile=None,
) -> bool:
    """
    Return True if the agent should proceed with an automated fix.
    For issue / pr_review / todo tasks, runs multi-role consensus when enabled.
    """
    ttype = task.get("type", "")
    if ttype not in ("issue", "pr_review", "todo"):
        return True
    if os.getenv("NEXUS_CONSENSUS", "1") != "1":
        return True
    if not HAS_BRIDGE or call_llm_fn is None:
        return True

    title = task.get("title", "")
    body = task.get("body", "") or ""
    consensus = consult_nexus(title, body, call_llm_fn=call_llm_fn, profile=profile)
    ok = should_proceed(consensus)
    log.info(
        "Nexus consensus: approve=%s confidence=%s proceed=%s echo=%s",
        consensus.get("approve"),
        consensus.get("confidence"),
        ok,
        (consensus.get("echo") or "")[:120],
    )
    return ok
