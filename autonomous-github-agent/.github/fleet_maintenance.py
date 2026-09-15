"""
Fleet Maintenance v1.1 — cross-repository hygiene plan engine.

Default scope: Sigma FLEET (5 repos). Optional --scope all discovers every
repository owned by the authenticated account (from #317 capability).

Modes:
  plan       — inspect + report only (default, fail-closed)
  apply_safe — explicit path; currently no-op for mutations until policy allows

Never: delete, archive, force-push, rewrite history, or invent LICENSE bodies.
"""
from __future__ import annotations

import argparse
import json
import os
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

import requests

VERSION = "1.1.0"

FLEET = [
    "eric847b/autonomous-github-agent",
    "eric847b/singularity-operator",
    "eric847b/AI-Collaboration-Hub",
    "eric847b/zero-cost-wealth-playbook-tool",
    "eric847b/modular-hub-modernization",
]

OWNER = os.getenv("GITHUB_OWNER", "eric847b")
HOST_REPO = os.getenv("GITHUB_REPOSITORY", "eric847b/autonomous-github-agent")
MAX_REPOS = int(os.getenv("FLEET_MAINTENANCE_MAX_REPOS", "100"))

REQUIRED_ROOT_FILES = ["README.md", "LICENSE", "SECURITY.md", ".gitignore"]
RECOMMENDED_ROOT_FILES = ["CODE_OF_CONDUCT.md", "CONTRIBUTING.md", "CODEOWNERS"]


@dataclass
class Finding:
    repo: str
    kind: str
    path: str
    severity: str
    message: str
    auto_fixable: bool = False
    score: int = 0


@dataclass
class RepoReport:
    repo: str
    ok: bool
    findings: list[Finding] = field(default_factory=list)
    error: str | None = None


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


def _list_root(repo: str, headers: dict) -> list[str] | None:
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


def discover_owned_repos(headers: dict, max_repos: int = MAX_REPOS) -> list[str]:
    """Every repository owned by OWNER (private+public visible to token)."""
    repos: list[str] = []
    page = 1
    while len(repos) < max_repos:
        try:
            resp = requests.get(
                "https://api.github.com/user/repos",
                headers=headers,
                params={
                    "affiliation": "owner",
                    "per_page": 100,
                    "page": page,
                    "sort": "updated",
                },
                timeout=25,
            )
            if resp.status_code != 200:
                break
            batch = resp.json() or []
            if not batch:
                break
            for r in batch:
                login = ((r.get("owner") or {}).get("login") or "")
                full = r.get("full_name") or ""
                if login == OWNER and full:
                    repos.append(full)
            page += 1
        except Exception:
            break
    return repos[:max_repos]


def inspect_repo(repo: str, headers: dict | None = None) -> RepoReport:
    headers = headers or _headers()
    if not headers:
        return RepoReport(repo=repo, ok=False, error="NO_TOKEN")

    names = _list_root(repo, headers)
    if names is None:
        return RepoReport(repo=repo, ok=False, error="list_root_failed")

    findings: list[Finding] = []
    name_set = set(names)

    for path in REQUIRED_ROOT_FILES:
        if path not in name_set:
            score = 80 if path in ("README.md", "LICENSE") else 60
            findings.append(
                Finding(
                    repo=repo,
                    kind="missing_required",
                    path=path,
                    severity="high",
                    message=f"Required root file missing: {path}",
                    auto_fixable=(path == "LICENSE"),
                    score=score,
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
                    score=25,
                )
            )

    # Soft CI signal (host only via workflows list would be heavy; skip if no .github)
    if ".github" not in name_set:
        findings.append(
            Finding(
                repo=repo,
                kind="github_hygiene",
                path=".github",
                severity="medium",
                message="No .github directory",
                auto_fixable=False,
                score=50,
            )
        )

    return RepoReport(repo=repo, ok=True, findings=findings)


def inspect_fleet(
    scope: str = "fleet",
    fleet: list[str] | None = None,
) -> dict[str, Any]:
    headers = _headers()
    if scope == "all" and headers:
        repos = discover_owned_repos(headers)
        if not repos:
            repos = list(fleet or FLEET)
    else:
        repos = list(fleet or FLEET)

    reports: list[RepoReport] = [inspect_repo(r, headers) for r in repos]
    all_findings = [f for r in reports for f in r.findings]
    all_findings.sort(key=lambda f: (-f.score, f.repo, f.path))

    high = sum(1 for f in all_findings if f.severity == "high")
    medium = sum(1 for f in all_findings if f.severity == "medium")
    low = sum(1 for f in all_findings if f.severity == "low")

    return {
        "version": VERSION,
        "mode": "plan",
        "scope": scope,
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
            "auto_fixable": sum(1 for f in all_findings if f.auto_fixable),
            "priority_score": sum(f.score for f in all_findings),
        },
        "mutation_contract": (
            "Plan-only by default. No deletion, archival, force-push, history rewrite, "
            "or LICENSE body invention. apply_safe is explicit and currently no-op."
        ),
    }


def apply_safe(
    report: dict[str, Any] | None = None,
    dry_run: bool = True,
) -> dict[str, Any]:
    """Safe apply path — LICENSE auto-write intentionally disabled."""
    report = report or inspect_fleet()
    actions: list[dict[str, Any]] = []

    for repo_block in report.get("repos") or []:
        for finding in repo_block.get("findings") or []:
            if not finding.get("auto_fixable"):
                continue
            actions.append(
                {
                    "repo": finding.get("repo"),
                    "path": finding.get("path"),
                    "action": "skipped_safe",
                    "reason": "LICENSE auto-write disabled until policy gate + approved template",
                    "dry_run": dry_run,
                }
            )

    return {
        "version": VERSION,
        "mode": "apply_safe",
        "dry_run": dry_run,
        "generated_at": _utc_now_iso(),
        "actions": actions,
        "applied": 0,
        "skipped": len(actions),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=f"Fleet Maintenance v{VERSION}")
    parser.add_argument("--mode", choices=["plan", "apply_safe"], default="plan")
    parser.add_argument(
        "--scope",
        choices=["fleet", "all"],
        default="fleet",
        help="fleet = Sigma 5; all = every owned repo visible to token",
    )
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--no-dry-run", action="store_true")
    args = parser.parse_args()

    if args.mode == "plan":
        out = inspect_fleet(scope=args.scope)
    else:
        dry = not args.no_dry_run
        out = apply_safe(dry_run=dry)

    print(json.dumps(out, indent=2))
    try:
        with open("fleet-maintenance-report.json", "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2)
            f.write("\n")
    except OSError:
        pass


if __name__ == "__main__":
    main()
