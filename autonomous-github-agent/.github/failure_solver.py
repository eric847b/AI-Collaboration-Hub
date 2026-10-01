"""Proactive Runtime Failure Solver v4.2.0 — safe draft templates for visual/eslint/vite."""
from __future__ import annotations

import base64
import os
import re
import uuid
from typing import Any

import requests

VERSION = "4.2.0"

FAILURE_PATTERNS: list[tuple[str, str, float]] = [
    (r"ModuleNotFoundError|No module named|ImportError", "missing_dependency", 90.0),
    (r"pip install.*failed|Could not find a version that satisfies|ResolutionImpossible", "pip_resolution", 85.0),
    (r"npm ERR!|ELSPROBLEMS|ERESOLVE|peer dep missing|Cannot find module.*node_modules", "npm_install", 84.0),
    (r"yarn.*(error|failed)|YN0000|PNPM.*ERR", "package_manager", 83.0),
    (r"poetry.*(error|failed)|uv (error|failed)|pipenv.*failed", "package_manager", 82.0),
    (r"GITHUB_TOKEN|GH_FULL_PAT|authentication failed|401 Unauthorized|403 Forbidden|Bad credentials", "auth", 88.0),
    (r"SecretNotFound|secret.*not (found|set)|MISSING_SECRET|Required secret", "secrets_missing", 87.0),
    (r"out of memory|OOM|Killed|MemoryError|JavaScript heap out of memory", "oom", 85.0),
    (r"disk space|No space left on device|ENOSPC", "disk", 90.0),
    (r"Timeout|timed out|Read timed out|ConnectTimeout|ETIMEDOUT", "timeout", 80.0),
    (r"rate.?limit|429|Too Many Requests|secondary rate limit|API rate limit", "rate_limit", 82.0),
    (r"Connection refused|Connection reset|Network is unreachable|ECONNREFUSED|ENOTFOUND|getaddrinfo", "network", 77.0),
    (r"SSL|TLS|certificate verify failed|CERT_REQUIRED|self.signed certificate", "tls", 78.0),
    (r"HTTP (502|503|504)|Bad Gateway|Service Unavailable|Gateway Timeout", "http_5xx", 76.0),
    (r"Permission denied|EACCES|Access is denied", "permission", 75.0),
    (r"FileNotFoundError|No such file or directory|ENOENT", "missing_file", 78.0),
    (r"git.*failed|fatal:|error: failed to push|rejected|CONFLICT \\(content\\)|merge conflict", "git", 72.0),
    (r"Checkout failed|Unable to download|Sparse checkout", "checkout", 74.0),
    (r"SyntaxError|IndentationError|TabError", "syntax", 70.0),
    (r"KeyError|AttributeError|TypeError|ValueError|NameError|RuntimeError", "python_runtime", 65.0),
    (r"panic:|SIGSEGV|segmentation fault|fatal runtime error", "native_crash", 88.0),
    (r"AssertionError|assert .+ failed|Expected .+ but", "assert_failure", 73.0),
    (r"vite build|error during build|RollupError|Could not resolve|Failed to resolve|Transform failed|\\[vite\\]", "build_error", 86.0),
    (r"webpack|esbuild|parcel|turbopack.*(error|failed)", "build_error", 85.0),
    (r"TS[0-9]{4}|error TS|tsc.*error|Typecheck failed", "typecheck", 84.0),
    (r"ESLint|eslint.*(error|failed)|max-warnings", "lint", 72.0),
    (r"Prettier|prettier.*(check|error)", "lint", 70.0),
    (r"FAILED tests|pytest.*failed|\\d+ failed", "test_failure", 81.0),
    (r"Jest|Vitest|mocha.*(fail|error)|FAIL  ", "test_failure", 80.0),
    (r"Playwright|playwright.*(failed|timeout)|Error: expect\\(", "playwright", 79.0),
    (r"snapshot doesn.?t exist|toHaveScreenshot|visual.spec.js-snapshots|home-linux\\.png", "visual_baseline", 88.0),
    (r"ESLint couldn.?t find an eslint\\.config|eslint\\.config\\.\\*|migration-guide.*eslint", "eslint_flat_config", 90.0),
    (r"react-hooks/(set-state-in-effect|immutability|refs|purity)|Calling setState synchronously within an effect", "react_hooks_compiler", 84.0),
    (r"import\\.meta\\.dirname|configLoader: .native.|__dirname.*unsupported", "vite_config", 80.0),
    (r"Cypress|CypressError", "playwright", 78.0),
    (r"flaky|intermittent failure|retrying test", "flaky_test", 68.0),
    (r"YAML|yaml\\.load|ScannerError|ParserError|Invalid workflow file", "yaml", 68.0),
    (r"deprecated version of.*upload-artifact|automatically failed because it uses a deprecated", "deprecated_action", 92.0),
    (r"engines\\.node|unsupported engine|Node\\.js version|requires node", "node_engine", 83.0),
    (r"lockfile|package-lock|pnpm-lock|yarn.lock.*(out of sync|mismatch)", "lockfile", 82.0),
    (r"registry\\.json|MISSING on disk|module.*not (found|present) on disk", "registry_missing", 86.0),
    (r"cache (restore|miss|corrupt)|Failed to restore cache", "cache", 66.0),
    (r"Pages deploy|deploy-pages|upload-pages-artifact.*(fail|error)", "pages_deploy", 75.0),
    (r"CodeQL|security-scan|vulnerability|trivy|snyk", "security_scan", 74.0),
    (r"dependency-review|Dependency Review", "dependency_review", 73.0),
    (r"Docker|dockerfile|failed to solve|buildx", "docker", 80.0),
    (r"Action failed|Process completed with exit code [1-9]", "generic_exit", 55.0),
]

DRAFT_PR_CLASSES = frozenset({
    "timeout", "missing_dependency", "missing_file", "build_error",
    "typecheck", "lint", "test_failure", "lockfile", "registry_missing",
    "visual_baseline", "eslint_flat_config", "react_hooks_compiler", "vite_config",
})

# Classes allowed to open a *documentation-only* draft PR with known-good guidance.
# Never mutates application source blindly; never force-merges.
SAFE_DRAFT_CLASSES = frozenset({
    "visual_baseline",
    "eslint_flat_config",
    "vite_config",
})

SAFE_DRAFT_TEMPLATES: dict[str, dict[str, str]] = {
    "visual_baseline": {
        "title": "fix(ci): gate Playwright visual baselines until seeded",
        "path": "docs/SELF_HEAL_VISUAL_BASELINE.md",
        "body": """# Playwright visual baseline gate

**Class:** `visual_baseline`

## Safe remediation (choose one)

1. **CI stability (preferred short-term):** exclude visual specs from default e2e:
   ```json
   "test:e2e": "playwright test --grep-invert visual"
   ```
2. **Seed baselines:** run with seed mode / update snapshots on Linux CI runner, commit `*-linux.png` under `e2e/**/snapshots`.
3. **Skip if missing:** in `visual.spec.js`, `test.skip` when snapshot path does not exist.

## Do not

- Force-merge without green checks
- Commit machine-specific non-linux snapshots as the only baseline

---
Opened as **draft** by FailureSolver safe-draft templates. Human merge only.
""",
    },
    "eslint_flat_config": {
        "title": "fix(lint): migrate to ESLint flat config (eslint.config.*)",
        "path": "docs/SELF_HEAL_ESLINT_FLAT.md",
        "body": """# ESLint flat config migration

**Class:** `eslint_flat_config`

ESLint 9+/10 defaults to `eslint.config.*`. Legacy `.eslintrc.*` alone fails with:
`ESLint couldn't find an eslint.config.* file.`

## Safe remediation

1. Add `eslint.config.js` (or `.mjs`) using project template / `eslint-config-expo/flat` for Expo.
2. Soften max-warnings only if needed for transitional CI green.
3. Keep `rules-of-hooks`; treat experimental react-hooks compiler rules as optional.

## Do not

- Disable all linting permanently
- Force-merge with red lint gate unless owner accepts soft-fail

---
Opened as **draft** by FailureSolver safe-draft templates. Human merge only.
""",
    },
    "vite_config": {
        "title": "fix(vite): prefer import.meta.dirname for native configLoader",
        "path": "docs/SELF_HEAL_VITE_DIRNAME.md",
        "body": """# Vite configLoader / dirname

**Class:** `vite_config`

Native `configLoader` warns on `__dirname` in `vite.config.*`.

## Safe remediation

Replace `__dirname` with `import.meta.dirname` (Node 20.11+ / modern Vite targets).

Optional: `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` only as temporary suppress.

---
Opened as **draft** by FailureSolver safe-draft templates. Human merge only.
""",
    },
}

HARD_FAIL_CONCLUSIONS = frozenset({"failure", "timed_out", "startup_failure"})
LIVING_DEDUPE_CLASSES = frozenset({
    "rate_limit", "timeout", "git", "network", "npm_install",
    "package_manager", "http_5xx", "tls", "cache", "flaky_test",
})

def _rem(desc: str, actions: list[str] | None = None, fix: str = "Inspect logs.") -> dict[str, Any]:
    return {"description": desc, "safe_actions": actions or ["create_issue"], "example_fix": fix}

COMMON_REMEDIATIONS: dict[str, dict[str, Any]] = {
    "missing_dependency": _rem("Add missing package", ["update_requirements", "create_issue", "draft_pr"], "Add to requirements/package.json."),
    "pip_resolution": _rem("Pin versions / clear pip cache", ["update_requirements", "create_issue"]),
    "npm_install": _rem("npm ci/install failed", ["create_issue", "add_backoff"], "Align lockfile; legacy-peer-deps; backoff."),
    "package_manager": _rem("yarn/pnpm/poetry/uv failed", ["create_issue", "add_backoff"]),
    "timeout": _rem("Increase timeouts / retries", ["edit_timeouts", "create_issue", "draft_pr"]),
    "permission": _rem("Token scopes or file permissions"),
    "missing_file": _rem("Guard path existence", ["create_issue", "add_guard", "draft_pr"]),
    "syntax": _rem("Fix syntax error"),
    "python_runtime": _rem("Defensive coding"),
    "rate_limit": _rem("Backoff + Retry-After", ["add_backoff", "create_issue"]),
    "auth": _rem("Token missing/expired"),
    "secrets_missing": _rem("Required secret not set (human gate)"),
    "git": _rem("Git conflict/push reject"),
    "checkout": _rem("actions/checkout failed"),
    "oom": _rem("Out of memory"),
    "disk": _rem("Disk full"),
    "yaml": _rem("Invalid YAML/workflow"),
    "deprecated_action": _rem("Deprecated GH Action", ["create_issue", "draft_pr"]),
    "network": _rem("Transient network", ["add_retry", "create_issue"]),
    "tls": _rem("TLS/certificate failure"),
    "http_5xx": _rem("Upstream 5xx", ["add_retry", "create_issue"]),
    "build_error": _rem("Build failed after install", ["create_issue", "draft_pr"], "Not rate_limit — fix toolchain."),
    "typecheck": _rem("TypeScript failed", ["create_issue", "draft_pr"]),
    "lint": _rem("Lint/format gate", ["create_issue", "draft_pr"]),
    "test_failure": _rem("Unit/integration tests failed"),
    "playwright": _rem("E2E browser tests failed"),
    "flaky_test": _rem("Intermittent test"),
    "node_engine": _rem("Node engine mismatch", ["create_issue", "draft_pr"]),
    "lockfile": _rem("Lockfile out of sync", ["create_issue", "draft_pr"]),
    "registry_missing": _rem("Nexus module missing on disk", ["create_issue", "draft_pr"]),
    "cache": _rem("CI cache issue"),
    "pages_deploy": _rem("GitHub Pages deploy failed"),
    "security_scan": _rem("Security scanner"),
    "dependency_review": _rem("Dependency review gate"),
    "docker": _rem("Docker build failed"),
    "native_crash": _rem("Panic/segfault"),
    "assert_failure": _rem("Assertion failed"),
    "visual_baseline": _rem(
        "Missing Playwright visual baselines",
        ["create_issue", "draft_pr"],
        "Exclude visual from test:e2e until seeded; or workflow_dispatch mode=seed.",
    ),
    "eslint_flat_config": _rem(
        "ESLint 9+/10 requires eslint.config.*",
        ["create_issue", "draft_pr"],
        "Add flat config (eslint-config-expo/flat or project template).",
    ),
    "react_hooks_compiler": _rem(
        "React Compiler / strict hooks rules noise",
        ["create_issue", "draft_pr"],
        "Disable experimental rules in CI or migrate components; keep rules-of-hooks.",
    ),
    "vite_config": _rem(
        "Vite native configLoader path API",
        ["create_issue", "draft_pr"],
        "Replace __dirname with import.meta.dirname in vite.config.",
    ),
    "generic_exit": _rem("Non-zero exit"),
    "unknown": _rem("Unclassified"),
}


class FailureSolver:
    LIVING_DEDUPE_CLASSES = LIVING_DEDUPE_CLASSES

    def __init__(self, repo_name: str, profile: dict | None = None, record_error=None):
        self.repo_name = repo_name
        self.profile = profile if profile is not None else {}
        self.record_error = record_error or (lambda e, c="": None)
        self.token = os.getenv("GH_FULL_PAT") or os.getenv("GITHUB_TOKEN")
        self.headers = {"Authorization": f"token {self.token}", "Accept": "application/vnd.github+json"} if self.token else {}

    def _gh_get(self, url: str, params: dict | None = None) -> tuple[int, Any]:
        if not self.headers:
            return 0, None
        try:
            resp = requests.get(url, headers=self.headers, params=params or {}, timeout=25)
            return (200, resp.json()) if resp.status_code == 200 else (resp.status_code, None)
        except Exception as e:
            self.record_error(e, "failure_solver_get")
            return 0, None

    def _gh_post(self, url: str, payload: dict) -> tuple[int, Any]:
        if not self.headers:
            return 0, None
        try:
            resp = requests.post(url, headers=self.headers, json=payload, timeout=30)
            return (resp.status_code, resp.json()) if resp.status_code in (200, 201) else (resp.status_code, {"error": resp.text[:300]})
        except Exception as e:
            self.record_error(e, "failure_solver_post")
            return 0, None

    def list_recent_failed_runs(self, max_runs: int = 15) -> list[dict]:
        status, data = self._gh_get(f"https://api.github.com/repos/{self.repo_name}/actions/runs", {"per_page": max_runs, "status": "completed"})
        if status != 200 or not data:
            return []
        out = []
        for run in data.get("workflow_runs") or []:
            if (run.get("conclusion") or "").lower() in HARD_FAIL_CONCLUSIONS:
                out.append({"id": run.get("id"), "name": run.get("name"), "conclusion": run.get("conclusion"), "html_url": run.get("html_url"), "created_at": run.get("created_at"), "head_branch": run.get("head_branch"), "head_sha": run.get("head_sha"), "event": run.get("event"), "run_attempt": run.get("run_attempt", 1)})
        return out

    def get_run_jobs(self, run_id: int) -> list[dict]:
        status, data = self._gh_get(f"https://api.github.com/repos/{self.repo_name}/actions/runs/{run_id}/jobs", {"per_page": 20})
        return (data.get("jobs") or []) if status == 200 and data else []

    def get_job_log_tail(self, job_id: int, max_chars: int = 8000) -> str:
        if not self.headers or not job_id:
            return ""
        try:
            resp = requests.get(f"https://api.github.com/repos/{self.repo_name}/actions/jobs/{job_id}/logs", headers=self.headers, timeout=20, allow_redirects=True)
            if resp.status_code != 200:
                return ""
            text = resp.text
            if not text or text.startswith("PK"):
                return ""
            return text[-max_chars:] if len(text) > max_chars else text
        except Exception as e:
            self.record_error(e, "failure_solver_job_logs")
            return ""

    def classify_log_snippet(self, text: str) -> list[dict]:
        if not text:
            return []
        best: dict[str, dict] = {}
        for pattern, cls, score in FAILURE_PATTERNS:
            m = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            if m:
                start, end = max(0, m.start() - 80), min(len(text), m.end() + 120)
                item = {"class": cls, "score": score, "context": text[start:end].replace("\n", " ")[:200], "remediation": COMMON_REMEDIATIONS.get(cls, COMMON_REMEDIATIONS["unknown"])}
                if cls not in best or score > best[cls]["score"]:
                    best[cls] = item
        return sorted(best.values(), key=lambda x: x["score"], reverse=True)

    def _step_heuristics(self, failing_steps: list[dict], classifications: list[dict]) -> None:
        blob = " ".join(f"{(s.get('step') or '')} {(s.get('job') or '')}" for s in failing_steps).lower()
        have = {c.get("class") for c in classifications}

        def add(cls: str, score: float, ctx: str) -> None:
            if cls not in have:
                classifications.append({"class": cls, "score": score, "context": ctx, "remediation": COMMON_REMEDIATIONS.get(cls, COMMON_REMEDIATIONS["unknown"])})
                have.add(cls)

        if "build" in blob and "rate_limit" not in have:
            add("build_error", 87.0, "step name: build")
        if any(x in blob for x in ("typecheck", "tsc")):
            add("typecheck", 85.0, "step name: typecheck")
        if any(x in blob for x in ("lint", "eslint")):
            add("lint", 80.0, "step name: lint")
        if any(x in blob for x in ("test", "pytest", "jest")):
            add("test_failure", 82.0, "step name: test")
        if any(x in blob for x in ("playwright", "e2e", "smoke")):
            add("playwright", 81.0, "step name: e2e")
        if any(x in blob for x in ("visual", "screenshot", "snapshot")):
            add("visual_baseline", 86.0, "step name: visual")
        if "eslint" in blob and "flat" in blob:
            add("eslint_flat_config", 88.0, "step name: eslint flat")
        if "vite" in blob and ("config" in blob or "dirname" in blob):
            add("vite_config", 82.0, "step name: vite config")
        if "install" in blob and "build" not in blob:
            add("npm_install", 80.0, "step name: install")
        if "deploy" in blob or "pages" in blob:
            add("pages_deploy", 78.0, "step name: deploy")
        if "docker" in blob:
            add("docker", 80.0, "step name: docker")
        if "registry" in blob or "nexus" in blob:
            add("registry_missing", 84.0, "step name: registry")

    def analyze_run(self, run: dict) -> dict:
        jobs = self.get_run_jobs(run["id"])
        classifications: list[dict] = []
        failing_steps: list[dict] = []
        for job in jobs:
            if (job.get("conclusion") or "").lower() not in ("failure", "timed_out"):
                continue
            for step in job.get("steps") or []:
                if (step.get("conclusion") or "").lower() in ("failure", "timed_out"):
                    failing_steps.append({"job": job.get("name"), "step": step.get("name"), "conclusion": step.get("conclusion"), "number": step.get("number")})
            log_text = self.get_job_log_tail(job.get("id") or 0)
            proxy = " ".join([run.get("name") or "", job.get("name") or "", " ".join(s.get("name") or "" for s in job.get("steps") or [])])
            classifications.extend(self.classify_log_snippet((log_text + "\n" + proxy) if log_text else proxy))
        if run.get("conclusion") == "timed_out":
            classifications.append({"class": "timeout", "score": 85.0, "context": "timed_out", "remediation": COMMON_REMEDIATIONS["timeout"]})
        self._step_heuristics(failing_steps, classifications)
        seen: set[str] = set()
        unique: list[dict] = []
        for c in sorted(classifications, key=lambda x: x["score"], reverse=True):
            if c["class"] not in seen:
                seen.add(c["class"])
                unique.append(c)
        return {"run": run, "failing_steps": failing_steps, "classifications": unique[:8], "top_class": unique[0]["class"] if unique else "unknown", "top_score": unique[0]["score"] if unique else 40.0}

    def scan_and_prioritize(self, max_runs: int = 10) -> list[dict]:
        analyses = []
        for run in self.list_recent_failed_runs(max_runs=max_runs):
            try:
                analyses.append(self.analyze_run(run))
            except Exception as e:
                self.record_error(e, "analyze_run")
        analyses.sort(key=lambda a: a.get("top_score", 0), reverse=True)
        return analyses

    def _existing_issue_for_run(self, run_id: int) -> dict | None:
        if not self.headers or not run_id:
            return None
        status, data = self._gh_get("https://api.github.com/search/issues", {"q": f"repo:{self.repo_name} is:issue is:open label:runtime-failure #{run_id}", "per_page": 5})
        if status != 200 or not data:
            return None
        for it in data.get("items") or []:
            title, body = it.get("title") or "", it.get("body") or ""
            if f"#{run_id}" in title or f"#{run_id}" in body or str(run_id) in title:
                return {"number": it.get("number"), "html_url": it.get("html_url"), "class": "existing"}
        return None

    def _existing_issue_for_class_workflow(self, cls: str, workflow: str) -> dict | None:
        if not self.headers or cls not in self.LIVING_DEDUPE_CLASSES or not workflow:
            return None
        status, data = self._gh_get("https://api.github.com/search/issues", {"q": f'repo:{self.repo_name} is:issue is:open label:runtime-failure label:{cls}', "per_page": 20, "sort": "updated", "order": "desc"})
        if status != 200 or not data:
            return None
        wf = workflow.strip().lower()
        for it in data.get("items") or []:
            if wf in (it.get("title") or "").lower():
                return {"number": it.get("number"), "html_url": it.get("html_url"), "class": "living"}
        return None

    def _comment_on_issue(self, number: int, body: str) -> bool:
        if not self.headers or not number:
            return False
        status, _ = self._gh_post(f"https://api.github.com/repos/{self.repo_name}/issues/{number}/comments", {"body": body[:6000]})
        return status in (200, 201)

    def _existing_open_draft_for_class(self, cls: str) -> dict | None:
        if not self.headers or cls not in SAFE_DRAFT_CLASSES:
            return None
        q = f'repo:{self.repo_name} is:pr is:open is:draft in:title "FailureSolver safe-draft: {cls}"'
        status, data = self._gh_get("https://api.github.com/search/issues", {"q": q, "per_page": 5})
        if status != 200 or not data:
            return None
        for it in data.get("items") or []:
            return {"number": it.get("number"), "html_url": it.get("html_url"), "class": "existing_draft"}
        return None

    def open_safe_draft_pr(self, cls: str, analysis: dict | None = None) -> dict | None:
        """Open a documentation-only draft PR for a narrow set of Hub CI classes."""
        if not self.headers or cls not in SAFE_DRAFT_CLASSES:
            return None
        if os.getenv("FS_SAFE_DRAFT", "1") != "1":
            return None
        existing = self._existing_open_draft_for_class(cls)
        if existing:
            self.profile["failure_solver_drafts_deduped"] = int(self.profile.get("failure_solver_drafts_deduped") or 0) + 1
            return existing
        tpl = SAFE_DRAFT_TEMPLATES.get(cls) or {}
        if not tpl:
            return None
        try:
            st, repo_data = self._gh_get(f"https://api.github.com/repos/{self.repo_name}")
            if st != 200 or not isinstance(repo_data, dict):
                return None
            default_branch = repo_data.get("default_branch") or "main"
            ref_st, ref = self._gh_get(f"https://api.github.com/repos/{self.repo_name}/git/ref/heads/{default_branch}")
            if ref_st != 200 or not isinstance(ref, dict):
                return None
            sha = (ref.get("object") or {}).get("sha")
            if not sha:
                return None
            branch = f"fs-safe-draft/{cls}-{uuid.uuid4().hex[:8]}"
            br_st, _ = self._gh_post(
                f"https://api.github.com/repos/{self.repo_name}/git/refs",
                {"ref": f"refs/heads/{branch}", "sha": sha},
            )
            if br_st not in (200, 201):
                return None
            run = (analysis or {}).get("run") or {}
            doc = tpl.get("body") or ""
            if run.get("html_url"):
                doc += f"\n\n**Trigger run:** {run.get('html_url')}\n"
            content_b64 = base64.b64encode(doc.encode()).decode("ascii")
            put = requests.put(
                f"https://api.github.com/repos/{self.repo_name}/contents/{tpl.get('path')}",
                headers=self.headers,
                json={
                    "message": f"docs: FailureSolver safe-draft guidance for {cls}",
                    "content": content_b64,
                    "branch": branch,
                },
                timeout=25,
            )
            if put.status_code not in (200, 201):
                return None
            title = f"FailureSolver safe-draft: {cls} — {tpl.get('title') or cls}"
            pr_body = (
                f"Documentation-only safe draft for **`{cls}`**.\n\n"
                f"No application source mutation. No force-merge.\n\n"
                f"Follow `{tpl.get('path')}` then implement in a follow-up PR if needed.\n\n"
                f"FailureSolver v{VERSION}"
            )
            pr_st, pr = self._gh_post(
                f"https://api.github.com/repos/{self.repo_name}/pulls",
                {
                    "title": title[:200],
                    "body": pr_body,
                    "head": branch,
                    "base": default_branch,
                    "draft": True,
                },
            )
            if pr_st in (200, 201) and isinstance(pr, dict):
                self.profile["failure_solver_safe_drafts"] = int(self.profile.get("failure_solver_safe_drafts") or 0) + 1
                return {"number": pr.get("number"), "html_url": pr.get("html_url"), "class": cls, "draft": True}
        except Exception as e:
            self.record_error(e, "failure_solver_safe_draft")
        return None

    def create_remediation_issue(self, analysis: dict) -> dict | None:
        if not self.headers:
            return None
        run = analysis.get("run") or {}
        run_id = run.get("id")
        existing = self._existing_issue_for_run(run_id) if run_id else None
        if existing:
            self.profile["failures_deduped"] = self.profile.get("failures_deduped", 0) + 1
            return existing
        cls = analysis.get("top_class") or "unknown"
        rem = COMMON_REMEDIATIONS.get(cls, COMMON_REMEDIATIONS["unknown"])
        living = self._existing_issue_for_class_workflow(cls, run.get("name") or "")
        if living:
            self._comment_on_issue(int(living["number"]), f"**Recurrence** (FailureSolver v{VERSION}) on [{run.get('name')}]({run.get('html_url')}) `#{run_id}`")
            self.profile["failures_deduped"] = self.profile.get("failures_deduped", 0) + 1
            return living
        title = f"🛠️ Runtime failure: {cls} — {run.get('name', 'workflow')} #{run.get('id')}"
        steps = "\n".join(f"- `{s.get('job')}` / `{s.get('step')}` → `{s.get('conclusion')}`" for s in (analysis.get("failing_steps") or []))
        body = f"**Run:** [{run.get('name')}]({run.get('html_url')})\n**Conclusion:** `{run.get('conclusion')}`\n**Class:** `{cls}` ({analysis.get('top_score', 0):.0f})\n\n### Remediation\n{rem.get('description', 'Investigate.')}\n\n**Example:** {rem.get('example_fix', 'Inspect logs.')}\n\n### Steps\n{steps}\n\n---\n**FailureSolver v{VERSION}**"
        status, data = self._gh_post(f"https://api.github.com/repos/{self.repo_name}/issues", {"title": title[:200], "body": body, "labels": ["runtime-failure", "self-heal", "catalyst", cls]})
        if status in (200, 201) and isinstance(data, dict):
            self.profile["failures_triaged"] = self.profile.get("failures_triaged", 0) + 1
            out = {"number": data.get("number"), "html_url": data.get("html_url"), "class": cls}
            if cls in SAFE_DRAFT_CLASSES:
                draft = self.open_safe_draft_pr(cls, analysis)
                if draft:
                    out["draft_pr"] = draft
            return out
        return None

    def run(self, max_runs: int = 8, max_issues: int = 3) -> dict:
        analyses = self.scan_and_prioritize(max_runs=max_runs)
        created = []
        for analysis in analyses:
            if len(created) >= max_issues:
                break
            if analysis.get("top_score", 0) < 60:
                continue
            issue = self.create_remediation_issue(analysis)
            if issue and issue.get("class") not in ("existing", "living"):
                created.append(issue)
            elif issue:
                created.append(issue)
        top_classes = [a.get("top_class") for a in analyses[:5]]
        return {"scanned": len(analyses), "created": created, "top_classes": top_classes}


def run_failure_solver(
    repo: str | None = None,
    profile: dict | None = None,
    record_error=None,
) -> str:
    repo = repo or os.getenv("GITHUB_REPOSITORY", "eric847b/autonomous-github-agent")
    try:
        result = FailureSolver(repo, profile=profile, record_error=record_error).run()
        return f"FAILURE_SOLVER v{VERSION} scanned={result.get('scanned')} created={len(result.get('created') or [])} top={result.get('top_classes')}"
    except Exception as exc:
        if record_error:
            record_error(exc, "failure_solver")
        return f"FAILURE_SOLVER_FAIL:{str(exc)[:120]}"


if __name__ == "__main__":
    print(run_failure_solver())
