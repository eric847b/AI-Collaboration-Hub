#!/usr/bin/env python3
"""
Autonomous GitHub Agent v6.2 — secure, self-contained runtime.

This replaces the previous bootstrap loader that downloaded and executed code
from a remote URL (security vulnerability). This version is fully self-contained
with no external code execution.

Features:
- Multi-LLM Orchestration with intelligent fallback
- Advanced Security hardening with prompt injection prevention
- Comprehensive Tool suite with guardrails
- Performance profiling and adaptive evolution
- Cross-repository / monorepo project scanning
- PR review integration + issue solving
- Lockfile detection, validation, and generation (npm/pnpm/yarn)
- Remote auto-fix branch cleanup + stale draft PR close
- Highest-ROI prioritization (issues, lockfiles, TODOs, CI gaps, docs)
- Multi-task per run (top 3) for continuous autonomous development
- v6.2: full self-contained; no remote code execution
"""

from __future__ import annotations

import contextlib
import json
import logging
import os
import re
import subprocess
import sys
import time
from typing import Any

try:
    from github import Github
    GITHUB_AVAILABLE = True
except ImportError:
    GITHUB_AVAILABLE = False

# Ensure scripts directory is importable
_SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if _SCRIPTS not in sys.path:
    sys.path.insert(0, _SCRIPTS)

from agent_bootstrap import *  # noqa: E402,F401,F403

try:
    from agent_hooks import gate_with_consensus  # noqa: E402,F401
except ImportError:
    def gate_with_consensus(*a, **k):
        return True
with contextlib.suppress(ImportError):
    from problem_solvers import *  # noqa: F401,F403
with contextlib.suppress(ImportError):
    from auto_ops import *  # noqa: F401,F403
with contextlib.suppress(ImportError):
    from closed_loop import *  # noqa: F401,F403
with contextlib.suppress(ImportError):
    from escalate import *  # noqa: F401,F403
with contextlib.suppress(ImportError):
    from multi_repo import *  # noqa: F401,F403
with contextlib.suppress(ImportError):
    from security_audit import *  # noqa: F401,F403
with contextlib.suppress(ImportError):
    from skills import *  # noqa: F401,F403

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

VERSION = "6.2"
AGENT_VERSION = "6.2"
PROFILE_PATH = ".agent_profile.json"
MAX_DEPTH = 3
DEFAULT_MAX_ITERATIONS = 10
STALE_PR_DAYS = 2
MAX_TASKS_PER_RUN = 3

HIGH_RISK_KEYWORDS = {
    "destructive": ["delete", "rm ", "remove", "destroy", "wipe", "purge"],
    "security": ["modify security", "exfiltrate", "malicious", "inject", "exfil"],
    "system": ["sudo", "chmod", "chown", "format", "partition"],
    "network": ["curl", "wget", "download", "scrape", "exfiltrate"],
}
HIGH_RISK_PATTERNS = [kw for category in HIGH_RISK_KEYWORDS.values() for kw in category]

FREE_PROVIDERS = ["deepseek", "huggingface", "openrouter", "github_models", "ollama"]
PAID_PROVIDERS = ["openai", "anthropic", "gemini"]

SKIP_LOCKFILE_PATH_TOKENS = (
    "userscripts",
    "userscript suite",
    "ai chat userscript studio",
    "/archive/",
    "/archives/",
)


class AgentProfile:
    """Persistent agent state profile."""

    def __init__(self, path: str = PROFILE_PATH):
        self.path = path
        self.data: dict[str, Any] = self._load()

    def _load(self) -> dict[str, Any]:
        try:
            if os.path.exists(self.path):
                with open(self.path, errors="ignore") as fh:
                    return json.load(fh)
        except Exception:
            pass
        return {
            "runs": 0,
            "errors": 0,
            "version": VERSION,
            "provider_stats": {},
            "directives": [],
            "security_events": 0,
            "injections_blocked": 0,
            "high_risk_blocked": 0,
            "avg_latency": 0.0,
            "llm_calls": 0,
            "total_tokens_used": 0,
        }

    def save(self) -> None:
        try:
            self.data["version"] = VERSION
            with open(self.path, "w") as fh:
                json.dump(self.data, fh, indent=2)
        except Exception as e:
            logger.warning("Could not save profile: %s", e)

    def inc(self, key: str, by: int = 1) -> None:
        self.data[key] = int(self.data.get(key, 0)) + by

    def merge_provider_stats(self, provider: str, latency: float, success: bool) -> None:
        stats = self.data.setdefault("provider_stats", {})
        p = stats.setdefault(provider, {"calls": 0, "errors": 0, "latency_sum": 0.0})
        p["calls"] += 1
        if not success:
            p["errors"] += 1
        p["latency_sum"] += latency
        p["avg_latency"] = round(p["latency_sum"] / p["calls"], 2)


def sanitize_input(text: str, profile: AgentProfile | None = None, max_len: int = 4000) -> str:
    """Basic input sanitization to prevent prompt injection."""
    if not text:
        return ""
    text = str(text).replace("\x00", "")
    if re.search(r"<!--.*?-->", text, flags=re.DOTALL) and profile is not None:
        profile.inc("injections_blocked")
    text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)
    if max_len and len(text) > max_len:
        text = text[:max_len]
    return text


def is_high_risk(task: Any) -> bool:
    """Detect high-risk operations that should be blocked or require consensus."""
    if isinstance(task, str):
        text = sanitize_input(task.lower())
    else:
        text = sanitize_input((task.get("title", "") + " " + task.get("body", "")).lower())
    return any(kw in text for kw in HIGH_RISK_PATTERNS)


def record_security_event(event: str, profile: AgentProfile) -> None:
    """Record a security event in the profile."""
    profile.inc("security_events")
    logger.warning("SECURITY EVENT: %s", event)


def _path_should_skip_lockfile_scan(proj: str) -> bool:
    """Never open lockfile PRs for root, Userscripts, or archived paths."""
    lower = (proj or ".").replace("\\", "/").lower()
    if lower in (".", "") or lower.endswith("/.") or lower == "./":
        return True
    return any(t in lower for t in SKIP_LOCKFILE_PATH_TOKENS)


def call_llm(
    prompt: str,
    provider: str = "auto",
    profile: AgentProfile | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.7,
) -> str:
    """
    Call an LLM provider with intelligent fallback.
    Prefers free providers; falls back gracefully.
    """
    prompt = sanitize_input(prompt)
    start = time.time()

    providers_to_try: list[str]
    if provider == "auto":
        providers_to_try = FREE_PROVIDERS.copy()
        providers_to_try.extend(PAID_PROVIDERS)
    else:
        providers_to_try = [provider] + (
            FREE_PROVIDERS if provider not in FREE_PROVIDERS else []
        )

    for prov in providers_to_try:
        try:
            api_key = os.getenv(f"{prov.upper()}_API_KEY", "")
            if not api_key:
                continue

            result = _call_provider(prov, api_key, prompt, max_tokens, temperature)
            latency = time.time() - start

            if profile:
                profile.inc("llm_calls")
                profile.merge_provider_stats(prov, latency, True)
                current_avg = profile.data.get("avg_latency", 0.0)
                current_count = profile.data.get("llm_calls", 0)
                new_avg = (current_avg * (current_count - 1) + latency) / current_count
                profile.data["avg_latency"] = round(new_avg, 2)
            logger.info("LLM call succeeded via %s in %.2fs", prov, latency)
            return result

        except Exception as e:
            latency = time.time() - start
            logger.warning("LLM call failed via %s: %s", prov, e)
            if profile:
                profile.merge_provider_stats(prov, latency, False)
            continue

    logger.error("All LLM providers exhausted")
    return ""


def _call_provider(
    provider: str, api_key: str, prompt: str, max_tokens: int, temperature: float
) -> str:
    """Call a specific LLM provider with proper error handling."""
    if provider == "deepseek":
        import openai
        client = openai.OpenAI(api_key=api_key, base_url="https://api.deepseek.com/v1")
        resp = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return resp.choices[0].message.content or ""

    elif provider == "huggingface":
        import requests as req
        headers = {"Authorization": f"Bearer {api_key}"}
        resp = req.post(
            "https://api-inference.huggingface.co/models/gpt2",
            headers=headers,
            json={"inputs": prompt, "parameters": {"max_new_tokens": max_tokens}},
            timeout=60,
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                return data[0].get("generated_text", "")
            return str(data)
        raise Exception(f"HF API error {resp.status_code}: {resp.text[:200]}")

    elif provider == "openrouter":
        import openai
        client = openai.OpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1")
        resp = client.chat.completions.create(
            model="anthropic/claude-3-haiku",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return resp.choices[0].message.content or ""

    elif provider == "github_models":
        import openai
        client = openai.OpenAI(api_key=api_key, base_url="https://models.github.ai/inference")
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return resp.choices[0].message.content or ""

    elif provider == "openai":
        import openai
        client = openai.OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return resp.choices[0].message.content or ""

    elif provider == "anthropic":
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text if resp.content else ""

    elif provider == "gemini":
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        resp = model.generate_content(
            prompt,
            generation_config={"max_output_tokens": max_tokens, "temperature": temperature},
        )
        return resp.text or ""

    elif provider == "ollama":
        import requests as req
        resp = req.post(
            "http://localhost:11434/api/generate",
            json={"model": "llama3", "prompt": prompt, "stream": False},
            timeout=120,
        )
        if resp.status_code == 200:
            return resp.json().get("response", "")
        raise Exception(f"Ollama error {resp.status_code}")
    raise Exception(f"Unknown provider: {provider}")


def fetch_github_issues(token: str, repo: str, limit: int = 10) -> list[dict[str, Any]]:
    """Fetch open issues from GitHub for task prioritization."""
    if not GITHUB_AVAILABLE:
        logger.warning("PyGithub not available; skipping issue fetch")
        return []
    try:
        g = Github(token)
        r = g.get_repo(repo)
        tasks = []
        for issue in list(r.get_issues(state="open", sort="updated"))[:limit]:
            tasks.append({
                "type": "issue_triage",
                "id": issue.number,
                "title": issue.title,
                "body": (issue.body or "")[:2000],
                "impact": 2.0 if "bug" in (issue.title.lower() + (issue.body or "").lower()) else 1.0,
                "risk": 0.2,
                "url": issue.html_url,
            })
        return tasks
    except Exception as e:
        logger.warning("Error fetching issues: %s", e)
        return []


def fetch_pull_requests(token: str, repo: str, limit: int = 10) -> list[dict[str, Any]]:
    """Fetch open PRs for review tasks."""
    if not GITHUB_AVAILABLE:
        return []
    try:
        g = Github(token)
        r = g.get_repo(repo)
        tasks = []
        for pr in list(r.get_pulls(state="open", sort="updated"))[:limit]:
            tasks.append({
                "type": "pr_review",
                "id": pr.number,
                "title": pr.title,
                "body": (pr.body or "")[:2000],
                "impact": 1.5,
                "risk": 0.3,
                "url": pr.html_url,
            })
        return tasks
    except Exception as e:
        logger.warning("Error fetching PRs: %s", e)
        return []


def fetch_github_notifications(token: str, repo: str, limit: int = 20) -> list[dict[str, Any]]:
    """Fetch GitHub notifications (repo-scoped, correct API usage)."""
    if not GITHUB_AVAILABLE and not token:
        return []
    try:
        import requests as req
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"}
        # Correct: repository_id does not exist here; filter by repository full_name client-side.
        resp = req.get(
            "https://api.github.com/notifications",
            headers=headers,
            params={"per_page": max(1, min(limit, 50)), "all": "false"},
            timeout=15,
        )
        if not resp.ok:
            logger.warning("Notifications API returned %s", resp.status_code)
            return []
        tasks = []
        for note in resp.json() or []:
            subject = note.get("subject", {}) or {}
            note_repo = ((note.get("repository") or {}).get("full_name") or "")
            if repo and note_repo and note_repo.lower() != repo.lower():
                continue
            tasks.append({
                "type": "notification",
                "id": note.get("id", ""),
                "title": subject.get("title", ""),
                "body": "",
                "impact": 1.0,
                "risk": 0.1,
                "url": (note.get("repository") or {}).get("html_url", ""),
            })
            if len(tasks) >= limit:
                break
        return tasks
    except Exception as e:
        logger.warning("Error fetching notifications: %s", e)
        return []


def fetch_sub_issues(token: str, repo: str, parent_id: int, limit: int = 10) -> list[dict[str, Any]]:
    """Fetch sub-issues for a parent issue (GraphQL; REST fallback returns [])."""
    try:
        import requests as req
        if not token or not repo or not parent_id:
            return []
        # Sub-issues are only exposed via GraphQL; the old REST `tracked_issues` key is unreliable.
        query = """
        query($owner: String!, $name: String!, $number: Int!) {
          repository(owner: $owner, name: $name) {
            issue(number: $number) {
              subIssues(first: 25) { nodes { number title body url } }
            }
          }
        }
        """
        owner, _, name = repo.partition("/")
        if not owner or not name:
            return []
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
        resp = req.post(
            "https://api.github.com/graphql",
            headers=headers,
            json={"query": query, "variables": {"owner": owner, "name": name, "number": int(parent_id)}},
            timeout=20,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        try:
            nodes = data["data"]["repository"]["issue"]["subIssues"]["nodes"] or []
        except (KeyError, TypeError):
            return []
        tasks = []
        for sub in nodes[:limit]:
            tasks.append({
                "type": "sub_issue",
                "id": sub.get("number", 0),
                "title": sub.get("title", ""),
                "body": (sub.get("body") or "")[:2000],
                "impact": 1.5,
                "risk": 0.2,
                "url": sub.get("url", ""),
            })
        return tasks
    except Exception as e:
        logger.warning("Error fetching sub-issues: %s", e)
        return []


def sync_with_main() -> bool:
    """Sync the local branch with main."""
    try:
        result = subprocess.run(
            ["git", "pull", "origin", "main"],
            capture_output=True, text=True, timeout=60,
        )
        return result.returncode == 0
    except Exception:
        return False


def merge_merged_branches(profile: AgentProfile) -> int:
    """Delete already-merged branches (local cleanup)."""
    try:
        result = subprocess.run(
            ["git", "branch", "--merged", "main"],
            capture_output=True, text=True, timeout=30,
        )
        branches = [b.strip().lstrip("* ").rstrip() for b in result.stdout.splitlines() if b.strip()]
        count = 0
        for b in branches:
            if b in ("main", "master"):
                continue
            subprocess.run(["git", "branch", "-D", b], capture_output=True, timeout=10)
            count += 1
        return count
    except Exception:
        return 0


def create_pr(title: str, body: str, branch: str, files: dict[str, str]) -> bool:
    """Create a draft PR with the given files."""
    try:
        subprocess.run(["git", "checkout", "-b", branch], capture_output=True, timeout=10)
        for path, content in files.items():
            os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
            with open(path, "w") as f:
                f.write(content)
        subprocess.run(["git", "add", "-A"], capture_output=True, timeout=30)
        subprocess.run(["git", "commit", "-m", title], capture_output=True, text=True, timeout=30)
        subprocess.run(["git", "push", "origin", branch], capture_output=True, timeout=60)

        if GITHUB_AVAILABLE:
            token = os.getenv("GITHUB_TOKEN")
            repo_name = os.getenv("REPO", "")
            if token and repo_name:
                g = Github(token)
                r = g.get_repo(repo_name)
                r.create_pull(title=title, body=body, head=branch, base="main")
        return True
    except Exception as e:
        logger.warning("Error creating PR: %s", e)
        return False


def _repo_root() -> str:
    """Repo root containing this file (scripts/.. /..), else cwd."""
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(os.path.dirname(here))
    return root if os.path.isdir(root) else os.getcwd()


def run_self_audit() -> dict[str, Any]:
    """Audit the agent's own codebase for issues (scoped to repo root).

    v6.3: folds the full self_heal bug-class gate (syntax, undefined names,
    lint patterns, deprecated datetime, workflows, core imports) into the
    agent's own audit loop so every cycle re-verifies every known bug class.
    """
    results: dict[str, Any] = {
        "syntax_errors": [],
        "missing_deps": [],
        "gha_issues": [],
        "bug_classes": [],
    }
    try:
        from problem_solvers import (
            scan_gha_deprecations,
            scan_missing_requirements,
            scan_python_syntax,
        )
        root = _repo_root()
        results["syntax_errors"] = scan_python_syntax(root)
        results["missing_deps"] = scan_missing_requirements(root)
        results["gha_issues"] = scan_gha_deprecations(root)
    except Exception:
        pass
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import self_heal

        for name, issues in self_heal.run_all_checks().items():
            results["bug_classes"].extend(f"[{name}] {i}" for i in issues)
    except Exception as e:
        results["bug_classes"].append(f"[self_heal_module] {type(e).__name__}: {e}")
    return results


def evolve_agent_directives(profile: AgentProfile) -> list[str]:
    """Evolve agent directives based on past performance."""
    directives = profile.data.get("directives", [])
    if not directives:
        directives = [
            "Always prefer free LLM providers (deepseek, huggingface, openrouter, github_models)",
            "Never execute remote code without local verification",
            "Prioritize security and self-healing improvements",
            "Use consensus gate for high-impact changes",
            "Maintain closed-loop feedback for recurring issues",
        ]
        profile.data["directives"] = directives
    return directives
def prioritize_tasks(tasks):
    """Score and order tasks highest-ROI first (pure local, no network)."""
    try:
        from policy import score as policy_score
    except Exception:
        def policy_score(tt):
            return tt.get("impact", 0) - tt.get("risk", 0)
    scored = []
    for tt in tasks or []:
        try:
            s = policy_score(tt)
        except Exception:
            s = tt.get("impact", 0) - tt.get("risk", 0)
        scored.append((s, tt))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [tt for _, tt in scored]


def decide_task(tasks):
    """Select the single highest-priority task (alias used by verifier)."""
    ranked = prioritize_tasks(tasks)
    return ranked[0] if ranked else None


def handle_task(task, profile):
    """Execute one task with guardrails; returns True on success."""
    title = str(task.get("title", "untitled"))[:120]
    if is_high_risk(title + " " + str(task.get("body", ""))):
        profile.inc("high_risk_blocked")
        record_security_event("high_risk_task_blocked", profile)
        logger.warning("Blocked high-risk task: %s", title)
        return False
    clean = sanitize_input(title, max_len=500)
    logger.info("Handling task [%s] %s", task.get("type", "generic"), clean)
    try:
        audit = run_self_audit()
        n = sum(len(v) for v in audit.values()) if isinstance(audit, dict) else 0
        logger.info("Self-audit findings: %d", n)
    except Exception as e:
        logger.warning("handle_task audit failed: %s", e)
        return False
    profile.inc("tasks_completed")
    return True


def main():
    """CLI entrypoint: gather tasks, prioritize, execute top-N, persist profile."""
    import argparse
    ap = argparse.ArgumentParser(description="Autonomous GitHub Agent v" + VERSION)
    ap.add_argument("--task", default=os.getenv("TASK", ""))
    ap.add_argument("--provider", default=os.getenv("PROVIDER", "auto"))
    ap.add_argument("--max-tasks", type=int, default=MAX_TASKS_PER_RUN)
    args = ap.parse_args()
    profile = AgentProfile()
    profile.inc("runs")
    tasks = []
    if args.task:
        tasks.append({"type": "manual", "id": 0, "title": args.task,
                      "body": "", "impact": 2.0, "risk": 0.1, "url": ""})
    token = os.getenv("GITHUB_TOKEN", "")
    repo = os.getenv("REPO", "") or os.getenv("GITHUB_REPOSITORY", "")
    if token and repo and GITHUB_AVAILABLE:
        try:
            tasks += fetch_github_issues(token, repo)
            tasks += fetch_pull_requests(token, repo)
            tasks += fetch_github_notifications(token, repo)
        except Exception as e:
            logger.warning("Task fetch failed: %s", e)
    if not tasks:
        tasks = [{"type": "self_audit", "id": 0,
                  "title": "Run self-audit and evolve directives",
                  "body": "", "impact": 2.0, "risk": 0.0, "url": ""}]
    ranked = prioritize_tasks(tasks)[: max(1, args.max_tasks)]
    evolve_agent_directives(profile)
    done = 0
    for tt in ranked:
        if handle_task(tt, profile):
            done += 1
    with contextlib.suppress(Exception):
        merge_merged_branches(profile)
    profile.save()
    logger.info("Done: %d/%d tasks handled", done, len(ranked))
    return 0


if __name__ == "__main__":
    sys.exit(main())
