#!/usr/bin/env python3
"""
v5.1 Ledger-driven escalation

When closed_loop notes a problem type reappearing >= 2 times,
open a non-draft GitHub issue tagged for human attention.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

try:
    from github import Github
    GITHUB_AVAILABLE = True
except ImportError:
    GITHUB_AVAILABLE = False

try:
    from closed_loop import load_ledger, save_ledger
except ImportError:
    load_ledger = None  # type: ignore


def escalate_reappears(dry_run: bool = False) -> List[Dict[str, Any]]:
    if load_ledger is None:
        return []
    data = load_ledger()
    created: List[Dict[str, Any]] = []
    for e in data.get("entries", []):
        if e.get("status") != "reappeared":
            continue
        if int(e.get("reappear_count", 0)) < 2:
            continue
        if e.get("escalated_issue"):
            continue
        title = f"[needs-human] Recurring: {e.get('problem_type')} — {e.get('title', '')[:80]}"
        body = (
            f"## Automated escalation (v5.1)\n\n"
            f"Problem type **`{e.get('problem_type')}`** reappeared "
            f"**{e.get('reappear_count')}** times after prior auto-fix.\n\n"
            f"Original title: {e.get('title')}\n"
            f"Prior PR: #{e.get('pr_number')}\n"
            f"Recorded: {e.get('recorded_at')}\n\n"
            f"Please investigate root cause; auto-fix is not sticking.\n"
        )
        if dry_run or not GITHUB_AVAILABLE:
            created.append({"title": title, "dry_run": True})
            continue
        token = os.getenv("GITHUB_TOKEN")
        repo = os.getenv("REPO")
        if not token or not repo:
            continue
        try:
            g = Github(token)
            r = g.get_repo(repo)
            issue = r.create_issue(
                title=title,
                body=body,
                labels=["needs-human", "autonomous-agent"],
            )
            e["escalated_issue"] = issue.number
            e["status"] = "escalated"
            created.append({"title": title, "issue": issue.number})
        except Exception as ex:
            # labels may not exist — retry without
            try:
                g = Github(token)
                r = g.get_repo(repo)
                issue = r.create_issue(title=title, body=body)
                e["escalated_issue"] = issue.number
                e["status"] = "escalated"
                created.append({"title": title, "issue": issue.number})
            except Exception as ex2:
                created.append({"title": title, "error": str(ex2)})
    if any(c.get("issue") for c in created):
        save_ledger(data)
    return created


if __name__ == "__main__":
    print(escalate_reappears(dry_run=os.getenv("DRY_RUN", "0") == "1"))
