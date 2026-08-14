#!/usr/bin/env python3
"""
Cross-repo FailureSolver Coordinator v1.5
Scans fleet + opens/updates one consolidated fleet-status issue + health pulse.
"""
from __future__ import annotations
import json, os, sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from failure_solver import get_failure_solver

FLEET = [
    "eric847b/autonomous-github-agent",
    "eric847b/singularity-operator",
    "eric847b/AI-Collaboration-Hub",
    "eric847b/zero-cost-wealth-playbook-tool",
    "eric847b/modular-hub-modernization",
]
HOST_REPO = os.getenv("GITHUB_REPOSITORY", "eric847b/autonomous-github-agent")
FLEET_ISSUE_TITLE = "📊 Fleet FailureSolver Status (auto-updated)"

def _headers():
    token = os.getenv("GH_FULL_PAT") or os.getenv("GITHUB_TOKEN")
    if not token:
        return {}
    return {"Authorization": f"token {token}", "Accept": "application/vnd.github+json"}

def scan_repo(repo: str) -> Dict[str, Any]:
    profile: Dict[str, Any] = {}
    def record(e, c=""):
        print(f"[{repo}] ERROR:{c} {e}")
    try:
        solver = get_failure_solver(repo, profile=profile, record_error=record)
        analyses = solver.scan_and_prioritize(max_runs=8)
        created = []
        for a in analyses[:2]:
            if a.get("top_score", 0) < 55:
                continue
            r = solver.create_remediation_issue(a)
            if r and r.get("number"):
                created.append({"number": r["number"], "class": r.get("class"), "url": r.get("html_url")})
            try:
                from failure_solver_draft_ext import create_draft_pr_for_safe_class
                pr = create_draft_pr_for_safe_class(solver, a)
                if pr and pr.get("number"):
                    created.append({"pr": pr["number"], "class": pr.get("class"), "url": pr.get("html_url")})
            except Exception:
                pass
        return {"repo": repo, "failed_runs": len(analyses), "top_classes": [a.get("top_class") for a in analyses[:5]],
                "top_scores": [round(a.get("top_score", 0), 1) for a in analyses[:5]], "created": created, "ok": True}
    except Exception as e:
        return {"repo": repo, "ok": False, "error": str(e)[:200]}

def find_fleet_issue(headers: dict) -> Optional[int]:
    try:
        resp = requests.get(f"https://api.github.com/repos/{HOST_REPO}/issues",
                            headers=headers, params={"state": "open", "per_page": 50, "labels": "fleet-status"}, timeout=20)
        if resp.status_code == 200:
            for issue in resp.json() or []:
                if issue.get("title") == FLEET_ISSUE_TITLE:
                    return issue.get("number")
        resp2 = requests.get(f"https://api.github.com/repos/{HOST_REPO}/issues",
                             headers=headers, params={"state": "open", "per_page": 30}, timeout=20)
        if resp2.status_code == 200:
            for issue in resp2.json() or []:
                if (issue.get("title") or "").startswith("📊 Fleet FailureSolver"):
                    return issue.get("number")
    except Exception as e:
        print(f"find_fleet_issue: {e}")
    return None

def upsert_fleet_issue(report: Dict[str, Any]) -> Optional[Dict]:
    headers = _headers()
    if not headers:
        return {"error": "NO_TOKEN"}
    summary = report.get("summary") or {}
    lines = [
        f"**Generated:** `{report.get('generated_at')}`  ",
        f"**Coordinator:** v1.5  ",
        f"**Repos OK:** {summary.get('repos_ok')}/{summary.get('repos_scanned')}  ",
        f"**Failed runs seen:** {summary.get('total_failed_runs_seen')}  ",
        f"**Items created this pass:** {summary.get('items_created')}",
        "",
        "### Per-repo",
    ]
    for r in report.get("results") or []:
        if not r.get("ok"):
            lines.append(f"- ❌ `{r.get('repo')}` — {r.get('error', 'error')[:80]}")
            continue
        created = r.get("created") or []
        created_str = ", ".join(
            (f"[#{c['number']}]({c.get('url')})" if "number" in c else f"[PR#{c.get('pr')}]({c.get('url')})")
            for c in created
        ) or "—"
        lines.append(
            f"- ✅ `{r.get('repo')}` — failed_runs={r.get('failed_runs', 0)} | "
            f"top={r.get('top_classes', [])[:3]} | created: {created_str}"
        )
    lines.extend([
        "",
        "---",
        "Auto-updated by **Cross-Repo FailureSolver Coordinator**. Safe: issues + draft PRs only.",
        "Label: `fleet-status`",
    ])
    body = "\n".join(lines)
    existing = find_fleet_issue(headers)
    try:
        if existing:
            resp = requests.patch(
                f"https://api.github.com/repos/{HOST_REPO}/issues/{existing}",
                headers=headers,
                json={"body": body, "title": FLEET_ISSUE_TITLE},
                timeout=20,
            )
            if resp.status_code == 200:
                data = resp.json()
                return {"action": "updated", "number": data.get("number"), "html_url": data.get("html_url")}
            return {"error": f"patch:{resp.status_code}"}
        resp = requests.post(
            f"https://api.github.com/repos/{HOST_REPO}/issues",
            headers=headers,
            json={"title": FLEET_ISSUE_TITLE, "body": body, "labels": ["fleet-status", "self-heal", "catalyst"]},
            timeout=20,
        )
        if resp.status_code in (200, 201):
            data = resp.json()
            return {"action": "created", "number": data.get("number"), "html_url": data.get("html_url")}
        return {"error": f"create:{resp.status_code}", "detail": resp.text[:120]}
    except Exception as e:
        return {"error": str(e)[:120]}

def main():
    report = {"generated_at": datetime.utcnow().isoformat() + "Z", "version": "1.5", "fleet": FLEET, "results": []}
    for repo in FLEET:
        print(f"=== Scanning {repo} ===")
        report["results"].append(scan_repo(repo))
    total_failed = sum(r.get("failed_runs", 0) for r in report["results"] if r.get("ok"))
    total_created = sum(len(r.get("created", [])) for r in report["results"] if r.get("ok"))
    report["summary"] = {
        "repos_scanned": len(FLEET),
        "repos_ok": sum(1 for r in report["results"] if r.get("ok")),
        "total_failed_runs_seen": total_failed,
        "items_created": total_created,
    }
    fleet_issue = upsert_fleet_issue(report)
    report["fleet_issue"] = fleet_issue

    try:
        from fleet_health_notify import post_health_pulse
        pulse = post_health_pulse(report, host_repo=HOST_REPO)
        report["health_pulse"] = pulse
        print(f"[health_pulse] {pulse}")
    except Exception as e:
        print(f"[health_pulse] skip: {e}")

    try:
        from high_severity_notify import notify_high_severity
        sev = notify_high_severity(report, host_repo=HOST_REPO)
        report["high_severity"] = sev
        print(f"[high_severity] {sev.get('status')} count={sev.get('critical_count', 0)}")
    except Exception as e:
        print(f"[high_severity] skip: {e}")

    out = Path("cross-repo-failure-report.json")
    out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"summary": report["summary"], "fleet_issue": fleet_issue, "health_pulse": report.get("health_pulse")}, indent=2))
    print(f"Report written to {out}")
    for r in report["results"]:
        status = "OK" if r.get("ok") else "FAIL"
        print(f"- **{r.get('repo')}**: {status} | failed_runs={r.get('failed_runs', 0)} | created={len(r.get('created', []))}")

if __name__ == "__main__":
    main()
