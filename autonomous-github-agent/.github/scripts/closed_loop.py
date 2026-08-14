#!/usr/bin/env python3
"""
Closed-loop ledger (v6.0)

After auto-fix PRs merge, record problem type + merge SHA.
On later runs, re-check that the problem class is gone; if it returns,
escalate to a needs-human issue.
"""

from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, List, Optional

LEDGER_PATH = "auto-fix-ledger.json"


def load_ledger(path: str = LEDGER_PATH) -> Dict[str, Any]:
    if os.path.isfile(path):
        try:
            with open(path, "r") as fh:
                return json.load(fh)
        except Exception:
            pass
    return {"version": "6.0", "entries": []}


def save_ledger(data: Dict[str, Any], path: str = LEDGER_PATH) -> None:
    data["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    data["version"] = data.get("version") or "6.0"
    with open(path, "w") as fh:
        json.dump(data, fh, indent=2)


def record_fix(
    problem_type: str,
    title: str,
    pr_number: Optional[int] = None,
    merge_sha: Optional[str] = None,
    path: str = LEDGER_PATH,
) -> None:
    data = load_ledger(path)
    data["entries"].append({
        "problem_type": problem_type,
        "title": title[:200],
        "pr_number": pr_number,
        "merge_sha": merge_sha,
        "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "status": "pending_verify",
        "reappear_count": 0,
    })
    data["entries"] = data["entries"][-200:]
    save_ledger(data, path)


def mark_verified(problem_type: str, path: str = LEDGER_PATH) -> int:
    data = load_ledger(path)
    n = 0
    for e in data.get("entries", []):
        if e.get("problem_type") == problem_type and e.get("status") == "pending_verify":
            e["status"] = "verified"
            e["verified_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            n += 1
    if n:
        save_ledger(data, path)
    return n

def note_reappear(problem_type: str, path: str = LEDGER_PATH) -> List[Dict]:
    """If a fixed problem type reappears, increment counter; escalate at >= 2."""
    data = load_ledger(path)
    escalations = []
    for e in data.get("entries", []):
        if e.get("problem_type") == problem_type and e.get("status") in ("verified", "pending_verify"):
            e["reappear_count"] = int(e.get("reappear_count", 0)) + 1
            e["status"] = "reappeared"
            if e["reappear_count"] >= 2:
                escalations.append(e)
    if escalations:
        save_ledger(data, path)
    return escalations
