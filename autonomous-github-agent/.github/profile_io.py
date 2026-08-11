"""
Shared profile load/save/merge helpers.
Ensures fleet cooldown fields survive agent-side persists and vice versa.

v4.2.1 — material-change persist gate: skip Contents API commits when only
volatile counters/timestamps moved. Heartbeat every HEARTBEAT_RUNS runs.
Reduces repo commit spam without force-push / history rewrite.
"""
from __future__ import annotations

import base64
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, Optional, Set

import requests

PROFILE_PATH = Path(os.getenv("AGENT_PROFILE_PATH", ".agent_profile.json"))
REPO_NAME = os.getenv("GITHUB_REPOSITORY", "eric847b/autonomous-github-agent")

FLEET_FIELDS = (
    "last_fleet_run",
    "fleet_issue_url",
    "fleet_coordinator_runs",
    "fleet_last_summary",
)

COUNTER_FIELDS = (
    "runs",
    "failures_triaged",
    "failure_solver_runs",
    "profile_persists",
    "notifications_handled",
    "issues_created",
    "stale_branches_deleted",
    "gmail_triaged",
    "gmail_marked_read",
    "fleet_coordinator_runs",
)

VOLATILE_FIELDS: Set[str] = {
    "runs",
    "last_run",
    "evolution_velocity",
    "failure_solver_runs",
    "roi_catalyst_runs",
    "roi_last_run",
    "notif_categories",
    "depth_history",
    "llm_calls",
    "total_tokens_used",
    "inbox_cleared",
}

HEARTBEAT_RUNS = int(os.getenv("PROFILE_PERSIST_HEARTBEAT_RUNS", "50"))
PERSIST_MAX_ATTEMPTS = 5
PERSIST_BASE_DELAY_S = 0.6


def gh_headers() -> dict:
    token = os.getenv("GH_FULL_PAT") or os.getenv("GITHUB_TOKEN")
    if not token:
        return {}
    return {"Authorization": f"token {token}", "Accept": "application/vnd.github+json"}


def load_local_profile() -> Dict[str, Any]:
    try:
        if PROFILE_PATH.exists():
            return json.loads(PROFILE_PATH.read_text())
    except Exception:
        pass
    return {}


def save_local_profile(profile: Dict[str, Any]) -> None:
    PROFILE_PATH.write_text(json.dumps(profile, indent=2) + "\n")


def merge_profiles(
    base: Dict[str, Any],
    overlay: Dict[str, Any],
    preserve_fleet_from: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    out = dict(base)
    out.update(overlay)
    src = preserve_fleet_from if preserve_fleet_from is not None else base
    for k in FLEET_FIELDS:
        if k not in overlay or overlay.get(k) in (None, "", 0):
            if src.get(k) not in (None, "", 0):
                out[k] = src[k]
        else:
            out[k] = overlay[k]
    for k in COUNTER_FIELDS:
        out[k] = max(
            int(base.get(k) or 0),
            int(overlay.get(k) or 0),
            int(src.get(k) or 0),
        )
    return out


def _prefer_newer_fleet(merged: Dict[str, Any], local: Dict[str, Any], remote: Dict[str, Any]) -> None:
    try:
        lr = local.get("last_fleet_run")
        rr = remote.get("last_fleet_run")
        if lr and rr and str(lr) < str(rr):
            merged["last_fleet_run"] = rr
            if remote.get("fleet_issue_url"):
                merged["fleet_issue_url"] = remote["fleet_issue_url"]
        elif lr:
            merged["last_fleet_run"] = lr
            if local.get("fleet_issue_url"):
                merged["fleet_issue_url"] = local["fleet_issue_url"]
    except Exception:
        pass


def _normalize_for_compare(value: Any) -> str:
    try:
        return json.dumps(value, sort_keys=True, default=str)
    except Exception:
        return str(value)


def material_delta(local: Dict[str, Any], remote: Dict[str, Any]) -> bool:
    keys = set(local.keys()) | set(remote.keys())
    for k in keys:
        if k in VOLATILE_FIELDS:
            continue
        if _normalize_for_compare(local.get(k)) != _normalize_for_compare(remote.get(k)):
            return True
    return False


def should_persist(local: Dict[str, Any], remote: Dict[str, Any]) -> tuple:
    if not remote:
        return True, "no_remote_profile"
    if material_delta(local, remote):
        return True, "material_change"
    runs = int(local.get("runs") or 0)
    if HEARTBEAT_RUNS > 0 and runs > 0 and runs % HEARTBEAT_RUNS == 0:
        return True, f"heartbeat_every_{HEARTBEAT_RUNS}_runs"
    return False, "volatile_only_skip"


def fetch_remote_profile(repo_name: Optional[str] = None) -> tuple:
    headers = gh_headers()
    if not headers:
        return None, {}
    repo = repo_name or REPO_NAME
    url = f"https://api.github.com/repos/{repo}/contents/.agent_profile.json"
    try:
        resp = requests.get(url, headers=headers, params={"ref": "main"}, timeout=20)
        if resp.status_code == 404:
            return None, {}
        if resp.status_code != 200:
            return None, {}
        data = resp.json() or {}
        sha = data.get("sha")
        raw = base64.b64decode((data.get("content") or "").replace("\n", "")).decode("utf-8")
        return sha, json.loads(raw)
    except Exception:
        return None, {}


def persist_merged_profile(
    local: Dict[str, Any],
    repo_name: Optional[str] = None,
    message: Optional[str] = None,
    force: bool = False,
) -> str:
    headers = gh_headers()
    if not headers:
        return "NO_TOKEN"
    repo = repo_name or REPO_NAME
    url = f"https://api.github.com/repos/{repo}/contents/.agent_profile.json"

    sha, remote = fetch_remote_profile(repo)
    if not force:
        ok, reason = should_persist(local, remote or {})
        if not ok:
            merged = merge_profiles(remote or {}, local, preserve_fleet_from=remote or local)
            _prefer_newer_fleet(merged, local, remote or {})
            save_local_profile(merged)
            return f"SKIP_PERSIST:{reason}"

    last_err = "PUT_FAIL:unknown"
    for attempt in range(PERSIST_MAX_ATTEMPTS):
        sha, remote = fetch_remote_profile(repo)
        merged = merge_profiles(remote or {}, local, preserve_fleet_from=remote or local)
        _prefer_newer_fleet(merged, local, remote or {})

        content = json.dumps(merged, indent=2) + "\n"
        save_local_profile(merged)

        payload = {
            "message": message
            or (
                f"chore(agent): persist profile (fleet-safe merge) "
                f"[run {merged.get('runs', 0)}] [skip ci]"
            ),
            "content": base64.b64encode(content.encode("utf-8")).decode("ascii"),
            "branch": "main",
        }
        if sha:
            payload["sha"] = sha

        try:
            put = requests.put(url, headers=headers, json=payload, timeout=30)
            if put.status_code in (200, 201):
                merged["profile_persists"] = int(merged.get("profile_persists") or 0) + 1
                save_local_profile(merged)
                return f"PERSISTED:{put.status_code}"
            if put.status_code == 409 and attempt < PERSIST_MAX_ATTEMPTS - 1:
                time.sleep(PERSIST_BASE_DELAY_S * (2 ** attempt))
                last_err = f"PUT_FAIL:409:retrying"
                continue
            last_err = f"PUT_FAIL:{put.status_code}:{put.text[:120]}"
            if put.status_code != 409:
                return last_err
        except Exception as e:
            last_err = f"PERSIST_FAIL:{str(e)[:120]}"
            if attempt < PERSIST_MAX_ATTEMPTS - 1:
                time.sleep(PERSIST_BASE_DELAY_S * (2 ** attempt))
                continue
            return last_err

    return last_err
