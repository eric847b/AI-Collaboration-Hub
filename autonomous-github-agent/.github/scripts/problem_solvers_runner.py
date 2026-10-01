#!/usr/bin/env python3
"""
Agent v6.2 Unified — problem-solvers runner + auto_ops.

Scans + auto-fixes:
  0) auto_ops: duplicate draft spam, Dependabot patches, stale branches, actionlint
  1) Python SyntaxError
  2) npm peer conflicts (typescript vs typescript-eslint)
  3) Missing lockfiles (skip Userscripts / root-policy paths)
  4) Missing requirements.txt
  5) Outdated GitHub Actions
  6) Closed-loop ledger updates

Supports DRY_RUN=1, MAX_SOLVER_TASKS (default 8), writes agent-report.json.

v6.2: every bot PR type is deduped (not just lockfiles). Opening a new
auto-fix-peer / auto-fix-pysyn PR when one already exists (open, or closed
in the last 48h) is how 62 duplicate branches accumulated on 2026-10-01.
"""

from __future__ import annotations

import contextlib
import json
import logging
import os
import sys
import time
from collections import Counter
from datetime import datetime, timezone, timedelta

_SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if _SCRIPTS not in sys.path:
    sys.path.insert(0, _SCRIPTS)

from problem_solvers import (  # noqa: E402
    create_minimal_lockfile,
    fix_gha_version,
    fix_missing_requirements,
    fix_peer_conflict_in_package_json,
    scan_gha_deprecations,
    scan_lockfile_gaps_smart,
    scan_missing_requirements,
    scan_peer_dependency_conflicts,
    scan_python_syntax,
)

try:
    from closed_loop import note_reappear, record_fix
    CLOSED_LOOP = True
except ImportError:
    CLOSED_LOOP = False

try:
    import auto_ops
    AUTO_OPS = True
except ImportError:
    AUTO_OPS = False

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("problem_solvers_runner")

try:
    from github import Github
    GITHUB_AVAILABLE = True
except ImportError:
    GITHUB_AVAILABLE = False

DRY_RUN = os.getenv("DRY_RUN", "0") == "1"
MAX_SOLVER_TASKS = int(os.getenv("MAX_SOLVER_TASKS", "8"))
VERSION = "6.2"
CLOSED_PR_LOOKBACK_HOURS = int(os.getenv("CLOSED_PR_LOOKBACK_HOURS", "48"))

SKIP_LOCKFILE_PATH_TOKENS = (
    "userscripts",
    "userscript suite",
    "ai chat userscript studio",
    "/archive/",
    "/archives/",
)

_TITLE_PREFIXES = (
    "🤖 lockfile:",
    "🤖 lockfile",
    "🤖 fix peer conflict:",
    "🤖 docs:",
    "🤖 python deps:",
    "🤖 gha bump:",
    "🤖",
)


def _git(cmd: str) -> str:
    return os.popen(cmd + " 2>&1").read()


def _should_skip_lockfile_path(proj: str) -> bool:
    lower = (proj or ".").replace("\\", "/").lower()
    if lower in (".", "") or lower.endswith("/.") or lower == "./":
        # Root package.json is empty-deps; never open lockfile PRs for "."
        return True
    return any(t in lower for t in SKIP_LOCKFILE_PATH_TOKENS)


def title_needle(title: str) -> str:
    """Stable key for bot-PR dedupe. Strips emoji/type prefix, keeps the target."""
    t = (title or "").lower().strip()
    for prefix in _TITLE_PREFIXES:
        if t.startswith(prefix):
            t = t[len(prefix):].strip()
            break
    return t[:50]


def _is_bot_pr(title: str, head_ref: str) -> bool:
    t = (title or "").lower()
    h = (head_ref or "").lower()
    return t.startswith("🤖") or "lockfile" in t or h.startswith("auto-fix")


def _pr_matches_needle(title: str, head_ref: str, needle: str) -> bool:
    if not needle:
        return False
    n = needle.lower()[:50]
    t = (title or "").lower()
    h = (head_ref or "").lower()
    return n in t or n in h or n in title_needle(title)


def open_bot_pr_exists_for(needle: str) -> bool:
    """True if an open or recently-closed bot PR already covers this needle.

    Recently-closed matters: auto_ops closes duplicate drafts, and without
    this lookback the next solver pass immediately opens a replacement.
    """
    if not GITHUB_AVAILABLE or not needle:
        return False
    token = os.getenv("GITHUB_TOKEN")
    repo = os.getenv("REPO")
    if not token or not repo:
        return False
    cutoff = datetime.now(timezone.utc) - timedelta(hours=CLOSED_PR_LOOKBACK_HOURS)
    try:
        g = Github(token)
        r = g.get_repo(repo)
        for pr in r.get_pulls(state="open"):
            head = ""
            with contextlib.suppress(Exception):
                head = pr.head.ref or ""
            if not _is_bot_pr(pr.title or "", head):
                continue
            if _pr_matches_needle(pr.title or "", head, needle):
                return True
        checked = 0
        for pr in r.get_pulls(state="closed", sort="updated", direction="desc"):
            checked += 1
            if checked > 40:
                break
            updated = pr.updated_at
            if updated is not None:
                if updated.tzinfo is None:
                    updated = updated.replace(tzinfo=timezone.utc)
                if updated < cutoff:
                    break
            head = ""
            with contextlib.suppress(Exception):
                head = pr.head.ref or ""
            if not _is_bot_pr(pr.title or "", head):
                continue
            if _pr_matches_needle(pr.title or "", head, needle):
                return True
        return False
    except Exception as e:
        log.debug(f"open_bot_pr_exists_for: {e}")
        return False


def _reset_to_main() -> None:
    _git("git checkout -- .")
    _git("git clean -fd -e agent-report.json -e auto-ops-report.json -e auto-fix-ledger.json")
    _git("git checkout main 2>/dev/null || git checkout -B main")
    _git("git pull origin main 2>/dev/null || true")


def _branch_and_pr(title: str, body: str, branch: str) -> bool:
    if DRY_RUN:
        log.info(f"[DRY_RUN] would open PR: {title}")
        return True
    needle = title_needle(title)
    if open_bot_pr_exists_for(needle):
        log.info(f"Skip PR — bot PR already exists for: {title}")
        _reset_to_main()
        return False
    dirty = _git("git status --porcelain")
    if not dirty.strip():
        log.info(f"Skip PR — no working-tree changes for: {title}")
        return False
    _git("git checkout main 2>/dev/null || true")
    _git(f"git checkout -b {branch} || git checkout {branch}")
    _git("git add -A")
    msg = title[:70].replace("'", "")
    _git(f"git commit -m '{msg}' || true")
    _git(f"git push origin {branch} || true")
    if not GITHUB_AVAILABLE:
        _reset_to_main()
        return False
    token = os.getenv("GITHUB_TOKEN")
    repo = os.getenv("REPO")
    if not token or not repo:
        _reset_to_main()
        return False
    try:
        g = Github(token)
        r = g.get_repo(repo)
        pr = r.create_pull(title=title, body=body, head=branch, base="main", draft=True)
        log.info(f"Opened PR #{pr.number}: {title}")
        if CLOSED_LOOP:
            with contextlib.suppress(Exception):
                record_fix("auto_pr", title, pr_number=pr.number)
        _reset_to_main()
        return True
    except Exception as e:
        log.warning(f"PR create failed: {e}")
        _reset_to_main()
        return False


def handle_python_syntax(task: dict) -> bool:
    path = task.get("path")
    if not path or not os.path.isfile(path):
        return False
    note = path + ".SYNTAX_ERROR.md"
    if os.path.isfile(note):
        log.info(f"Skip pysyn — note already exists: {note}")
        return False
    if open_bot_pr_exists_for(title_needle(f"🤖 Docs: Python syntax error in {path}")):
        log.info(f"Skip pysyn — bot PR already exists for {path}")
        return False
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
    title = f"🤖 Fix peer conflict: {peer} -> {pin} in {task.get('project_dir', '.')}"
    if DRY_RUN:
        log.info(f"[DRY_RUN] would pin {peer}={pin} in {path}")
        return True
    if open_bot_pr_exists_for(title_needle(title)):
        log.info(f"Skip peer — bot PR already exists for: {title}")
        return False
    res = fix_peer_conflict_in_package_json(path, peer, pin)
    if not res.get("success"):
        log.warning(f"peer fix failed: {res}")
        return False
    if " -> " in (res.get("output") or ""):
        old, _, new = res["output"].partition(" -> ")
        if old.rsplit(": ", 1)[-1].strip() == new.strip():
            log.info(f"Skip peer — already pinned: {res.get('output')}")
            _reset_to_main()
            return False
    proj = task.get("project_dir", ".")
    _git(f"cd {proj!r} && npm install --package-lock-only --legacy-peer-deps --ignore-scripts --no-audit 2>&1 || true")
    branch = f"auto-fix-peer-{int(time.time())}"
    return _branch_and_pr(
        title,
        task.get("body", "") + f"\n\nApplied: {res.get('output')}",
        branch,
    )


def handle_lockfile(task: dict) -> bool:
    proj = task.get("project_dir", ".")
    if _should_skip_lockfile_path(proj):
        log.info(f"Skip lockfile task for nested/root path: {proj}")
        return False
    if open_bot_pr_exists_for(proj):
        log.info(f"Skip lockfile task — open bot PR already exists for {proj}")
        return False
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
        f"🤖 Lockfile: {proj}",
        f"Autonomous lockfile for `{proj}`.\n\n```\n{out[-800:]}\n```",
        branch,
    )


def handle_missing_requirements(task: dict) -> bool:
    proj = task.get("project_dir", ".")
    pins = task.get("pins") or ["requests>=2.28.0"]
    title = f"🤖 Python deps: {proj}"
    if DRY_RUN:
        log.info(f"[DRY_RUN] would write requirements.txt for {proj}")
        return True
    if open_bot_pr_exists_for(title_needle(title)):
        log.info(f"Skip pyreq — bot PR already exists for {proj}")
        return False
    res = fix_missing_requirements(proj, pins)
    if not res.get("success"):
        return False
    branch = f"auto-fix-{int(time.time())}-pyreq"
    return _branch_and_pr(
        title,
        task.get("body", "") + f"\n\nOutput:\n```\n{res.get('output')}\n```",
        branch,
    )


def handle_gha_deprecation(task: dict) -> bool:
    path = task.get("path")
    action = task.get("action")
    new_ref = task.get("new_ref")
    title = f"🤖 GHA bump: {action} -> {new_ref}"
    if DRY_RUN:
        log.info(f"[DRY_RUN] would bump {action} to {new_ref} in {path}")
        return True
    if open_bot_pr_exists_for(title_needle(title)):
        log.info(f"Skip gha — bot PR already exists for: {title}")
        return False
    res = fix_gha_version(path, action, new_ref)
    if not res.get("success"):
        return False
    branch = f"auto-fix-gha-{int(time.time())}"
    return _branch_and_pr(
        title,
        task.get("body", "") + f"\n\nApplied: {res.get('output')}",
        branch,
    )


def _self_test() -> int:
    """Offline guards — no GitHub, no git. Exit 1 on failure."""
    fails = []

    def check(name, cond):
        if not cond:
            fails.append(name)

    check("peer needle", title_needle("🤖 Fix peer conflict: typescript -> ~5.9.3 in ./nexus-infinity-hub")
          == "typescript -> ~5.9.3 in ./nexus-infinity-hub"[:50])
    check("lockfile needle", title_needle("🤖 Lockfile: ./nexus-infinity-hub") == "./nexus-infinity-hub")
    check("pysyn needle", "python syntax error" in title_needle("🤖 Docs: Python syntax error in ./foo.py"))
    check("bot title", _is_bot_pr("🤖 Fix peer conflict: typescript", "auto-fix-peer-1"))
    check("human not bot", not _is_bot_pr("Round 12 D: CLI contract", "fix/cli-contract"))
    check("match peer", _pr_matches_needle(
        "🤖 Fix peer conflict: typescript -> ~5.9.3 in ./nexus-infinity-hub",
        "auto-fix-peer-1790876384",
        title_needle("🤖 Fix peer conflict: typescript -> ~5.9.3 in ./nexus-infinity-hub"),
    ))
    check("no false match", not _pr_matches_needle(
        "🤖 Lockfile: ./self-evolve-dash",
        "auto-fix-lock-1",
        title_needle("🤖 Fix peer conflict: typescript -> ~5.9.3 in ./nexus-infinity-hub"),
    ))
    if fails:
        print("SELF-TEST FAIL:", ", ".join(fails))
        return 1
    print(f"problem_solvers_runner v{VERSION} self-test 7/7")
    return 0


def main():
    if "--self-test" in sys.argv:
        raise SystemExit(_self_test())

    log.info("problem_solvers_runner v%s starting (DRY_RUN=%s MAX=%s)", VERSION, DRY_RUN, MAX_SOLVER_TASKS)
    _git("git config user.name 'github-actions[bot]'")
    _git("git config user.email 'github-actions[bot]@users.noreply.github.com'")

    auto_ops_report = {}
    if AUTO_OPS:
        try:
            auto_ops_report = auto_ops.run_all()
            log.info("auto_ops complete")
        except Exception as e:
            log.warning("auto_ops failed: %s", e)
            auto_ops_report = {"error": str(e)}
    else:
        log.info("auto_ops module not available — skip")

    tasks = []
    tasks.extend(scan_python_syntax("."))
    tasks.extend(scan_peer_dependency_conflicts("."))
    tasks.extend(scan_lockfile_gaps_smart("."))
    tasks.extend(scan_missing_requirements("."))
    tasks.extend(scan_gha_deprecations("."))

    tasks = [
        t for t in tasks
        if not (t.get("type") == "lockfile" and _should_skip_lockfile_path(t.get("project_dir", "")))
    ]

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
            with contextlib.suppress(Exception):
                note_reappear(ttype)

    report = {
        "version": VERSION,
        "dry_run": DRY_RUN,
        "max_tasks": MAX_SOLVER_TASKS,
        "auto_ops": {
            "merged_deps": len((auto_ops_report.get("dependabot_merges") or {}).get("merged") or []),
            "closed_spam": len((auto_ops_report.get("duplicate_drafts") or {}).get("closed") or [])
            + len((auto_ops_report.get("policy_lockfile_spam") or {}).get("closed") or []),
            "deleted_branches": len((auto_ops_report.get("stale_branches") or {}).get("deleted") or []),
        },
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
                    with contextlib.suppress(Exception):
                        record_fix(ttype, t.get("title", ""))
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
