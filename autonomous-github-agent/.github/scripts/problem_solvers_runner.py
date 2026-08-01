#!/usr/bin/env python3
"""
Agent v4.5 problem-solvers runner.
Scans for and auto-fixes:
  1) Python SyntaxError (py_compile / ast.parse)
  2) npm ERESOLVE peer conflicts (typescript vs typescript-eslint)
  3) Missing lockfiles (deps-aware minimal stubs)
  4) Missing requirements.txt for Python projects with 3rd-party imports
  5) Outdated GitHub Actions versions
Opens draft PRs via git + PyGithub when AGENT_OWNS_GITHUB=1.
Supports DRY_RUN=1 (report only) and MAX_SOLVER_TASKS (default 5).
Writes agent-report.json with structured counts.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import logging
from collections import Counter

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
    fix_missing_requirements,
    scan_gha_deprecations,
    fix_gha_version,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("problem_solvers_runner")

try:
    from github import Github
    GITHUB_AVAILABLE = True
except ImportError:
    GITHUB_AVAILABLE = False

DRY_RUN = os.getenv("DRY_RUN", "0") == "1"
MAX_SOLVER_TASKS = int(os.getenv("MAX_SOLVER_TASKS", "5"))


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
    if "unterminated f-string" in (task.get("msg") or "").lower() or "f\"" in src:
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
        log.info(f"[DRY_RUN] would generate lockfile for {proj}")
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
    pins = task.get("pins") or ["requests>=2.28.0"]
    if DRY_RUN:
        log.info(f"[DRY_RUN] would write requirements.txt for {proj} with {pins}")
        return True
    res = fix_missing_requirements(proj, pins)
    if not res.get("success"):
        log.warning(f"requirements fix failed: {res}")
        return False
    branch = f"auto-fix-{int(time.time())}-pyreq_{proj.replace('/', '-')[:20]}"
    return _branch_and_pr(
        f"🤖 Python deps: {proj}",
        task.get("body", "") + f"\n\nOutput:\n```\n{res.get('output')}\n```",
        branch,
    )


def handle_gha_deprecation(task: dict) -> bool:
    path = task.get("path")
    action = task.get("action")
    new_ref = task.get("new_ref")
    if DRY_RUN:
        log.info(f"[DRY_RUN] would bump {action} to {new_ref} in {path}")
        return True
    res = fix_gha_version(path, action, new_ref)
    if not res.get("success"):
        log.warning(f"gha fix failed: {res}")
        return False
    branch = f"auto-fix-gha-{int(time.time())}"
    return _branch_and_pr(
        f"🤖 GHA bump: {action} -> {new_ref}",
        task.get("body", "") + f"\n\nApplied: {res.get('output')}",
        branch,
    )


def main():
    log.info("problem_solvers_runner v4.5 starting (DRY_RUN=%s MAX=%s)", DRY_RUN, MAX_SOLVER_TASKS)
    _git("git config user.name 'github-actions[bot]'")
    _git("git config user.email 'github-actions[bot]@users.noreply.github.com'")

    tasks = []
    tasks.extend(scan_python_syntax("."))
    tasks.extend(scan_peer_dependency_conflicts("."))
    tasks.extend(scan_lockfile_gaps_smart("."))
    tasks.extend(scan_missing_requirements("."))
    tasks.extend(scan_gha_deprecations("."))

    # Priority order: syntax → requirements → peer → lockfile(with deps) → GHA → lockfile(no deps)
    def score(t):
        weights = {
            "python_syntax": 100,
            "missing_requirements": 95,
            "peer_conflict": 90,
            "lockfile": 70,
            "gha_deprecation": 65,
        }
        base = weights.get(t.get("type"), 10)
        if t.get("type") == "lockfile" and t.get("has_deps"):
            base += 15
        return base + t.get("impact", 0)

    tasks = sorted(tasks, key=score, reverse=True)[:MAX_SOLVER_TASKS]
    log.info(f"Found {len(tasks)} high-priority problems (capped at {MAX_SOLVER_TASKS})")

    report = {
        "version": "4.5",
        "dry_run": DRY_RUN,
        "max_tasks": MAX_SOLVER_TASKS,
        "scanned_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "tasks": [],
        "counts_by_type": {},
        "solved": 0,
    }
    type_counts = Counter()
    solved = 0

    for t in tasks:
        ttype = t.get("type", "unknown")
        type_counts[ttype] += 1
        log.info(f"Handling {ttype}: {t.get('title')}")
        entry = {"type": ttype, "title": t.get("title"), "impact": t.get("impact"), "risk": t.get("risk"), "success": False}
        try:
            if not DRY_RUN:
                _git("git checkout main 2>/dev/null || true")
                _git("git pull origin main 2>/dev/null || true")
            ok = False
            if ttype == "python_syntax":
                ok = handle_python_syntax(t)
            elif ttype == "peer_conflict":
                ok = handle_peer_conflict(t)
            elif ttype == "lockfile":
                ok = handle_lockfile(t)
            elif ttype == "missing_requirements":
                ok = handle_missing_requirements(t)
            elif ttype == "gha_deprecation":
                ok = handle_gha_deprecation(t)
            if ok:
                solved += 1
                entry["success"] = True
        except Exception as e:
            log.warning(f"Task error: {e}")
            entry["error"] = str(e)
        report["tasks"].append(entry)

    report["counts_by_type"] = dict(type_counts)
    report["solved"] = solved

    try:
        with open("agent-report.json", "w") as fh:
            json.dump(report, fh, indent=2)
        log.info("Wrote agent-report.json")
    except Exception as e:
        log.warning(f"Could not write report: {e}")

    log.info(f"problem_solvers_runner done — solved={solved}")


if __name__ == "__main__":
    main()
