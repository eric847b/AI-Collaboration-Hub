"""
ROI Catalyst — highest-return root action prioritization for the autonomous agent.
v4.1.2 — Exclude status self-reference + notification/inbox triage noise from ranking.

Scores open issues and high-signal work across the fleet by asymmetric upside.
Surfaces exactly one root action + a concrete next-prompt string.
Fail-closed. Never force-merges. Never simulates work.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

FLEET = [
    "eric847b/autonomous-github-agent",
    "eric847b/singularity-operator",
    "eric847b/AI-Collaboration-Hub",
    "eric847b/zero-cost-wealth-playbook-tool",
    "eric847b/modular-hub-modernization",
]

HOST_REPO = os.getenv("GITHUB_REPOSITORY", "eric847b/autonomous-github-agent")
ROI_ISSUE_TITLE = "🚀 Fleet ROI Catalyst Status (auto-updated)"
ROI_VERSION = "4.1.2"

# Status / monitoring issues must never be selected as root work
STATUS_LABELS = frozenset({
    "roi-catalyst",
    "fleet-status",
})
STATUS_TITLE_PREFIXES = (
    "🚀 Fleet ROI Catalyst",
    "📊 Fleet FailureSolver",
    "Fleet ROI Catalyst Status",
    "Fleet FailureSolver Status",
)

# Auto-created notification triage issues (author/inbox) are not root work.
NOTIFICATION_TITLE_PREFIXES = (
    "📬 Notification:",
    "Notification:",
)
NOTIFICATION_LABELS = frozenset({"notification", "inbox"})

CURRENCY_KW = (
    "revenue", "payment", "invoice", "cash", "wallet", "crypto", "bank",
    "income", "monetize", "sell", "price", "pricing", "mrr", "arr",
    "wealth", "profit", "earn", "payout", "transfer", "deposit",
)
PROJECT_KW = (
    "milestone", "ship", "launch", "release", "deploy", "unlock",
    "blocker", "critical path", "mvp", "beta", "ga", "production",
    "singularity", "evolution", "self-evolve", "apex",
)
CONFLICT_KW = (
    "conflict", "resolve", "dispute", "unblock", "stuck", "deadlock",
    "priority", "escalate", "decision needed", "owner decision",
)
HIGH_LABELS = {
    "bug", "security", "urgent", "critical", "blocker", "revenue",
    "opportunity",
}


def _headers() -> dict:
    token = os.getenv("GH_FULL_PAT") or os.getenv("GITHUB_TOKEN")
    if not token:
        return {}
    return {"Authorization": f"token {token}", "Accept": "application/vnd.github+json"}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _is_non_work_issue(issue: Dict[str, Any]) -> bool:
    title = issue.get("title") or ""
    labels = [str(l.get("name", "")).lower() for l in (issue.get("labels") or [])]
    if any(lab in STATUS_LABELS for lab in labels):
        return True
    if any(title.startswith(p) for p in STATUS_TITLE_PREFIXES):
        return True
    if "(auto-updated)" in title.lower():
        return True
    if any(title.startswith(p) for p in NOTIFICATION_TITLE_PREFIXES):
        return True
    if "notification" in labels and "inbox" in labels:
        return True
    return False


def _score_text(blob: str) -> Tuple[float, List[str]]:
    lower = (blob or "").lower()
    score = 0.0
    cats: List[str] = []
    if any(k in lower for k in CURRENCY_KW):
        score += 40.0
        cats.append("currency")
    if any(k in lower for k in PROJECT_KW):
        score += 30.0
        cats.append("project")
    if any(k in lower for k in CONFLICT_KW):
        score += 25.0
        cats.append("conflict")
    return score, cats


def _score_issue(issue: Dict[str, Any], repo: str) -> Dict[str, Any]:
    title = issue.get("title") or ""
    body = (issue.get("body") or "")[:2000]
    labels = [str(l.get("name", "")).lower() for l in (issue.get("labels") or [])]
    blob = f"{title}\n{body}\n{' '.join(labels)}"

    score, cats = _score_text(blob)
    score += 20.0

    for lab in labels:
        if lab in HIGH_LABELS:
            score += 15.0
        if lab in ("revenue", "opportunity", "blocker", "security"):
            score += 20.0

    comments = int(issue.get("comments") or 0)
    if comments == 0:
        score += 10.0
    elif comments < 3:
        score += 5.0

    if repo == HOST_REPO:
        score += 5.0

    score = min(score, 100.0)

    return {
        "repo": repo,
        "number": issue.get("number"),
        "title": title[:160],
        "html_url": issue.get("html_url"),
        "labels": labels,
        "score": round(score, 1),
        "categories": cats,
        "comments": comments,
        "updated_at": issue.get("updated_at"),
        "is_status": False,
    }


def fetch_open_issues(repo: str, per_page: int = 20) -> List[Dict[str, Any]]:
    headers = _headers()
    if not headers:
        return []
    try:
        resp = requests.get(
            f"https://api.github.com/repos/{repo}/issues",
            headers=headers,
            params={
                "state": "open",
                "per_page": per_page,
                "sort": "updated",
                "direction": "desc",
            },
            timeout=20,
        )
        if resp.status_code != 200:
            return []
        items = resp.json() or []
        return [i for i in items if not i.get("pull_request")]
    except Exception:
        return []


def rank_fleet_roi(max_per_repo: int = 12) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    work: List[Dict[str, Any]] = []
    non_work: List[Dict[str, Any]] = []
    for repo in FLEET:
        issues = fetch_open_issues(repo, per_page=max_per_repo)
        for issue in issues:
            if _is_non_work_issue(issue):
                non_work.append({
                    "repo": repo,
                    "number": issue.get("number"),
                    "title": (issue.get("title") or "")[:160],
                    "html_url": issue.get("html_url"),
                    "labels": [str(l.get("name", "")).lower() for l in (issue.get("labels") or [])],
                    "is_status": True,
                })
                continue
            work.append(_score_issue(issue, repo))
    work.sort(key=lambda x: x["score"], reverse=True)
    return work, non_work


def build_next_prompt(top: Optional[Dict[str, Any]]) -> str:
    if not top:
        return (
            "No high-ROI open work issue across fleet (status + notification triage excluded). "
            "Next: open one real work issue on the highest-leverage repo "
            "(prefer zero-cost-wealth-playbook-tool for currency, or singularity-operator "
            "for project unlock) with labels `catalyst` + `revenue` or `blocker`, "
            "then re-run the agent."
        )
    cats = ", ".join(top.get("categories") or ["general"])
    return (
        f"Execute the root ROI action on {top['repo']}#{top['number']}: "
        f"{top['title']}. Categories: {cats}. "
        f"Do the toughest real work first (no simulation). "
        f"Produce measurable progress (closed loop, draft PR, or currency-adjacent artifact) "
        f"and report the exact next prompt after that."
    )


def find_roi_issue(headers: dict) -> Optional[int]:
    try:
        resp = requests.get(
            f"https://api.github.com/repos/{HOST_REPO}/issues",
            headers=headers,
            params={"state": "open", "per_page": 40, "labels": "roi-catalyst"},
            timeout=20,
        )
        if resp.status_code == 200:
            for issue in resp.json() or []:
                if (issue.get("title") or "").startswith("🚀 Fleet ROI Catalyst"):
                    return issue.get("number")
        resp2 = requests.get(
            f"https://api.github.com/repos/{HOST_REPO}/issues",
            headers=headers,
            params={"state": "open", "per_page": 30},
            timeout=20,
        )
        if resp2.status_code == 200:
            for issue in resp2.json() or []:
                if (issue.get("title") or "").startswith("🚀 Fleet ROI Catalyst"):
                    return issue.get("number")
    except Exception as e:
        print(f"[roi_catalyst] find_roi_issue: {e}")
    return None


def upsert_roi_issue(
    ranked: List[Dict[str, Any]],
    top: Optional[Dict[str, Any]],
    status_issues: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    headers = _headers()
    if not headers:
        return {"error": "NO_TOKEN"}

    lines = [
        f"**Generated:** `{_utc_now_iso()}`  ",
        f"**Module:** ROI Catalyst v{ROI_VERSION} (status + notification triage excluded)  ",
        f"**Fleet size:** {len(FLEET)}  ",
        f"**Work candidates scored:** {len(ranked)}  ",
        f"**Non-work excluded:** {len(status_issues or [])}",
        "",
        "### Root action (highest ROI — real work only)",
    ]
    if top:
        lines.append(
            f"- **[{top['repo']}#{top['number']}]({top.get('html_url')})** — score **{top['score']}**  \n"
            f"  `{top['title']}`  \n"
            f"  categories: `{', '.join(top.get('categories') or ['—'])}` | labels: `{', '.join(top.get('labels') or [])}`"
        )
        lines.append("")
        lines.append("**Next prompt (copy-paste):**")
        lines.append(f"```\n{build_next_prompt(top)}\n```")
    else:
        lines.append("- No scored open *work* issue above threshold (status + notification triage ignored).")
        lines.append("")
        lines.append(f"**Next prompt:** `{build_next_prompt(None)}`")

    lines.extend(["", "### Top 8 ranked work candidates"])
    if ranked:
        for i, item in enumerate(ranked[:8], 1):
            lines.append(
                f"{i}. [{item['repo']}#{item['number']}]({item.get('html_url')}) "
                f"score={item['score']} — {item['title'][:90]}"
            )
    else:
        lines.append("_None — fleet has no non-status open work issues._")

    if status_issues:
        lines.extend(["", "### Status / notification triage (excluded from ranking)"])
        for s in status_issues[:8]:
            lines.append(
                f"- [{s['repo']}#{s['number']}]({s.get('html_url')}) — {s['title'][:80]}"
            )

    lines.extend([
        "",
        "---",
        f"Auto-updated by **ROI Catalyst v{ROI_VERSION}**. Scoring favors currency, project unlock, conflict.",
        "Excluded: status labels, auto-updated titles, and 📬 Notification / inbox triage issues.",
        "Safe: issues + status only. No force-merge.",
    ])
    body = "\n".join(lines)

    existing = find_roi_issue(headers)
    try:
        if existing:
            resp = requests.patch(
                f"https://api.github.com/repos/{HOST_REPO}/issues/{existing}",
                headers=headers,
                json={"body": body, "title": ROI_ISSUE_TITLE},
                timeout=20,
            )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "action": "updated",
                    "number": data.get("number"),
                    "html_url": data.get("html_url"),
                }
            return {"error": f"patch:{resp.status_code}"}

        resp = requests.post(
            f"https://api.github.com/repos/{HOST_REPO}/issues",
            headers=headers,
            json={
                "title": ROI_ISSUE_TITLE,
                "body": body,
                "labels": ["roi-catalyst", "catalyst", "self-heal"],
            },
            timeout=20,
        )
        if resp.status_code in (200, 201):
            data = resp.json()
            return {
                "action": "created",
                "number": data.get("number"),
                "html_url": data.get("html_url"),
            }
        return {"error": f"create:{resp.status_code}", "detail": resp.text[:150]}
    except Exception as e:
        return {"error": str(e)[:150]}


def run_roi_catalyst(
    profile: Optional[Dict[str, Any]] = None,
    record_error: Optional[Any] = None,
) -> str:
    record = record_error or (lambda e, c="": print(f"[ERROR:{c}] {e}"))
    profile = profile if profile is not None else {}

    try:
        ranked, status_issues = rank_fleet_roi()
        top = ranked[0] if ranked else None
        if top and top["score"] < 30.0:
            top = None

        result = upsert_roi_issue(ranked, top, status_issues)
        next_prompt = build_next_prompt(top)

        profile["roi_catalyst_runs"] = int(profile.get("roi_catalyst_runs") or 0) + 1
        profile["roi_last_run"] = _utc_now_iso()
        if result.get("html_url"):
            profile["roi_issue_url"] = result["html_url"]
        if top:
            profile["roi_top_score"] = top["score"]
            profile["roi_top_ref"] = f"{top['repo']}#{top['number']}"
        else:
            profile["roi_top_score"] = 0
            profile["roi_top_ref"] = None

        artifact = {
            "generated_at": _utc_now_iso(),
            "version": ROI_VERSION,
            "work_candidates": len(ranked),
            "status_excluded": len(status_issues),
            "top": top,
            "next_prompt": next_prompt,
            "issue": result,
        }
        Path("roi-catalyst-status.json").write_text(json.dumps(artifact, indent=2) + "\n")

        summary = (
            f"roi_ok work={len(ranked)} status_excluded={len(status_issues)} "
            f"top={top['repo'] + '#' + str(top['number']) if top else 'none'} "
            f"score={top['score'] if top else 0} issue={result.get('action')}:{result.get('number')} "
            f"url={result.get('html_url', 'n/a')}"
        )
        print(f"[roi_catalyst] {summary}")
        print(f"[roi_catalyst] next_prompt: {next_prompt[:200]}")
        return summary
    except Exception as e:
        record(e, "roi_catalyst")
        return f"ROI_CATALYST_FAIL:{str(e)[:120]}"


if __name__ == "__main__":
    print(run_roi_catalyst())
