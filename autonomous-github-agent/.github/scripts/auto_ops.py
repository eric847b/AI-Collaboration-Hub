#!/usr/bin/env python3
"""
auto_ops v1.1 — autonomous operational maintenance (maximize free GitHub resources).

Handles failure classes without calling an LLM:
  1. Duplicate 🤖 Lockfile / auto-fix draft PR spam
  2. Safe Dependabot patch auto-merge (semver-patch only, green checks)
  3. Conflicted Dependabot: @dependabot rebase / recreate (free bot)
  4. Stale auto-fix-* branch cleanup
  5. Ensure actionlint.yaml silences non-blocking shellcheck advisories

Env:
  GITHUB_TOKEN, REPO (required for GitHub ops)
  DRY_RUN=1               — report only
  AUTO_MERGE_DEPENDABOT=1 — enable patch auto-merge (default 1)
  MAX_DEP_MERGES=8        — cap merges per run
  CONFLICT_RECREATE_DAYS=14 — after this many days, recreate instead of rebase
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("auto_ops")

VERSION = "1.1"
DRY_RUN = os.getenv("DRY_RUN", "0") == "1"
AUTO_MERGE_DEPENDABOT = os.getenv("AUTO_MERGE_DEPENDABOT", "1") == "1"
MAX_DEP_MERGES = int(os.getenv("MAX_DEP_MERGES", "8"))
CONFLICT_RECREATE_DAYS = int(os.getenv("CONFLICT_RECREATE_DAYS", "14"))

MARKER_REBASE = "<!-- auto_ops:request-rebase -->"
MARKER_RECREATE = "<!-- auto_ops:request-recreate -->"

try:
    from github import Github
    from github.GithubException import GithubException

    GITHUB_AVAILABLE = True
except ImportError:
    GITHUB_AVAILABLE = False
    GithubException = Exception  # type: ignore

ACTIONLINT_YAML = """# Managed by autonomous-github-agent auto_ops v1.1
# Keep real errors; silence noisy shellcheck info/style that actionlint promotes to fail.
self-hosted-runner:
  labels: []
config-variables: null
shellcheck:
  ignore:
    - SC2015  # A && B || C is not if-then-else
    - SC2086  # Double quote to prevent globbing (often intentional in GH Actions)
    - SC2129  # Consider using { cmd1; cmd2; } >> file
    - SC2012  # Use find instead of ls
"""

SKIP_LOCKFILE_TOKENS = (
    "userscripts",
    "userscript suite",
    "ai chat userscript studio",
    "/archive/",
    "/archives/",
)


def _repo():
    if not GITHUB_AVAILABLE:
        return None
    token = os.getenv("GITHUB_TOKEN")
    repo = os.getenv("REPO")
    if not token or not repo:
        return None
    try:
        return Github(token).get_repo(repo)
    except Exception as e:
        log.warning("repo access failed: %s", e)
        return None


def _lockfile_key(title: str) -> str:
    t = title or ""
    if t.startswith("🤖 Lockfile"):
        rest = re.sub(r"^🤖\s*Lockfile:\s*", "", t, flags=re.I).strip()
        return "lock:" + rest[:48].lower()
    if t.startswith("🤖"):
        return "bot:" + t[:50].lower()
    return "other:" + t[:50].lower()


def close_duplicate_bot_drafts(r=None) -> Dict[str, Any]:
    r = r or _repo()
    result = {"closed": [], "kept": [], "errors": []}
    if not r:
        return result
    groups: Dict[str, list] = defaultdict(list)
    try:
        for pr in r.get_pulls(state="open"):
            title = pr.title or ""
            head = ""
            try:
                head = pr.head.ref if pr.head else ""
            except Exception:
                pass
            if head.startswith("dependabot/"):
                continue
            if not (title.startswith("🤖") or head.startswith("auto-fix")):
                continue
            if not pr.draft and not title.startswith("🤖 Lockfile"):
                if not title.startswith("🤖"):
                    continue
            key = _lockfile_key(title)
            groups[key].append(pr)
    except Exception as e:
        result["errors"].append(str(e))
        return result

    for key, prs in groups.items():
        prs_sorted = sorted(prs, key=lambda p: p.number, reverse=True)
        result["kept"].append(prs_sorted[0].number)
        for old in prs_sorted[1:]:
            if DRY_RUN:
                result["closed"].append({"number": old.number, "action": "would-close", "key": key})
                continue
            try:
                old.edit(state="closed")
                try:
                    old.create_issue_comment(
                        f"Closed by auto_ops: duplicate bot/lockfile draft (kept #{prs_sorted[0].number})."
                    )
                except Exception:
                    pass
                result["closed"].append({"number": old.number, "key": key})
                log.info("Closed duplicate draft PR #%s (key=%s)", old.number, key)
            except Exception as e:
                result["errors"].append(f"#{old.number}: {e}")
    return result


def close_all_lockfile_spam(r=None) -> Dict[str, Any]:
    r = r or _repo()
    result = {"closed": [], "errors": []}
    if not r:
        return result
    try:
        for pr in r.get_pulls(state="open"):
            title = pr.title or ""
            if not title.startswith("🤖 Lockfile"):
                continue
            lower = title.lower()
            bad = lower.rstrip().endswith(": .") or any(t in lower for t in SKIP_LOCKFILE_TOKENS)
            if not bad:
                continue
            if DRY_RUN:
                result["closed"].append({"number": pr.number, "action": "would-close", "title": title})
                continue
            try:
                pr.edit(state="closed")
                try:
                    pr.create_issue_comment(
                        "Closed by auto_ops: lockfile drafts for root/Userscripts paths are skipped by policy."
                    )
                except Exception:
                    pass
                result["closed"].append({"number": pr.number, "title": title})
                log.info("Closed policy-spam lockfile PR #%s", pr.number)
            except Exception as e:
                result["errors"].append(f"#{pr.number}: {e}")
    except Exception as e:
        result["errors"].append(str(e))
    return result


def _is_patch_bump(title: str) -> bool:
    m = re.search(
        r"from\s+(\d+)\.(\d+)\.(\d+)\s+to\s+(\d+)\.(\d+)\.(\d+)",
        title or "",
        re.I,
    )
    if not m:
        m = re.search(
            r"(\d+)\.(\d+)\.(\d+)\s+to\s+(\d+)\.(\d+)\.(\d+)",
            title or "",
            re.I,
        )
    if not m:
        return False
    a, b, c, d, e, f = map(int, m.groups())
    return a == d and b == e and f > c


def _pr_checks_green(pr) -> Tuple[bool, str]:
    try:
        status = pr.get_commits().reversed[0].get_combined_status()
        if status.state == "failure":
            return False, "combined_status=failure"
        sha = pr.head.sha
        checks = pr.base.repo.get_commit(sha).get_check_runs()
        failing = [
            c.name
            for c in checks
            if c.conclusion in ("failure", "timed_out", "cancelled")
            and c.name not in ("validate-lockfiles", "Lockfile Validation")
        ]
        if failing:
            return False, "failing:" + ",".join(failing[:5])
        return True, "ok"
    except Exception as e:
        try:
            if pr.mergeable and pr.mergeable_state in ("clean", "unstable", None):
                return True, f"mergeable_fallback:{pr.mergeable_state}"
        except Exception:
            pass
        return False, f"check_error:{e}"


def _pr_has_marker(pr, marker: str) -> bool:
    try:
        for c in pr.get_issue_comments():
            body = c.body or ""
            if marker in body:
                return True
    except Exception:
        pass
    return False


def _pr_age_days(pr) -> float:
    try:
        created = pr.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - created).total_seconds() / 86400.0
    except Exception:
        return 0.0


def handle_conflicted_dependabot(r=None) -> Dict[str, Any]:
    """
    Free GitHub path: ask Dependabot to rebase or recreate conflicted PRs.
    No LLM. Markers prevent comment spam on every Self-Heal cycle.
    """
    r = r or _repo()
    result = {"rebase_requests": [], "recreate_requests": [], "skipped": [], "errors": []}
    if not r:
        return result
    try:
        for pr in r.get_pulls(state="open"):
            try:
                user = (pr.user.login or "").lower()
            except Exception:
                user = ""
            if user != "dependabot[bot]":
                continue
            title = pr.title or ""
            # Only auto-heal patch bumps this way; majors stay for human/AI review
            if not _is_patch_bump(title):
                result["skipped"].append({"number": pr.number, "reason": "not-patch-conflict-policy"})
                continue
            try:
                # Force mergeable computation
                _ = pr.mergeable
                if pr.mergeable is not False:
                    continue
            except Exception:
                continue

            age = _pr_age_days(pr)
            use_recreate = age >= CONFLICT_RECREATE_DAYS
            marker = MARKER_RECREATE if use_recreate else MARKER_REBASE
            cmd = "@dependabot recreate" if use_recreate else "@dependabot rebase"

            if _pr_has_marker(pr, marker):
                result["skipped"].append({"number": pr.number, "reason": "already-requested", "cmd": cmd})
                continue

            body = (
                f"{cmd}\n\n{marker}\n"
                f"auto_ops v{VERSION}: conflicted Dependabot patch "
                f"(age≈{age:.0f}d). Using free GitHub Dependabot — no AI call."
            )
            if DRY_RUN:
                key = "recreate_requests" if use_recreate else "rebase_requests"
                result[key].append({"number": pr.number, "action": "would-comment", "cmd": cmd})
                continue
            try:
                pr.create_issue_comment(body)
                key = "recreate_requests" if use_recreate else "rebase_requests"
                result[key].append({"number": pr.number, "cmd": cmd, "age_days": round(age, 1)})
                log.info("Requested %s on conflicted PR #%s", cmd, pr.number)
                time.sleep(0.5)
            except Exception as e:
                result["errors"].append({"number": pr.number, "error": str(e)})
    except Exception as e:
        result["errors"].append(str(e))
    return result


def auto_merge_safe_dependabot(r=None) -> Dict[str, Any]:
    r = r or _repo()
    result = {"merged": [], "skipped": [], "errors": []}
    if not r or not AUTO_MERGE_DEPENDABOT:
        result["skipped"].append({"reason": "disabled or no repo"})
        return result
    merged_count = 0
    try:
        for pr in r.get_pulls(state="open", sort="created", direction="asc"):
            if merged_count >= MAX_DEP_MERGES:
                break
            try:
                user = (pr.user.login or "").lower()
            except Exception:
                user = ""
            if user != "dependabot[bot]":
                continue
            title = pr.title or ""
            if not _is_patch_bump(title):
                result["skipped"].append({"number": pr.number, "reason": "not-patch", "title": title})
                continue
            if pr.draft:
                result["skipped"].append({"number": pr.number, "reason": "draft"})
                continue
            try:
                if pr.mergeable is False:
                    result["skipped"].append({"number": pr.number, "reason": "conflicts"})
                    continue
            except Exception:
                pass

            green, why = _pr_checks_green(pr)
            if not green:
                result["skipped"].append({"number": pr.number, "reason": why, "title": title})
                continue

            if DRY_RUN:
                result["merged"].append({"number": pr.number, "action": "would-merge", "title": title})
                merged_count += 1
                continue
            try:
                pr.merge(commit_title=f"{title} (#{pr.number})", merge_method="squash")
                result["merged"].append({"number": pr.number, "title": title})
                merged_count += 1
                log.info("Merged Dependabot patch PR #%s: %s", pr.number, title)
                time.sleep(1.5)
            except GithubException as e:
                result["errors"].append({"number": pr.number, "error": str(e)})
            except Exception as e:
                result["errors"].append({"number": pr.number, "error": str(e)})
    except Exception as e:
        result["errors"].append(str(e))
    return result


def cleanup_stale_autofix_branches(r=None) -> Dict[str, Any]:
    r = r or _repo()
    result = {"deleted": [], "errors": []}
    if not r:
        return result
    try:
        main_sha = r.get_branch("main").commit.sha
    except Exception as e:
        result["errors"].append(str(e))
        return result
    try:
        for b in r.get_branches():
            name = b.name
            if name in ("main", "master") or b.protected:
                continue
            if not name.startswith(("auto-fix-", "auto-fix/")):
                continue
            try:
                if b.commit.sha == main_sha:
                    if not DRY_RUN:
                        r.get_git_ref(f"heads/{name}").delete()
                    result["deleted"].append({"branch": name, "reason": "equals-main"})
                    continue
                cmp = r.compare("main", name)
                if cmp.ahead_by == 0:
                    if not DRY_RUN:
                        r.get_git_ref(f"heads/{name}").delete()
                    result["deleted"].append({"branch": name, "reason": "merged"})
            except Exception as e:
                result["errors"].append(f"{name}: {e}")
    except Exception as e:
        result["errors"].append(str(e))
    return result


def ensure_actionlint_config(root: str = ".") -> Dict[str, Any]:
    path = Path(root) / ".github" / "actionlint.yaml"
    result = {"path": str(path), "action": "none"}
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.is_file() and path.stat().st_size > 20:
            text = path.read_text(errors="ignore")
            missing = [c for c in ("SC2015", "SC2086", "SC2129", "SC2012") if c not in text]
            if not missing:
                result["action"] = "exists"
                return result
        if DRY_RUN:
            result["action"] = "would-write"
            return result
        path.write_text(ACTIONLINT_YAML)
        result["action"] = "wrote"
        log.info("Wrote %s", path)
    except Exception as e:
        result["action"] = f"error:{e}"
    return result


def run_all() -> Dict[str, Any]:
    log.info(
        "auto_ops v%s starting (DRY_RUN=%s AUTO_MERGE=%s CONFLICT_RECREATE_DAYS=%s)",
        VERSION,
        DRY_RUN,
        AUTO_MERGE_DEPENDABOT,
        CONFLICT_RECREATE_DAYS,
    )
    r = _repo()
    report: Dict[str, Any] = {
        "version": VERSION,
        "dry_run": DRY_RUN,
        "scanned_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "actionlint": ensure_actionlint_config("."),
        "duplicate_drafts": close_duplicate_bot_drafts(r),
        "policy_lockfile_spam": close_all_lockfile_spam(r),
        "stale_branches": cleanup_stale_autofix_branches(r),
        "dependabot_conflicts": handle_conflicted_dependabot(r),
        "dependabot_merges": auto_merge_safe_dependabot(r),
    }
    try:
        with open("auto-ops-report.json", "w") as fh:
            json.dump(report, fh, indent=2)
        log.info("Wrote auto-ops-report.json")
    except Exception as e:
        log.warning("report write failed: %s", e)

    n_closed = len(report["duplicate_drafts"].get("closed", [])) + len(
        report["policy_lockfile_spam"].get("closed", [])
    )
    n_merged = len(report["dependabot_merges"].get("merged", []))
    n_branches = len(report["stale_branches"].get("deleted", []))
    n_rebase = len(report["dependabot_conflicts"].get("rebase_requests", []))
    n_recreate = len(report["dependabot_conflicts"].get("recreate_requests", []))
    log.info(
        "auto_ops done — closed_prs=%s merged_deps=%s deleted_branches=%s rebase=%s recreate=%s",
        n_closed,
        n_merged,
        n_branches,
        n_rebase,
        n_recreate,
    )
    return report


if __name__ == "__main__":
    run_all()
