"""
Extension mixed into FailureSolver for v3.5 draft-PR auto-fixes.
Import and call from agent or wrap get_failure_solver.
"""
from __future__ import annotations
import base64
import os
from datetime import datetime
from typing import Any, Dict, Optional

import requests

SAFE_AUTO_FIX_CLASSES = frozenset({"timeout", "missing_dependency", "missing_file"})


def create_draft_pr_for_safe_class(solver, analysis: Dict) -> Optional[Dict]:
    """Attach to an existing FailureSolver instance. Creates draft PR with note file only."""
    if not solver.headers:
        return None
    top = analysis.get("classifications") or [{}]
    cls = top[0].get("class", "") if top else ""
    if cls not in SAFE_AUTO_FIX_CLASSES or analysis.get("top_score", 0) < 70:
        return None
    run = analysis.get("run") or {}
    run_id = run.get("id", "unknown")
    ts = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    path = f"docs/auto-remediation/{cls}-{run_id}-{ts}.md"
    notes = {
        "timeout": "Raise timeouts on HTTP calls to 60-120s; add 2-3 retries with backoff; check workflow timeout-minutes.",
        "missing_dependency": "Add the missing module to requirements.txt / package.json; ensure install step runs first; prefer pinned ranges.",
        "missing_file": "Add Path.exists() guards; create empty placeholder where design expects it; prefer fail-closed defaults.",
    }
    content = (
        f"# Auto-remediation note: {cls} (run #{run_id})\n\n"
        f"Detected by FailureSolver v3.5.0.\n\n"
        f"## Suggested minimal change\n{notes.get(cls, 'Investigate logs.')}\n\n"
        f"## Context\n- Run: {run.get('html_url', 'n/a')}\n"
        f"- Conclusion: `{run.get('conclusion')}`\n"
        f"- Branch: `{run.get('head_branch')}`\n\n"
        f"Safe draft PR artifact only. No production code modified automatically.\n"
    )
    branch_name = f"auto-fix/{cls}-{run_id}-{datetime.utcnow().strftime('%H%M%S')}"
    try:
        status, ref_data = solver._gh_get(f"https://api.github.com/repos/{solver.repo_name}/git/ref/heads/main")
        if status != 200 or not ref_data:
            return {"error": "cannot_get_main_ref"}
        main_sha = (ref_data.get("object") or {}).get("sha")
        if not main_sha:
            return {"error": "no_main_sha"}
        cr = requests.post(
            f"https://api.github.com/repos/{solver.repo_name}/git/refs",
            headers=solver.headers,
            json={"ref": f"refs/heads/{branch_name}", "sha": main_sha},
            timeout=20,
        )
        if cr.status_code not in (200, 201):
            return {"error": f"create_branch:{cr.status_code}"}
        put = requests.put(
            f"https://api.github.com/repos/{solver.repo_name}/contents/{path}",
            headers=solver.headers,
            json={
                "message": f"chore(auto-fix): {cls} remediation note for run {run_id} [FailureSolver v3.5]",
                "content": base64.b64encode(content.encode()).decode("ascii"),
                "branch": branch_name,
            },
            timeout=30,
        )
        if put.status_code not in (200, 201):
            return {"error": f"put_file:{put.status_code}"}
        pr = requests.post(
            f"https://api.github.com/repos/{solver.repo_name}/pulls",
            headers=solver.headers,
            json={
                "title": f"🛠️ Auto-fix draft: {cls} (run #{run_id})",
                "body": (
                    f"FailureSolver v3.5 detected **{cls}** and opened this draft PR with a minimal safe note.\n\n"
                    f"**Run:** {run.get('html_url')}\n**Score:** {analysis.get('top_score', 0):.0f}\n\n"
                    f"No production code modified. Review `docs/auto-remediation/` and apply manually.\n\nSafe by design — draft only."
                ),
                "head": branch_name,
                "base": "main",
                "draft": True,
            },
            timeout=20,
        )
        if pr.status_code in (200, 201):
            data = pr.json()
            solver.profile["draft_prs_created"] = solver.profile.get("draft_prs_created", 0) + 1
            return {"number": data.get("number"), "html_url": data.get("html_url"), "class": cls, "branch": branch_name}
        return {"error": f"create_pr:{pr.status_code}"}
    except Exception as e:
        solver.record_error(e, "create_draft_pr")
        return {"error": str(e)[:120]}
