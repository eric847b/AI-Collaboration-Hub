"""
Proactive Runtime Failure Solver (portable for AI-Collaboration-Hub).
v3.4.0 — highest-ROI self-healing catalyst.
"""

from __future__ import annotations

import json
import os
import re
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

COMMON_REMEDIATIONS: Dict[str, Dict[str, Any]] = {
    "missing_dependency": {"description": "Add missing package to requirements.txt", "safe_actions": ["create_issue"], "example_fix": "List package in requirements and ensure install step."},
    "pip_resolution": {"description": "Pin compatible versions", "safe_actions": ["create_issue"], "example_fix": "Tighten ranges or --no-cache-dir."},
    "timeout": {"description": "Increase timeouts / retries", "safe_actions": ["create_issue"], "example_fix": "Raise timeouts + exponential backoff."},
    "permission": {"description": "Check token scopes", "safe_actions": ["create_issue"], "example_fix": "Verify GH_FULL_PAT scopes."},
    "missing_file": {"description": "Guard path existence", "safe_actions": ["create_issue"], "example_fix": "Path.exists() checks."},
    "syntax": {"description": "Fix syntax", "safe_actions": ["create_issue"], "example_fix": "Correct reported line."},
    "python_runtime": {"description": "Defensive coding", "safe_actions": ["create_issue"], "example_fix": "Use .get() defaults."},
    "rate_limit": {"description": "Backoff on 429", "safe_actions": ["create_issue"], "example_fix": "Respect Retry-After."},
    "auth": {"description": "Token missing/expired", "safe_actions": ["create_issue"], "example_fix": "Confirm secrets."},
    "git": {"description": "Git state conflict", "safe_actions": ["create_issue"], "example_fix": "Fetch before push."},
    "oom": {"description": "OOM kill", "safe_actions": ["create_issue"], "example_fix": "Stream data / reduce footprint."},
    "disk": {"description": "Disk full", "safe_actions": ["create_issue"], "example_fix": "Clean caches early."},
    "yaml": {"description": "Invalid YAML", "safe_actions": ["create_issue"], "example_fix": "Validate with yamllint."},
    "network": {"description": "Transient network", "safe_actions": ["create_issue"], "example_fix": "Retry with backoff."},
    "generic_exit": {"description": "Non-zero exit", "safe_actions": ["create_issue"], "example_fix": "Inspect full logs."},
}


class FailureSolver:
    def __init__(self, repo_name: str, profile: Optional[Dict] = None, record_error=None):
        self.repo_name = repo_name
        self.profile = profile if profile is not None else {}
        self.record_error = record_error or (lambda e, c="": None)
        self.token = os.getenv("GH_FULL_PAT") or os.getenv("GITHUB_TOKEN")
        self.headers = {"Authorization": f"token {self.token}", "Accept": "application/vnd.github+json"} if self.token else {}

    def _gh_get(self, url: str, params: Optional[Dict] = None) -> Tuple[int, Any]:
        if not self.headers:
            return 0, None
        try:
            resp = requests.get(url, headers=self.headers, params=params or {}, timeout=25)
            return (200, resp.json()) if resp.status_code == 200 else (resp.status_code, None)
        except Exception as e:
            self.record_error(e, "failure_solver_get")
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
                failed.append({
                    "id": run.get("id"), "name": run.get("name"), "conclusion": conclusion,
                    "html_url": run.get("html_url"), "created_at": run.get("created_at"),
                    "head_branch": run.get("head_branch"), "head_sha": run.get("head_sha"),
                    "event": run.get("event"), "run_attempt": run.get("run_attempt", 1),
                })
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
        body = f"**Run:** [{run.get('name')}]({run.get('html_url')})\n**Conclusion:** `{run.get('conclusion')}`\n**Branch:** `{run.get('head_branch')}`\n**Detected class:** `{cls}` (score {analysis.get('top_score', 0):.0f})\n\n### Suggested remediation\n{rem.get('description', 'Investigate logs.')}\n\n**Example fix:** {rem.get('example_fix', 'Add guards.')}\n\n### Failing steps\n" + "\n".join(f"- Job `{s.get('job')}` / Step `{s.get('step')}` → `{s.get('conclusion')}`" for s in (analysis.get('failing_steps') or [])) + "\n\n---\nAuto-created by **FailureSolver v3.4.0**. Safe: issue only."
        try:
            resp = requests.post(f"https://api.github.com/repos/{self.repo_name}/issues", headers=self.headers, json={"title": title[:200], "body": body, "labels": ["runtime-failure", "self-heal", "catalyst", cls]}, timeout=20)
            if resp.status_code in (200, 201):
                data = resp.json()
                self.profile["failures_triaged"] = self.profile.get("failures_triaged", 0) + 1
                self.profile["issues_created"] = self.profile.get("issues_created", 0) + 1
                return {"number": data.get("number"), "html_url": data.get("html_url"), "class": cls}
            return {"error": f"API {resp.status_code}"}
        except Exception as e:
            self.record_error(e, "create_remediation_issue")
            return None

    def run_proactive_pass(self, max_issues: int = 3) -> str:
        if not self.token:
            return "NO_TOKEN"
        analyses = self.scan_and_prioritize(max_runs=12)
        if not analyses:
            return "NO_RECENT_FAILURES"
        created = []
        for a in analyses[:max_issues]:
            if a.get("top_score", 0) < 50:
                continue
            result = self.create_remediation_issue(a)
            if result and result.get("number"):
                created.append(f"#{result['number']} ({result.get('class')})")
        self.profile["failure_solver_runs"] = self.profile.get("failure_solver_runs", 0) + 1
        return f"Created {len(created)} remediation issues: {', '.join(created)}" if created else f"Scanned {len(analyses)} failures; no new high-signal issues"


def get_failure_solver(repo_name: str, profile: Optional[Dict] = None, record_error=None) -> FailureSolver:
    return FailureSolver(repo_name, profile=profile, record_error=record_error)


if __name__ == "__main__":
    print(json.dumps({"status": "ready", "repo": os.getenv("GITHUB_REPOSITORY", "")}, indent=2))
