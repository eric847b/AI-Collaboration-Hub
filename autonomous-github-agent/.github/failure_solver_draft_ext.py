"""
Safe FailureSolver draft-PR extension.
Creates review-only remediation notes for high-confidence classes while deduplicating
repeated fingerprints so recurring failures cannot create runaway branches/PRs.
"""
from __future__ import annotations

import base64
import hashlib
import re

import requests

SAFE_AUTO_FIX_CLASSES = frozenset({"timeout", "missing_dependency", "missing_file"})


def _fingerprint(analysis: dict, cls: str) -> str:
    run = analysis.get("run") or {}
    top = (analysis.get("classifications") or [{}])[0]
    context = re.sub(r"\d+", "#", str(top.get("context", "")).lower())
    raw = "|".join((str(run.get("name", "")), str(run.get("head_branch", "")), cls, context))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def _existing_pr(solver, fingerprint: str) -> dict | None:
    if not solver.headers:
        return None
    try:
        status, data = solver._gh_get(
            f"https://api.github.com/repos/{solver.repo_name}/pulls",
            {"state": "open", "per_page": 100},
        )
        if status != 200 or not data:
            return None
        for pr in data:
            body = str(pr.get("body") or "")
            if f"FailureSolver fingerprint: `{fingerprint}`" in body:
                return {"number": pr.get("number"), "html_url": pr.get("html_url"), "class": "existing", "fingerprint": fingerprint}
    except Exception as e:
        solver.record_error(e, "draft_pr_dedupe")
    return None


def create_draft_pr_for_safe_class(solver, analysis: dict) -> dict | None:
    """Create one review-only PR per stable failure fingerprint; never modify production code."""
    if not solver.headers:
        return None
    top = analysis.get("classifications") or [{}]
    cls = top[0].get("class", "") if top else ""
    if cls not in SAFE_AUTO_FIX_CLASSES or analysis.get("top_score", 0) < 70:
        return None

    run = analysis.get("run") or {}
    run_id = run.get("id", "unknown")
    fingerprint = _fingerprint(analysis, cls)
    existing = _existing_pr(solver, fingerprint)
    if existing:
        solver.profile["draft_prs_deduped"] = solver.profile.get("draft_prs_deduped", 0) + 1
        return existing

    path = f"docs/auto-remediation/{cls}-{fingerprint}.md"
    notes = {
        "timeout": "Raise timeouts on HTTP calls to 60-120s; add 2-3 retries with backoff; check workflow timeout-minutes.",
        "missing_dependency": "Add the missing module to requirements.txt / package.json; ensure install step runs first; prefer pinned ranges.",
        "missing_file": "Add Path.exists() guards; create empty placeholder where design expects it; prefer fail-closed defaults.",
    }
    content = (
        f"# Auto-remediation note: {cls}\n\n"
        f"Detected by FailureSolver.\n\n"
        f"## Suggested minimal change\n{notes.get(cls, 'Investigate logs.')}\n\n"
        f"## Context\n- Source run: {run.get('html_url', 'n/a')}\n"
        f"- Run id: `{run_id}`\n- Conclusion: `{run.get('conclusion')}`\n"
        f"- Branch: `{run.get('head_branch')}`\n- Fingerprint: `{fingerprint}`\n\n"
        f"Review-only artifact. No production code modified automatically.\n"
    )
    branch_name = f"auto-fix/{cls}-{fingerprint}"
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
                "message": f"chore(auto-fix): {cls} remediation note [FailureSolver]",
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
                "title": f"🛠️ Auto-fix draft: {cls} ({fingerprint})",
                "body": (
                    f"FailureSolver detected **{cls}** with score {analysis.get('top_score', 0):.0f}.\n\n"
                    f"**Run:** {run.get('html_url')}\n"
                    f"**FailureSolver fingerprint: `{fingerprint}`**\n\n"
                    f"Review-only remediation note. No production code modified automatically."
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
            return {"number": data.get("number"), "html_url": data.get("html_url"), "class": cls, "branch": branch_name, "fingerprint": fingerprint}
        return {"error": f"create_pr:{pr.status_code}"}
    except Exception as e:
        solver.record_error(e, "create_draft_pr")
        return {"error": str(e)[:120]}
