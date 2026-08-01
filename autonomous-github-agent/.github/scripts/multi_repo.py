#!/usr/bin/env python3
"""
v5.1 Multi-repo awareness

When MULTI_REPO=1, list sibling repos owned by the authenticated user
and optionally run a lightweight scan (lockfile/requirements presence).
Gated to control GitHub Actions minutes.
"""

from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, List

try:
    from github import Github
    GITHUB_AVAILABLE = True
except ImportError:
    GITHUB_AVAILABLE = False

REPORT_PATH = "multi-repo-report.json"


def list_sibling_repos(limit: int = 20) -> List[Dict[str, Any]]:
    if not GITHUB_AVAILABLE:
        return []
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        return []
    g = Github(token)
    user = g.get_user()
    current = os.getenv("REPO", "")
    out = []
    for repo in user.get_repos(type="owner", sort="updated"):
        full = repo.full_name
        if full == current:
            continue
        if repo.archived or repo.fork:
            continue
        out.append({
            "full_name": full,
            "private": repo.private,
            "default_branch": repo.default_branch,
            "open_issues": repo.open_issues_count,
            "updated_at": repo.updated_at.isoformat() if repo.updated_at else None,
            "html_url": repo.html_url,
        })
        if len(out) >= limit:
            break
    return out


def scan_siblings_metadata(limit: int = 15) -> Dict[str, Any]:
    """Metadata-only scan (no clone) — safe and cheap."""
    enabled = os.getenv("MULTI_REPO", "0") == "1"
    report: Dict[str, Any] = {
        "version": "5.1",
        "enabled": enabled,
        "scanned_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "repos": [],
        "notes": [],
    }
    if not enabled:
        report["notes"].append("Set MULTI_REPO=1 to enable sibling discovery.")
        with open(REPORT_PATH, "w") as fh:
            json.dump(report, fh, indent=2)
        return report

    try:
        repos = list_sibling_repos(limit=limit)
        report["repos"] = repos
        report["notes"].append(
            f"Discovered {len(repos)} sibling repos (metadata only; no clone)."
        )
        # Flag high open-issue counts as candidates for future deep scans
        hot = [r for r in repos if (r.get("open_issues") or 0) > 10]
        if hot:
            report["notes"].append(
                "High open-issue siblings: "
                + ", ".join(r["full_name"] for r in hot[:5])
            )
    except Exception as e:
        report["notes"].append(f"error: {e}")

    with open(REPORT_PATH, "w") as fh:
        json.dump(report, fh, indent=2)
    return report


if __name__ == "__main__":
    r = scan_siblings_metadata()
    print(json.dumps(r, indent=2))
