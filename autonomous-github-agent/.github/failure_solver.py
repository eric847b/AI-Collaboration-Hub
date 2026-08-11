"""
Proactive Runtime Failure Solver for Autonomous GitHub Agent.
Detects, classifies, and remediates (or proposes) runtime failures of all common types.
v3.5.0 — draft-PR remediation for timeout / missing_dependency / missing_file.
"""

from __future__ import annotations

import json
import os
import re
import base64
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

FAILURE_PATTERNS: List[Tuple[str, str, float]] = [
    (r"ModuleNotFoundError|No module named|ImportError", "missing_dependency", 90.0),
    (r"pip install.*failed|Could not find a version that satisfies", "pip_resolution", 85.0),
    (r"Timeout|timed out|Read timed out|ConnectTimeout", "timeout", 80.0),
    (r"Permission denied|EACCES|Access is denied", "permission", 75.0),
    (r"FileNotFoundError|No such file or directory|ENOENT", "missing_file", 78.0),
    (r"SyntaxError|IndentationError|TabError", "syntax", 70.0),
    (r"KeyError|AttributeError|TypeError|ValueError|NameError", "python_runtime", 65.0),
    (r"rate.?limit|429|Too Many Requests|secondary rate limit", "rate_limit", 82.0),
    (r"GITHUB_TOKEN|GH_FULL_PAT|authentication failed|401 Unauthorized|403 Forbidden", "auth", 88.0),
    (r"git.*failed|fatal:|error: failed to push|rejected", "git", 72.0),
    (r"out of memory|OOM|Killed|MemoryError", "oom", 85.0),
    (r"disk space|No space left on device|ENOSPC", "disk", 90.0),
    (r"YAML|yaml\.load|ScannerError|ParserError", "yaml", 68.0),
    (r"Action failed|Process completed with exit code [1-9]", "generic_exit", 55.0),
    (r"Connection refused|Connection reset|Network is unreachable", "network", 77.0),
]

DRAFT_PR_CLASSES = frozenset({"timeout", "missing_dependency", "missing_file"})

COMMON_REMEDIATIONS: Dict[str, Dict[str, Any]] = {
    "missing_dependency": {
        "description": "Add missing package to requirements.txt and ensure install step runs",
        "safe_actions": ["update_requirements", "create_issue", "draft_pr"],
        "example_fix": "Ensure the package is listed in requirements.txt and the Install dependencies step runs before the agent.",
    },
    "pip_resolution": {
        "description": "Pin compatible versions or clear cache",
        "safe_actions": ["update_requirements", "create_issue"],
        "example_fix": "Tighten version ranges or add --no-cache-dir to pip install.",
    },
    "timeout": {
        "description": "Increase timeouts or add retries with exponential backoff",
        "safe_actions": ["edit_timeouts", "create_issue", "draft_pr"],
        "example_fix": "Raise requests timeout and wrap external calls in retry logic.",
    },
    "permission": {
        "description": "Check token scopes and file permissions",
        "safe_actions": ["create_issue"],
        "example_fix": "Verify GH_FULL_PAT has repo + workflow scopes; avoid writing outside allowed paths.",
    },
    "missing_file": {
        "description": "Guard path existence or create placeholder",
        "safe_actions": ["create_issue", "add_guard", "draft_pr"],
        "example_fix": "Add Path.exists() checks before open(); create empty profile if absent.",
    },
    "syntax": {"description": "Fix syntax error in source", "safe_actions": ["create_issue"], "example_fix": "Correct the reported line."},
    "python_runtime": {"description": "Defensive coding", "safe_actions": ["create_issue"], "example_fix": "Use .get() with defaults."},
    "rate_limit": {"description": "Backoff + respect Retry-After", "safe_actions": ["add_backoff", "create_issue"], "example_fix": "Sleep on 429."},
    "auth": {"description": "Token missing/expired", "safe_actions": ["create_issue"], "example_fix": "Confirm secrets."},
    "git": {"description": "Git state conflict", "safe_actions": ["create_issue"], "example_fix": "Fetch before push."},
    "oom": {"description": "OOM kill", "safe_actions": ["create_issue"], "example_fix": "Reduce memory footprint."},
    "disk": {"description": "Disk full", "safe_actions": ["create_issue"], "example_fix": "Clean caches early."},
    "yaml": {"description": "Invalid YAML", "safe_actions": ["create_issue"], "example_fix": "Validate with yamllint."},
    "network": {"description": "Transient network", "safe_actions": ["add_retry", "create_issue"], "example_fix": "Retry with backoff."},
    "generic_exit": {"description": "Non-zero exit", "safe_actions": ["create_issue"], "example_fix": "Inspect full logs."},
}


class FailureSolver:
    def __init__(self, repo_name: str, profile: Optional[Dict] = None, record_error=None):
        self.repo_name = repo_name
        self.profile = profile if profile is not None else {}
        self.record_error = record_error or (lambda e, c="": None)
        self.token = os.getenv("GH_FULL_PAT") or os.getenv("GITHUB_TOKEN")
        self.headers = {}
        if self.token:
            self.headers = {"Authorization": f"token {self.token}", "Accept": "application/vnd.github+json"}

    def _gh_get(self, url: str, params: Optional[Dict] = None) -> Tuple[int, Any]:
        if not self.headers:
            return 0, None
        try:
            resp = requests.get(url, headers=self.headers, params=params or {}, timeout=25)
            return (200, resp.json()) if resp.status_code == 200 else (resp.status_code, None)
        except Exception as e:
            self.record_error(e, "failure_solver_get")
            return 0, None

    def _gh_post(self, url: str, payload: Dict) -> Tuple[int, Any]:
        if not self.headers:
            return 0, None
        try:
            resp = requests.post(url, headers=self.headers, json=payload, timeout=30)
            if resp.status_code in (200, 201):
                return resp.status_code, resp.json()
            return resp.status_code, {"error": resp.text[:300]}
        except Exception as e:
            self.record_error(e, "failure_solver_post")
            return 0, None

    def list_recent_failed_runs(self, max_runs: int = 15) -> List[Dict]:
        url = f"https://api.github.com/repos/{self.repo_name}/actions/runs"
        status, data = self._gh_get(url, {"per_page": max_runs, "status": "completed"})
        if status != 200 or not data:
            return []
        failed = []
        for run in data.get("workflow_runs") or []:
            conclusion = (run.get("conclusion") or "").lower()
            if conclusion in ("failure", "timed_out", "cancelled", "startup_failure"):
                failed.append({"id": run.get("id"), "name": run.get("name"), "conclusion": conclusion, "html_url": run.get("html_url"), "created_at": run.get("created_at"), "head_branch": run.get("head_branch"), "head_sha": run.get("head_sha"), "event": run.get("event"), "run_attempt": run.get("run_attempt", 1),})
        return failed

    def get_run_jobs(self, run_id: int) -> List[Dict]:
        url = f"https://api.github.com/repos/{self.repo_name}/actions/runs/{run_id}/jobs"
        status, data = self._gh_get(url, {"per_page": 20})
        return (data.get("jobs") or []) if status == 200 and data else []

    def classify_log_snippet(self, text: str) -> List[Dict]:
        if not text:
            return []
        matches = []
        for pattern, cls, score in FAILURE_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE | re.DOTALL):
                m = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
                start, end = max(0, m.start() - 80), min(len(text), m.end() + 120)
                matches.append({"class": cls, "score": score, "context": text[start:end].replace("\n", " ")[:200], "remediation": COMMON_REMEDIATIONS.get(cls, {})})
        best = {}
        for m in matches:
            c = m["class"]
            if c not in best or m["score"] > best[c]["score"]:
                best[c] = m
        return sorted(best.values(), key=lambda x: x["score"], reverse=True)

    def analyze_run(self, run: Dict) -> Dict:
        jobs = self.get_run_jobs(run["id"])
        classifications, failing_steps = [], []
        for job in jobs:
            if (job.get("conclusion") or "").lower() not in ("failure", "timed_out", "cancelled"):
                continue
            for step in job.get("steps") or []:
                if (step.get("conclusion") or "").lower() in ("failure", "timed_out"):
                    failing_steps.append({"job": job.get("name"), "step": step.get("name"), "conclusion": step.get("conclusion"), "number": step.get("number")})
            proxy = " ".join([run.get("name") or "", job.get("name") or "", " ".join(s.get("name") or "" for s in job.get("steps") or [])])
            classifications.extend(self.classify_log_snippet(proxy))
        if run.get("conclusion") == "timed_out":
            classifications.append({"class": "timeout", "score": 85.0, "context": "run conclusion timed_out", "remediation": COMMON_REMEDIATIONS["timeout"]})
        seen, unique = set(), []
        for c in sorted(classifications, key=lambda x: x["score"], reverse=True):
            if c["class"] not in seen:
                seen.add(c["class"])
                unique.append(c)
        return {"run": run, "failing_steps": failing_steps, "classifications": unique[:5], "top_class": unique[0]["class"] if unique else "unknown", "top_score": unique[0]["score"] if unique else 40.0}

    def scan_and_prioritize(self, max_runs: int = 10) -> List[Dict]:
        analyses = []
        for run in self.list_recent_failed_runs(max_runs=max_runs):
            try:
                analyses.append(self.analyze_run(run))
            except Exception as e:
                self.record_error(e, "analyze_run")
        analyses.sort(key=lambda a: a.get("top_score", 0), reverse=True)
        return analyses

    def create_remediation_issue(self, analysis: Dict) -> Optional[Dict]:
        if not self.headers:
            return None
        run = analysis.get("run") or {}
        top = analysis.get("classifications") or [{}]
        cls = top[0].get("class", "unknown") if top else "unknown"
        rem = top[0].get("remediation") or {} if top else {}
        title = f"🛠️ Runtime failure: {cls} — {run.get('name', 'workflow')} #{run.get('id')}"
        body = f"**Run:** [{run.get('name')}]({run.get('html_url')})\n**Conclusion:** `{run.get('conclusion')}`\n**Branch:** `{run.get('head_branch')}`\n**Detected class:** `{cls}` (score {analysis.get('top_score', 0):.0f})\n\n### Suggested remediation\n{rem.get('description', 'Investigate.')}\n\n**Example:** {rem.get('example_fix', 'Add guards.')}\n\n### Failing steps\n" + "\n".join(f"- `{s.get('job')}` / `{s.get('step')}` → `{s.get('conclusion')}`" for s in (analysis.get('failing_steps') or [])) + "\n\n---\nAuto-created by **FailureSolver v3.5.0**."
        status, data = self._gh_post(f"https://api.github.com/repos/{self.repo_name}/issues", {"title": title[:200], "body": body, "labels": ["runtime-failure", "self-heal", "catalyst", cls]})
        if status in (200, 201) and isinstance(data, dict):
            self.profile["failures_triaged"] = self.profile.get("failures_triaged", 0) + 1
            self.profile["issues_created"] = self.profile.get("issues_created", 0) + 1
            return {"number": data.get("number"), "html_url": data.get("html_url"), "class": cls}
        return {"error": f"API {status}"}

    def _create_branch(self, branch: str, from_sha: str) -> bool:
        status, _ = self._gh_post(f"https://api.github.com/repos/{self.repo_name}/git/refs", {"ref": f"refs/heads/{branch}", "sha": from_sha})
        return status in (200, 201)

    def _put_file(self, path: str, content: str, branch: str, message: str, sha: Optional[str] = None) -> bool:
        payload = {"message": message, "content": base64.b64encode(content.encode("utf-8")).decode("ascii"), "branch": branch}
        if sha:
            payload["sha"] = sha
        try:
            resp = requests.put(f"https://api.github.com/repos/{self.repo_name}/contents/{path}", headers=self.headers, json=payload, timeout=30)
            return resp.status_code in (200, 201)
        except Exception as e:
            self.record_error(e, "put_file")
            return False

    def _create_draft_pr(self, title: str, body: str, head: str, base: str = "main") -> Optional[Dict]:
        status, data = self._gh_post(f"https://api.github.com/repos/{self.repo_name}/pulls", {"title": title, "body": body, "head": head, "base": base, "draft": True})
        if status in (200, 201) and isinstance(data, dict):
            self.profile["draft_prs_created"] = self.profile.get("draft_prs_created", 0) + 1
            return {"number": data.get("number"), "html_url": data.get("html_url")}
        return None

    def _safe_fix_content(self, cls: str, analysis: Dict) -> Optional[Tuple[str, str]]:
        if cls == "timeout":
            content = '"""Minimal retry helper auto-added by FailureSolver v3.5 for timeout class.\nSafe, zero side-effects beyond increased resilience on network/API calls.\n"""\nimport time\nfrom typing import Callable, TypeVar\n\nT = TypeVar("T")\n\ndef retry_with_backoff(fn: Callable[[], T], max_attempts: int = 3, base_delay: float = 1.0) -> T:\n    last_exc = None\n    for attempt in range(max_attempts):\n        try:\n            return fn()\n        except Exception as e:\n            last_exc = e\n            if attempt < max_attempts - 1:\n                time.sleep(base_delay * (2 ** attempt))\n    raise last_exc  # type: ignore\n'
            return (".github/auto_fix/retry_helper.py", content)
        if cls == "missing_dependency":
            content = "# Auto-added by FailureSolver v3.5 (missing_dependency class)\n# Review and pin the actual missing package, then remove this comment block.\n# requests>=2.31.0\n"
            return (".github/auto_fix/requirements_stub.txt", content)
        if cls == "missing_file":
            content = '"""Path-guard helper auto-added by FailureSolver v3.5 for missing_file class.\nSafe: only creates empty placeholders under allowed relative paths.\n"""\nfrom pathlib import Path\n\ndef ensure_file(path: str, default_content: str = "") -> Path:\n    p = Path(path)\n    if not p.is_absolute():\n        p = Path.cwd() / p\n    try:\n        p.resolve().relative_to(Path.cwd().resolve())\n    except ValueError:\n        raise ValueError(f"Path escapes repo root: {path}")\n    p.parent.mkdir(parents=True, exist_ok=True)\n    if not p.exists():\n        p.write_text(default_content)\n    return p\n'
            return (".github/auto_fix/path_guard.py", content)
        return None

    def create_remediation_draft_pr(self, analysis: Dict) -> Optional[Dict]:
        if not self.headers:
            return None
        cls = analysis.get("top_class") or "unknown"
        if cls not in DRAFT_PR_CLASSES:
            return None
        run = analysis.get("run") or {}
        fix = self._safe_fix_content(cls, analysis)
        if not fix:
            return None
        path, content = fix
        status, repo_data = self._gh_get(f"https://api.github.com/repos/{self.repo_name}")
        if status != 200 or not repo_data:
            return None
        default_branch = repo_data.get("default_branch", "main")
        status, ref_data = self._gh_get(f"https://api.github.com/repos/{self.repo_name}/git/ref/heads/{default_branch}")
        if status != 200 or not ref_data:
            return None
        base_sha = (ref_data.get("object") or {}).get("sha")
        if not base_sha:
            return None
        branch = f"auto-fix/{cls}-{run.get('id', uuid.uuid4().hex[:8])}"
        self._create_branch(branch, base_sha)
        msg = f"fix({cls}): minimal safe remediation from FailureSolver v3.5 [run {run.get('id')}]"
        if not self._put_file(path, content, branch, msg):
            return None
        title = f"🛠️ auto-fix({cls}): minimal safe remediation for run #{run.get('id')}"
        body = f"**Class:** `{cls}` (score {analysis.get('top_score', 0):.0f})\n**Source run:** [{run.get('name')}]({run.get('html_url')})\n\nMinimal safe helper added at `{path}`.\nReview, adapt, and merge only if appropriate. Draft by design.\n\n---\nAuto-created by **FailureSolver v3.5.0**. Zero destructive actions."
        return self._create_draft_pr(title, body, head=branch, base=default_branch)

    def run_proactive_pass(self, max_issues: int = 3) -> str:
        if not self.token:
            return "NO_TOKEN"
        analyses = self.scan_and_prioritize(max_runs=12)
        if not analyses:
            return "NO_RECENT_FAILURES"
        created_issues, created_prs = [], []
        for a in analyses[:max_issues]:
            if a.get("top_score", 0) < 50:
                continue
            result = self.create_remediation_issue(a)
            if result and result.get("number"):
                created_issues.append(f"#{result['number']} ({result.get('class')})")
            if a.get("top_class") in DRAFT_PR_CLASSES:
                pr = self.create_remediation_draft_pr(a)
                if pr and pr.get("number"):
                    created_prs.append(f"PR#{pr['number']}")
        self.profile["failure_solver_runs"] = self.profile.get("failure_solver_runs", 0) + 1
        parts = []
        if created_issues:
            parts.append(f"issues: {', '.join(created_issues)}")
        if created_prs:
            parts.append(f"draft-PRs: {', '.join(created_prs)}")
        if parts:
            return "Created " + "; ".join(parts)
        return f"Scanned {len(analyses)} failures; no new high-signal items created"


def get_failure_solver(repo_name: str, profile: Optional[Dict] = None, record_error=None) -> FailureSolver:
    return FailureSolver(repo_name, profile=profile, record_error=record_error)


if __name__ == "__main__":
    repo = os.getenv("GITHUB_REPOSITORY", "eric847b/autonomous-github-agent")
    solver = FailureSolver(repo)
    print(json.dumps({"recent_failed": len(solver.list_recent_failed_runs()), "status": "ready", "version": "3.5.0", "draft_pr_classes": list(DRAFT_PR_CLASSES)}, indent=2))
