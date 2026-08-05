#!/usr/bin/env python3
"""
Agent v6.0 Unified — problem-solvers runner.

Scans + auto-fixes:
  1) Python SyntaxError
  2) npm peer conflicts (typescript vs typescript-eslint)
  3) Missing lockfiles
  4) Missing requirements.txt
  5) Outdated GitHub Actions
  6) Duplicate draft auto-PR cleanup
  7) Closed-loop ledger updates

Supports DRY_RUN=1, MAX_SOLVER_TASKS (default 8), writes agent-report.json.
"""

from __future__ import annotations

import json
import os
import sys
import time
import logging
from collections import Counter

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

try:
    from closed_loop import record_fix, mark_verified, note_reappear
    CLOSED_LOOP = True
except ImportError:
    CLOSED_LOOP = False

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("problem_solvers_runner")

try:
    from github import Github
    GITHUB_AVAILABLE = True
except ImportError:
    GITHUB_AVAILABLE = False

DRY_RUN = os.getenv("DRY_RUN", "0") == "1"
MAX_SOLVER_TASKS = int(os.getenv("MAX_SOLVER_TASKS", "8"))
VERSION = "6.0"


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
        if CLOSED_LOOP:
            try:
                record_fix("auto_pr", title, pr_number=pr.number)
            except Exception:
                pass
        return True
    except Exception as e:
        log.warning(f"PR create failed: {e}")
        return False


def cleanup_duplicate_draft_prs() -> int:
    """Close older open draft auto-fix PRs that share the same normalized title prefix."""
    if not GITHUB_AVAILABLE or DRY_RUN:
        return 0
    token = os.getenv("GITHUB_TOKEN")
    repo = os.getenv("REPO")
    if not token or not repo:
        return 0
    closed = 0
    try:
        g = Github(token)
        r = g.get_repo(repo)
        groups: dict = {}
        for pr in r.get_pulls(state="open"):
            if not pr.draft and not pr.title.startswith("\U0001f916"):
                continue
            if not (pr.title.startswith("\U0001f916") or (pr.head and pr.head.ref.startswith("auto-fix"))):
                continue
            key = pr.title.split(" in ")[0].strip() if " in " in pr.title else pr.title[:60]
            groups.setdefault(key, []).append(pr)
        for key, prs in groups.items():
            if len(prs) < 2:
                continue
            prs_sorted = sorted(prs, key=lambda p: p.number, reverse=True)
            for old in prs_sorted[1:]:
                try:
                    old.edit(state="closed")
                    closed += 1
                    log.info(f"Closed duplicate draft PR #{old.number}")
                except Exception as e:
                    log.debug(f"close skip {old.number}: {e}")
    except Exception as e:
        log.warning(f"duplicate cleanup error: {e}")
    return closed


def handle_python_syntax(task: dict) -> bool:
    path = task.get("path")
    if not path or not os.path.isfile(path):
        return False
    note = path + ".SYNTAX_ERROR.md"
    if not DRY_RUN:
        with open(note, "w") as fh:
            fh.write(f"# Syntax error in `{path}`\n\n{task.get('body', '')}\n")
    branch = f"auto-fix-pysyn-{int(time.time())}"
    return _branch_and_pr(
        f"\U0001f916 Docs: Python syntax error in {path}",
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
    proj = task.get("project_dir", ".")
    _git(f"cd {proj!r} && npm install --package-lock-only --legacy-peer-deps --ignore-scripts --no-audit 2>&1 || true")
    branch = f"auto-fix-peer-{int(time.time())}"
    return _branch_and_pr(
        f"\U0001f916 Fix peer conflict: {peer} -> {pin} in {proj}",
        task.get("body", "") + f"\n\nApplied: {res.get('output')}",
        branch,
    )


def handle_lockfile(task: dict) -> bool:
    proj = task.get("project_dir", ".")
    if DRY_RUN:
        log.info(f"[DRY_RUN] would generate lockfile for {proj}")
        return True
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
        f"\U0001f916 Lockfile: {proj}",
        f"Autonomous lockfile for `{proj}`.\n\n```\n{out[-800:]}\n```",
        branch,
    )


def handle_missing_requirements(task: dict) -> bool:
    proj = task.get("project_dir", ".")
    pins = task.get("pins") or ["requests>=2.28.0"]
    if DRY_RUN:
        log.info(f"[DRY_RUN] would write requirements.txt for {proj}")
        return True
    res = fix_missing_requirements(proj, pins)
    if not res.get("success"):
        return False
    branch = f"auto-fix-{int(time.time())}-pyreq"
    return _branch_and_pr(
        f"\U0001f916 Python deps: {proj}",
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
        return False
    branch = f"auto-fix-gha-{int(time.time())}"
    return _branch_and_pr(
        f"\U0001f916 GHA bump: {action} -> {new_ref}",
        task.get("body", "") + f"\n\nApplied: {res.get('output')}",
        branch,
    )


def main():
    log.info("problem_solvers_runner v%s starting (DRY_RUN=%s MAX=%s)", VERSION, DRY_RUN, MAX_SOLVER_TASKS)
    _git("git config user.name 'github-actions[bot]'")
    _git("git config user.email 'github-actions[bot]@users.noreply.github.com'")

    dup_closed = cleanup_duplicate_draft_prs()
    log.info("Duplicate draft PRs closed: %s", dup_closed)

    tasks = []
    tasks.extend(scan_python_syntax("."))
    tasks.extend(scan_peer_dependency_conflicts("."))
    tasks.extend(scan_lockfile_gaps_smart("."))
    tasks.extend(scan_missing_requirements("."))
    tasks.extend(scan_gha_deprecations("."))

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
    log.info("Found %s high-priority problems", len(tasks))

    if CLOSED_LOOP:
        types_seen = {t.get("type") for t in tasks}
        for ttype in types_seen:
            try:
                note_reappear(ttype)
            except Exception:
                pass

    report = {
        "version": VERSION,
        "dry_run": DRY_RUN,
        "max_tasks": MAX_SOLVER_TASKS,
        "duplicates_closed": dup_closed,
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
        log.info("Handling %s: %s", ttype, t.get("title"))
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
                if CLOSED_LOOP:
                    try:
                        record_fix(ttype, t.get("title", ""))
                    except Exception:
                        pass
        except Exception as e:
            log.warning("Task error: %s", e)
            entry["error"] = str(e)
        report["tasks"].append(entry)

    report["counts_by_type"] = dict(type_counts)
    report["solved"] = solved

    try:
        with open("agent-report.json", "w") as fh:
            json.dump(report, fh, indent=2)
        log.info("Wrote agent-report.json")
    except Exception as e:
        log.warning("Could not write report: %s", e)

    log.info("problem_solvers_runner v%s done — solved=%s", VERSION, solved)


if __name__ == "__main__":
    main()
