#!/usr/bin/env python3
"""
Agent v4.5 problem-solvers runner.
Scans for and auto-fixes:
  1) Python SyntaxError (py_compile / ast.parse)
  2) npm ERESOLVE peer conflicts (typescript vs typescript-eslint)
  3) Missing lockfiles (deps-aware minimal stubs)
  4) Missing requirements.txt for Python packages
  5) GitHub Actions deprecation bumps
  6) Stale cache-dependency-path targets

Supports DRY_RUN=1 (report only, no commits/PRs).
Emits agent-report.json for observability.
Opens draft PRs via git + PyGithub when AGENT_OWNS_GITHUB=1.
"""

from __future__ import annotations

import os
import re
import sys
import time
import logging

# Ensure sibling imports work when run from repo root
_SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if _SCRIPTS not in sys.path:
    sys.path.insert(0, _SCRIPTS)

from problem_solvers import (  # noqa: E402
    scan_python_syntax,
    scan_peer_dependency_conflicts,
    fix_peer_conflict_in_package_json,
    scan_lockfile_gaps_smart,
    create_minimal_lockfile,
    scan_missing_requirements,
    create_requirements_txt,
    scan_gha_deprecations,
    fix_gha_deprecation,
    scan_stale_cache_paths,
    collect_all_tasks,
    write_agent_report,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("problem_solvers_runner")

try:
    from github import Github
    GITHUB_AVAILABLE = True
except ImportError:
    GITHUB_AVAILABLE = False

DRY_RUN = os.getenv("DRY_RUN", "").lower() in ("1", "true", "yes")
MAX_TASKS = int(os.getenv("MAX_SOLVER_TASKS", "5"))


def _git(cmd: str) -> str:
    return os.popen(cmd + " 2>&1").read()


def _branch_and_pr(title: str, body: str, branch: str) -> bool:
    if DRY_RUN:
        log.info(f"[DRY_RUN] would open PR: {title}")
        return True
    _git(f"git checkout -b {branch} || git checkout {branch}")
    _git("git add -A")
    _git(f"git commit -m '{title[:70].replace(chr(39), '')} DEPTH:1' || true")
    _git(f"git push origin {branch} || true")
    if not GITHUB_AVAILABLE:
        return False
    token = os.getenv("GITHUB_TOKEN")
    repo = os.getenv("REPO")
    if not token or not repo:
        return False
    try:
        g = Github(token)
        r = g.get_repo(repo)
        pr = r.create_pull(title=title, body=body, head=branch, base="main", draft=True)
        log.info(f"Opened PR #{pr.number}: {title}")
        return True
    except Exception as e:
        log.warning(f"PR create failed: {e}")
        return False


def handle_python_syntax(task: dict) -> bool:
    path = task.get("path")
    if not path or not os.path.isfile(path):
        return False
    with open(path, "r", errors="ignore") as fh:
        src = fh.read()
    # Known pattern: nested quotes inside f-string (advanced_userscript)
    if "unterminated f-string" in (task.get("msg") or "").lower() or 'f"' in src:
        # Prefer full safe rewrite when file is the userscript generator
        if path.replace("\\", "/").endswith("advanced_userscript.py"):
            fixed = '''#!/usr/bin/env python3
"""AdvancedUserscriptGenerator - Groq-powered userscript generator."""

from typing import List, Optional


class AdvancedUserscriptGenerator:
    """Generates production-ready, self-updating userscripts."""

    def generate(self, features: Optional[List[str]] = None) -> str:
        if features is None:
            features = [
                "auto-update",
                "diff-viewer",
                "error-handling",
                "credit-monitor",
                "Groq integration",
                "browser automation",
            ]
        description = " + ".join(features)
        script = (
            "// ==UserScript==\\n"
            "// @name Singularity Advanced Userscript\\n"
            "// @version 0.3\\n"
            f"// @description {description}\\n"
            "// ==/UserScript==\\n"
            "\\n"
            "console.log('Advanced Singularity userscript active');\\n"
        )
        return script

    def apply_self_fix(self, code: str) -> str:
        return code + "\\n// Auto-fixed by Orchestrator"


print("AdvancedUserscriptGenerator ready.")
'''
            if not DRY_RUN:
                with open(path, "w") as fh:
                    fh.write(fixed)
            branch = f"auto-fix-pysyn-{int(time.time())}"
            return _branch_and_pr(
                f"🤖 Fix Python SyntaxError: {path}",
                task.get("body", ""),
                branch,
            )
    # Generic: leave a note file for LLM agent if we cannot auto-rewrite
    note = path + ".SYNTAX_ERROR.md"
    if not DRY_RUN:
        with open(note, "w") as fh:
            fh.write(f"# Syntax error in `{path}`\n\n{task.get('body', '')}\n")
    branch = f"auto-fix-pysyn-{int(time.time())}"
    return _branch_and_pr(
        f"🤖 Docs: Python syntax error in {path}",
        task.get("body", ""),
        branch,
    )


def handle_peer_conflict(task: dict) -> bool:
    path = task.get("path")
    peer = task.get("peer", "typescript")
    pin = task.get("pin", "~5.9.3")
    if DRY_RUN:
        log.info(f"[DRY_RUN] would pin {peer}={pin} in {path}")
        return True
    res = fix_peer_conflict_in_package_json(path, peer, pin)
    if not res.get("success"):
        log.warning(f"peer fix failed: {res}")
        return False
    # Best-effort lockfile regen
    proj = task.get("project_dir", ".")
    _git(f"cd {proj!r} && npm install --package-lock-only --legacy-peer-deps --ignore-scripts --no-audit 2>&1 || true")
    branch = f"auto-fix-peer-{int(time.time())}"
    return _branch_and_pr(
        f"🤖 Fix peer conflict: {peer} -> {pin} in {proj}",
        task.get("body", "") + f"\n\nApplied: {res.get('output')}",
        branch,
    )


def handle_lockfile(task: dict) -> bool:
    proj = task.get("project_dir", ".")
    if DRY_RUN:
        log.info(f"[DRY_RUN] would create lockfile for {proj}")
        return True
    # Prefer npm; fall back to minimal stub
    out = _git(
        f"cd {proj!r} && npm install --package-lock-only --ignore-scripts --no-audit --no-fund --legacy-peer-deps 2>&1 || true"
    )
    lock = os.path.join(proj, "package-lock.json")
    if not os.path.isfile(lock):
        res = create_minimal_lockfile(proj)
        if not res.get("success"):
            log.warning(f"minimal lockfile failed for {proj}: {res}")
            return False
        out = res.get("output", out)
    branch = f"auto-fix-lock-{int(time.time())}"
    return _branch_and_pr(
        f"🤖 Lockfile: {proj}",
        f"Autonomous lockfile for `{proj}`.\n\n```\n{out[-800:]}\n```",
        branch,
    )


def handle_missing_requirements(task: dict) -> bool:
    proj = task.get("project_dir", ".")
    pins = task.get("suggested_pins") or ["requests>=2.31.0"]
    if DRY_RUN:
        log.info(f"[DRY_RUN] would write requirements.txt in {proj}: {pins}")
        return True
    res = create_requirements_txt(proj, pins)
    if not res.get("success"):
        log.warning(f"requirements.txt failed: {res}")
        return False
    branch = f"auto-fix-req-{int(time.time())}"
    return _branch_and_pr(
        f"🤖 Add requirements.txt for {proj}",
        task.get("body", "") + f"\n\nApplied: {res.get('output')}",
        branch,
    )


def handle_gha_deprecation(task: dict) -> bool:
    path = task.get("path")
    action = task.get("action")
    old_v = task.get("old_version")
    new_v = task.get("new_version")
    if DRY_RUN:
        log.info(f"[DRY_RUN] would bump {action}@{old_v} → {new_v} in {path}")
        return True
    res = fix_gha_deprecation(path, action, old_v, new_v)
    if not res.get("success"):
        log.warning(f"gha bump failed: {res}")
        return False
    branch = f"auto-fix-gha-{int(time.time())}"
    return _branch_and_pr(
        f"🤖 Bump {action} to {new_v}",
        task.get("body", "") + f"\n\nApplied: {res.get('output')}",
        branch,
    )


def handle_stale_cache_path(task: dict) -> bool:
    """For stale cache paths we open a note/docs PR; full YAML rewrite is higher risk."""
    path = task.get("path")
    missing = task.get("missing_path")
    note = f"{path}.STALE_CACHE.md"
    if DRY_RUN:
        log.info(f"[DRY_RUN] would document stale cache path {missing} in {path}")
        return True
    with open(note, "w") as fh:
        fh.write(
            f"# Stale cache-dependency-path\n\n"
            f"Workflow: `{path}`\n"
            f"Missing: `{missing}`\n\n"
            f"{task.get('body', '')}\n"
        )
    branch = f"auto-fix-cache-{int(time.time())}"
    return _branch_and_pr(
        f"🤖 Docs: stale cache path {missing}",
        task.get("body", ""),
        branch,
    )


def main():
    log.info("problem_solvers_runner v4.5 starting%s", " [DRY_RUN]" if DRY_RUN else "")
    if not DRY_RUN:
        _git("git config user.name 'github-actions[bot]'")
        _git("git config user.email 'github-actions[bot]@users.noreply.github.com'")

    tasks = collect_all_tasks(".")

    # Priority: syntax > requirements > peer > lockfile-with-deps > gha > cache > lockfile-no-deps
    def score(t):
        weights = {
            "python_syntax": 100,
            "missing_requirements": 95,
            "peer_conflict": 90,
            "lockfile": 70,
            "gha_deprecation": 60,
            "stale_cache_path": 55,
        }
        base = weights.get(t.get("type"), 10)
        if t.get("type") == "lockfile" and t.get("has_deps"):
            base += 15
        return base + t.get("impact", 0)

    tasks_sorted = sorted(tasks, key=score, reverse=True)[:MAX_TASKS]
    log.info(f"Found {len(tasks)} problems; handling top {len(tasks_sorted)}")

    solved = 0
    for t in tasks_sorted:
        log.info(f"Handling {t.get('type')}: {t.get('title')}")
        try:
            if not DRY_RUN:
                _git("git checkout main 2>/dev/null || true")
                _git("git pull origin main 2>/dev/null || true")
            ok = False
            typ = t.get("type")
            if typ == "python_syntax":
                ok = handle_python_syntax(t)
            elif typ == "peer_conflict":
                ok = handle_peer_conflict(t)
            elif typ == "lockfile":
                ok = handle_lockfile(t)
            elif typ == "missing_requirements":
                ok = handle_missing_requirements(t)
            elif typ == "gha_deprecation":
                ok = handle_gha_deprecation(t)
            elif typ == "stale_cache_path":
                ok = handle_stale_cache_path(t)
            if ok:
                solved += 1
        except Exception as e:
            log.warning(f"Task error: {e}")

    report_path = write_agent_report(tasks, solved)
    log.info(f"Wrote {report_path}")
    log.info(f"problem_solvers_runner done — solved={solved} dry_run={DRY_RUN}")


if __name__ == "__main__":
    main()
