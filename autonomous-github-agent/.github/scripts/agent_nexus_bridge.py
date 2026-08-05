#!/usr/bin/env python3
"""
v6.0 Bridge — wire Nexus consensus into agent decision path.

Call before high-impact issue/PR fixes:
  consensus = consult_nexus(task_title, task_body, call_llm)
  if not consensus.get('approve') and consensus.get('confidence', 0) < 0.6:
      skip or document only
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any, Callable, Dict, Optional

_SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if _SCRIPTS not in sys.path:
    sys.path.insert(0, _SCRIPTS)

try:
    from nexus_consensus import run_consensus
    HAS_CONSENSUS = True
except ImportError:
    HAS_CONSENSUS = False

USE_CONSENSUS = os.getenv("NEXUS_CONSENSUS", "1") == "1"


def consult_nexus(
    title: str,
    body: str = "",
    call_llm_fn: Optional[Callable] = None,
    profile=None,
) -> Dict[str, Any]:
    """Run multi-role consensus; returns approve/confidence/actions/echo."""
    if not USE_CONSENSUS or not HAS_CONSENSUS or call_llm_fn is None:
        return {
            "approve": True,
            "confidence": 0.5,
            "actions": [],
            "echo": "consensus skipped",
            "skipped": True,
            "version": "6.0",
        }
    task = f"{title}\n\n{(body or '')[:1500]}"
    try:
        result = run_consensus(task, call_llm_fn, profile=profile)
        result["version"] = result.get("version") or "6.0"
        try:
            with open("last-nexus-consensus.json", "w") as fh:
                json.dump(result, fh, indent=2)
        except Exception:
            pass
        return result
    except Exception as e:
        return {
            "approve": True,
            "confidence": 0.4,
            "actions": [],
            "echo": f"consensus error: {e}",
            "error": str(e),
            "version": "6.0",
        }


def should_proceed(consensus: Dict[str, Any], min_confidence: float = 0.45) -> bool:
    if consensus.get("skipped"):
        return True
    if consensus.get("approve") is False and consensus.get("confidence", 0) < 0.7:
        return False
    return consensus.get("confidence", 0.5) >= min_confidence
