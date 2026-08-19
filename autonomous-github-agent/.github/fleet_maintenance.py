"""
Fleet Maintenance v1.0 — all-repository audit + safe remediation plane.

Highest-ROI unlock: systematic cross-repo hygiene for the Sigma fleet.
Default mode is plan-only (inspect + report findings). apply_safe is
explicit and limited to no-op / clearly-safe actions (e.g. missing LICENSE
placeholder never written without review).

FLEET matches fleet_pulse / coordinator.
"""
from __future__ import annotations

import argparse
import json
import os
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests

FLEET = [
    "eric847b/autonomous-github-agent",
    "eric847b/singularity-operator",
    "eric847b/AI-Collaboration-Hub",
    "eric847b/zero-cost-wealth-playbook-tool",
    "eric847b/modular-hub-modernization",
]

REQUIRED_ROOT_FILES = [
    "README.md",
    "LICENSE",
    "SECURITY.md",
    ".gitignore",
]

# Soft expectations (finding only, never auto-written)
RECOMMENDED_ROOT_FILES = [
    "CODE_OF_CONDUCT.md",
    "CONTRIBUTING.md",
    "CODEOWNERS",
]

HOST_REPO = os.getenv("GITHUB_REPOSITORY", "eric847b/autonomous-github-agent")


@dataclass
class Finding:
    repo: str
    kind: str  # missing_required | missing_recommended | policy_gap | other
    path: str
    severity: str  # high | medium | low
    message: str
    auto_fixable: bool = False


@dataclass
class RepoReport:
    repo: str
    ok: bool
    findings: List[Finding] = field(default_factory=list)
    error: Optional[str] = None


def _headers() -> dict:
    token = os.getenv("GH_FULL_PAT") or os.getenv("GITHUB_TOKEN")
    if not token:
        return {}
    return {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
    }


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _list_root(repo: str, headers: dict) -> Optional[List[str]]:
    try:
        resp = requests.get(
            f"https://api.github.com/repos/{repo}/contents/",
            headers=headers,
            timeout=25,
        )
        if resp.status_code != 200:
            return None
        return [item["name"] for item in (resp.json() or []) if isinstance(item, dict)]
    except Exception:
        return None


def inspect_repo(repo: str, headers: Optional[dict] = None) -> RepoReport:
    headers = headers or _headers()
    if not headers:
        return RepoReport(repo=repo, ok=False, error="NO_TOKEN")

    names = _list_root(repo, headers)
    if names is None:
        return RepoReport(repo=repo, ok=False, error="list_root_failed")

    findings: List[Finding] = []
    name_set = set(names)

    for path in REQUIRED_ROOT_FILES:
        if path not in name_set:
            findings.append(
                Finding(
                    repo=repo,
                    kind="missing_required",
                    path=path,
                    severity="high",
                    message=f"Required root file missing: {path}",
                    auto_fixable=(path == "LICENSE"),  # only LICENSE is candidate for safe apply
                )
            )

    for path in RECOMMENDED_ROOT_FILES:
        if path not in name_set:
            findings.append(
                Finding(
                    repo=repo,
                    kind="missing_recommended",
                    path=path,
                    severity="low",
                    message=f"Recommended root file missing: {path}",
                    auto_fixable=False,
                )
            )

    return RepoReport(repo=repo, ok=True, findings=findings)


def inspect_fleet(fleet: Optional[List[str]] = None) -> Dict[str, Any]:
    headers = _headers()
    repos = fleet or list(FLEET)
    reports: List[RepoReport] = [inspect_repo(r, headers) for r in repos]

    all_findings = [f for r in reports for f in r.findings]
    high = sum(1 for f in all_findings if f.severity == "high")
    medium = sum(1 for f in all_findings if f.severity == "medium")
    low = sum(1 for f in all_findings if f.severity == "low")
    autoable = sum(1 for f in all_findings if f.auto_fixable)

    return {
        "version": "1.0",
        "mode": "plan",
        "generated_at": _utc_now_iso(),
        "repos": [
            {
                "repo": r.repo,
                "ok": r.ok,
                "error": r.error,
                "findings": [asdict(f) for f in r.findings],
            }
            for r in reports
        ],
        "summary": {
            "repos_scanned": len(reports),
            "repos_ok": sum(1 for r in reports if r.ok),
            "total_findings": len(all_findings),
            "high": high,
            "medium": medium,
            "low": low,
            "auto_fixable": autoable,
        },
    }


def apply_safe(report: Optional[Dict[str, Any]] = None, dry_run: bool = True) -> Dict[str, Any]:
    """
    Safe apply path. Currently limited to reporting; LICENSE auto-write is
    intentionally disabled (no-op) until policy explicitly enables it.
    """
    report = report or inspect_fleet()
    actions: List[Dict[str, Any]] = []

    for repo_block in report.get("repos") or []:
        for finding in repo_block.get("findings") or []:
            if not finding.get("auto_fixable"):
                continue
            # Explicit no-op for LICENSE — fail-closed until reviewed.
            actions.append(
                {
                    "repo": finding.get("repo"),
                    "path": finding.get("path"),
                    "action": "skipped_safe",
                    "reason": "LICENSE auto-write disabled (plan-only until policy gate)",
                    "dry_run": dry_run,
                }
            )

    return {
        "version": "1.0",
        "mode": "apply_safe",
        "dry_run": dry_run,
        "generated_at": _utc_now_iso(),
        "actions": actions,
        "applied": 0,
        "skipped": len(actions),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Fleet Maintenance v1.0")
    parser.add_argument(
        "--mode",
        choices=["plan", "apply_safe"],
        default="plan",
        help="plan (default) or apply_safe",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Never write (default true for apply_safe)",
    )
    parser.add_argument(
        "--no-dry-run",
        action="store_true",
        help="Allow writes if apply_safe and policy permits",
    )
    args = parser.parse_args()

    if args.mode == "plan":
        out = inspect_fleet()
    else:
        dry = not args.no_dry_run
        out = apply_safe(dry_run=dry)

    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()