#!/usr/bin/env python3
"""
v5.1 Collab export — OmniNexus-style state dump for the agent.

Exports profile + ledger + last consensus + multi-repo report into one JSON
(inspired by userscript Export OmniNexus menu command).
"""

from __future__ import annotations

import json
import os
import time
from typing import Any, Dict


def _load(path: str) -> Any:
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r") as fh:
            return json.load(fh)
    except Exception:
        return None


def export_state(out_path: str = "nexus-export.json") -> Dict[str, Any]:
    data = {
        "version": "5.1",
        "exported_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "profile": _load(".agent_profile.json"),
        "ledger": _load("auto-fix-ledger.json"),
        "last_consensus": _load("last-nexus-consensus.json"),
        "agent_report": _load("agent-report.json"),
        "security_audit": _load("security-audit-report.json"),
        "multi_repo": _load("multi-repo-report.json"),
    }
    with open(out_path, "w") as fh:
        json.dump(data, fh, indent=2)
    return data


if __name__ == "__main__":
    export_state()
    print("Wrote nexus-export.json")
