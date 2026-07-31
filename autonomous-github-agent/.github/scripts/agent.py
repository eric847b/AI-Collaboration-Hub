#!/usr/bin/env python3
"""
Autonomous GitHub Agent - LLM-powered self-improving agent for GitHub repos.
Perfected v4.3 - Multi-task solve-all, hardened lockfiles, continuous monorepo development.

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
"""

import os
import json
import re
import time
import logging
import requests
import subprocess
import sys
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple

try:
    from github import Github
    GITHUB_AVAILABLE = True
except ImportError:
    GITHUB_AVAILABLE = False

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('.agent.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)

MAX_RETRIES = 5
RETRY_BASE_DELAY = 1
RETRY_MAX_DELAY = 30
PROFILE_PATH = ".agent_profile.json"
MAX_DEPTH = 3
DEFAULT_MAX_ITERATIONS = 10
STALE_PR_DAYS = 2
MAX_TASKS_PER_RUN = 3  # v4.3: solve multiple problems per cycle

HIGH_RISK_KEYWORDS = {
    'destructive': ['delete', 'rm ', 'remove', 'destroy', 'wipe', 'purge'],
    'security': ['modify security', 'exfiltrate', 'malicious', 'inject', 'exfil'],
    'system': ['sudo', 'chmod', 'chown', 'format', 'partition'],
    'network': ['curl', 'wget', 'download', 'scrape', 'exfiltrate']
}
HIGH_RISK_PATTERNS = [kw for category in HIGH_RISK_KEYWORDS.values() for kw in category]

FREE_PROVIDERS = ['deepseek', 'huggingface', 'ollama', 'github_models', 'openrouter']
PAID_PROVIDERS = ['openai', 'anthropic', 'gemini']

SKIP_DIRS = {
    '.git', 'node_modules', 'Archive', 'dist', 'build', '__pycache__',
    '.venv', 'venv', '.tox', 'coverage', '.next', '.expo', '.cache'
}

KNOWN_PYTHON_PROJECTS = (
    "singularity-operator", "autonomous-github-agent", "solutions-dynamics",
    "AI-Collaboration-Hub", "nexus-core"
)

KNOWN_NODE_PROJECTS = (
    "nexus-infinity-hub", "self-evolve-dash", "ai-chat-websites",
    "collabhub-modules", "third-door-blink-controller"
)


class AgentProfile:
    def __init__(self, path: str = PROFILE_PATH):
        self.path = path
        self.data = self._load()

    def _load(self) -> Dict:
        defaults = {
            "runs": 0, "errors": 0, "security_events": 0,
            "injections_blocked": 0, "high_risk_blocked": 0,
            "avg_latency": 0, "success_rate": 1.0,
            "directives": [], "max_iterations": DEFAULT_MAX_ITERATIONS,
            "retry_count": 3, "provider_stats": {},
            "branches_deleted": 0, "prs_closed": 0,
            "lockfiles_fixed": 0, "problems_solved": 0,
            "tasks_attempted": 0, "version": "4.3"
        }
        if os.path.exists(self.path):
            try:
                with open(self.path, 'r') as f:
                    data = json.load(f)
                    for key, value in defaults.items():
                        if key not in data:
                            data[key] = value
                    return data
            except Exception as e:
                logger.warning(f"Profile load error: {e}")
        return defaults

    def save(self):
        with open(self.path, 'w') as f:
            json.dump(self.data, f, indent=2)

    def record_success(self, latency: float, provider: str = "unknown"):
        self.data["runs"] += 1
        prev_avg = self.data.get("avg_latency", 0)
        runs = self.data["runs"]
        self.data["avg_latency"] = (prev_avg * (runs - 1) + latency) / runs
        if provider not in self.data["provider_stats"]:
            self.data["provider_stats"][provider] = {"calls": 0, "latency": 0}
        stats = self.data["provider_stats"][provider]
        stats["calls"] += 1
        prev = stats.get("latency", 0)
        stats["latency"] = (prev * (stats["calls"] - 1) + latency) / stats["calls"]

    def record_error(self):
        self.data["errors"] += 1

    def record_security_event(self, event_type: str):
        self.data["security_events"] += 1
        if event_type == "injection":
            self.data["injections_blocked"] += 1
        elif event_type == "high_risk":
            self.data["high_risk_blocked"] += 1


def sanitize_input(text: str, profile: AgentProfile = None) -> str:
    if not text:
        return ""
    sanitized = text
    sanitized = re.sub(r'<!--.*?-->', '', sanitized, flags=re.DOTALL)
    sanitized = re.sub(r'<!(--.*?--|.*?-->)', '', sanitized, flags=re.DOTALL)
    dangerous_patterns = [
        r'ignore all previous', r'system:', r'\bsystem\s*:', r'override system',
        r'new instructions:', r'you are now', r'roleplay as', r'developer mode',
        r'jailbreak',
    ]
    lower_sanitized = sanitized.lower()
    for pattern in dangerous_patterns:
        if re.search(pattern, lower_sanitized):
            if profile:
                profile.record_security_event("injection")
            return "[BLOCKED - Injection detected]"
    sanitized = sanitized.replace('<', '&lt;').replace('>', '&gt;')
    return sanitized


def is_high_risk(action: str) -> bool:
    action_lower = action.lower()
    return any(pattern in action_lower for pattern in HIGH_RISK_PATTERNS)


def get_risk_category(action: str) -> Optional[str]:
    action_lower = action.lower()
    for category, keywords in HIGH_RISK_KEYWORDS.items():
        if any(kw in action_lower for kw in keywords):
            return category
    return None


def get_depth() -> int:
    try:
        result = os.popen('git log -1 --pretty=format:"%s"').read()
        if 'DEPTH:' in result:
            match = re.search(r'DEPTH:(\d+)', result)
            if match:
                return int(match.group(1))
    except Exception as e:
        logger.debug(f"Depth check error: {e}")
    return 0


def with_retry(func, *args, max_retries: int = MAX_RETRIES, **kwargs) -> Tuple[Any, Optional[str]]:
    last_error = None
    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs), None
        except Exception as e:
            last_error = str(e)
            delay = min(RETRY_BASE_DELAY * (2 ** attempt), RETRY_MAX_DELAY)
            logger.warning(f"Retry attempt {attempt + 1}/{max_retries} after {delay}s: {e}")
            time.sleep(delay)
    return None, last_error


# ==================== LLM PROVIDER FUNCTIONS ====================

def call_deepseek(prompt: str) -> Optional[str]:
    try:
        headers = {"Authorization": f"Bearer {os.getenv('DEEPSEEK_API_KEY', 'sk-free')}"}
        resp = requests.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers=headers,
            json={"model": "deepseek-chat", "messages": [{"role": "user", "content": prompt}]},
            timeout=30
        )
        if resp.ok:
            return resp.json()["choices"][0]["message"]["content"]
    except Exception as e:
        logger.debug(f"DeepSeek error: {e}")
    return None


def call_ollama(prompt: str) -> Optional[str]:
    try:
        resp = requests.post(
            "http://localhost:11434/api/chat",
            json={"model": "llama3", "messages": [{"role": "user", "content": prompt}], "stream": False},
            timeout=60
        )
        if resp.ok:
            return resp.json()["message"]["content"]
    except Exception as e:
        logger.debug(f"Ollama error: {e}")
    return None


def call_huggingface(prompt: str) -> Optional[str]:
    try:
        token = os.getenv("HF_API_KEY") or os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_API_KEY")
        if token:
            resp = requests.post(
                "https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct",
                headers={"Authorization": f"Bearer {token}"},
                json={"inputs": prompt},
                timeout=60
            )
            if resp.ok:
                data = resp.json()
                return data[0].get("generated_text", data.get("generated_text", ""))
    except Exception as e:
        logger.debug(f"HuggingFace error: {e}")
    return None


def call_openrouter(prompt: str) -> Optional[str]:
    try:
        token = os.getenv("OPENROUTER_API_KEY")
        if token:
            resp = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {token}"},
                json={"model": "google/gemma-7b-it:free", "messages": [{"role": "user", "content": prompt}]},
                timeout=30
            )
            if resp.ok:
                return resp.json()["choices"][0]["message"]["content"]
    except Exception as e:
        logger.debug(f"OpenRouter error: {e}")
    return None


def call_github_models(prompt: str) -> Optional[str]:
    try:
        token = os.getenv("GITHUB_TOKEN")
        if token:
            resp = requests.post(
                "https://api.github.com/models/chat/completions",
                headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"},
                json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": prompt}]},
                timeout=30
            )
            if resp.ok:
                return resp.json()["choices"][0]["message"]["content"]
    except Exception as e:
        logger.debug(f"GitHub Models error: {e}")
    return None


def call_gemini(prompt: str) -> Optional[str]:
    try:
        token = os.getenv("GEMINI_API_KEY")
        if token:
            resp = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={token}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
                timeout=30
            )
            if resp.ok:
                return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        logger.debug(f"Gemini error: {e}")
    return None


def call_openai(prompt: str) -> Optional[str]:
    try:
        if os.getenv("OPENAI_API_KEY"):
            from openai import OpenAI
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            resp = client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=2048
            )
            return resp.choices[0].message.content
    except Exception as e:
        logger.debug(f"OpenAI error: {e}")
    return None


def call_anthropic(prompt: str) -> Optional[str]:
    try:
        if os.getenv("ANTHROPIC_API_KEY"):
            from anthropic import Anthropic
            client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
            resp = client.messages.create(
                model="claude-3-opus-20240229",
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}]
            )
            return resp.content[0].text
    except Exception as e:
        logger.debug(f"Anthropic error: {e}")
    return None


def call_llm(prompt: str, provider: str = "auto", profile: AgentProfile = None) -> str:
    start_time = time.time()
    for p in FREE_PROVIDERS + PAID_PROVIDERS:
        if provider != "auto" and provider != p:
            continue
        func_name = f"call_{p}"
        if func_name in globals():
            result = globals()[func_name](prompt)
            if result:
                latency = time.time() - start_time
                if profile:
                    profile.record_success(latency, p)
                return result
    return "[No LLM] Tip: Use DEEPSEEK_API_KEY or HF_TOKEN for free AI"


# ==================== LOCKFILE HANDLING (v4.3 hardened) ====================

def _has_node_lockfile(dir_path: str) -> bool:
    for name in ("package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock"):
        if os.path.isfile(os.path.join(dir_path, name)):
            return True
    return False


def _package_json_has_deps(dir_path: str) -> bool:
    pkg = os.path.join(dir_path, "package.json")
    if not os.path.isfile(pkg):
        return False
    try:
        with open(pkg, 'r', errors='ignore') as f:
            data = json.load(f)
        deps = data.get("dependencies") or {}
        dev = data.get("devDependencies") or {}
        return bool(deps) or bool(dev)
    except Exception:
        return True  # assume needs lockfile if unreadable


def scan_lockfile_gaps() -> List[Dict]:
    """Find package.json projects missing lockfiles; high-ROI maintenance tasks."""
    tasks = []
    seen = set()
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.')]
        if "package.json" not in files:
            continue
        if _has_node_lockfile(root):
            continue
        # Root workspace with no deps: optional / lower priority
        has_deps = _package_json_has_deps(root)
        rel = root if root != "." else "."
        if rel in seen:
            continue
        seen.add(rel)
        impact = 2.4 if has_deps else 1.4
        tasks.append({
            "type": "lockfile",
            "id": f"lockfile_{hashlib.md5(rel.encode()).hexdigest()[:8]}",
            "title": f"Generate missing Node lockfile for {rel}",
            "body": (
                f"Project at `{rel}` has package.json but no package-lock.json / "
                f"pnpm-lock.yaml / yarn.lock / bun.lock. "
                f"Run npm/pnpm/yarn install and commit the lockfile for reproducible builds."
            ),
            "path": os.path.join(rel, "package.json"),
            "project_dir": rel,
            "impact": impact,
            "risk": 0.12,
            "has_deps": has_deps,
        })
    # Python advisory gaps
    for proj in KNOWN_PYTHON_PROJECTS:
        if not os.path.isdir(proj):
            continue
        has_req = (
            os.path.isfile(os.path.join(proj, "requirements.txt"))
            or os.path.isfile(os.path.join(proj, "pyproject.toml"))
            or os.path.isfile(os.path.join(proj, "Pipfile"))
        )
        if not has_req:
            tasks.append({
                "type": "lockfile",
                "id": f"pyreq_{proj}",
                "title": f"Add requirements.txt for Python project {proj}",
                "body": (
                    f"Python project `{proj}` lacks requirements.txt / pyproject.toml. "
                    f"Declare dependencies for reproducible installs."
                ),
                "path": os.path.join(proj, "requirements.txt"),
                "project_dir": proj,
                "impact": 1.9,
                "risk": 0.1,
                "python": True,
            })
    return tasks


def try_generate_lockfile(project_dir: str, profile: AgentProfile = None) -> Dict:
    """Attempt npm/pnpm/yarn lockfile generation (prefer --package-lock-only)."""
    result = {"success": False, "output": "", "error": ""}
    try:
        if not os.path.isdir(project_dir):
            result["error"] = f"Not a directory: {project_dir}"
            return result
        pkg = os.path.join(project_dir, "package.json")
        if not os.path.isfile(pkg):
            result["error"] = "No package.json"
            return result

        # Safe commands only — no network-heavy full install if possible
        commands = [
            f"cd {project_dir!r} && npm install --package-lock-only --ignore-scripts --no-audit --no-fund 2>&1",
            f"cd {project_dir!r} && pnpm install --lockfile-only --ignore-scripts 2>&1",
            f"cd {project_dir!r} && yarn install --mode=update-lockfile 2>&1",
            f"cd {project_dir!r} && npm install --ignore-scripts --no-audit --no-fund --package-lock-only 2>&1",
        ]
        outputs = []
        for cmd in commands:
            try:
                out = os.popen(cmd).read()
                outputs.append(out[-800:] if out else "")
                if _has_node_lockfile(project_dir):
                    result = {"success": True, "output": "\n".join(outputs)[-2000:]}
                    if profile:
                        profile.data["lockfiles_fixed"] = profile.data.get("lockfiles_fixed", 0) + 1
                    return result
            except Exception as e:
                outputs.append(str(e))

        # Minimal empty-ish lockfile for no-deps workspace root
        if not _package_json_has_deps(project_dir):
            lock_path = os.path.join(project_dir, "package-lock.json")
            try:
                with open(pkg, 'r') as f:
                    pkg_data = json.load(f)
                name = pkg_data.get("name", "workspace-root")
                version = pkg_data.get("version", "1.0.0")
                minimal = {
                    "name": name,
                    "version": version,
                    "lockfileVersion": 3,
                    "requires": True,
                    "packages": {
                        "": {"name": name, "version": version}
                    }
                }
                with open(lock_path, 'w') as f:
                    json.dump(minimal, f, indent=2)
                    f.write("\n")
                if _has_node_lockfile(project_dir):
                    result = {"success": True, "output": "Created minimal package-lock.json for no-deps workspace"}
                    if profile:
                        profile.data["lockfiles_fixed"] = profile.data.get("lockfiles_fixed", 0) + 1
                    return result
            except Exception as e:
                result["error"] = f"minimal lockfile failed: {e}"

        result["error"] = "Could not produce lockfile (network may be restricted in CI)"
        result["output"] = "\n".join(outputs)[-1500:]
    except Exception as e:
        result["error"] = str(e)
    return result


def try_generate_python_requirements(project_dir: str, profile: AgentProfile = None) -> Dict:
    """Create a minimal requirements.txt by scanning imports (best-effort)."""
    result = {"success": False, "output": "", "error": ""}
    try:
        req_path = os.path.join(project_dir, "requirements.txt")
        if os.path.isfile(req_path):
            result["success"] = True
            result["output"] = "already exists"
            return result
        imports = set()
        stdlibish = {
            'os', 'sys', 're', 'json', 'time', 'logging', 'datetime', 'typing',
            'hashlib', 'subprocess', 'pathlib', 'collections', 'itertools',
            'functools', 'abc', 'copy', 'math', 'random', 'uuid', 'io',
            'tempfile', 'shutil', 'threading', 'multiprocessing', 'asyncio',
            'unittest', 'argparse', 'configparser', 'csv', 'sqlite3', 'http',
            'urllib', 'email', 'base64', 'struct', 'socket', 'ssl'
        }
        for root, dirs, files in os.walk(project_dir):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.')]
            for f in files:
                if not f.endswith('.py'):
                    continue
                try:
                    with open(os.path.join(root, f), 'r', errors='ignore') as fh:
                        for line in fh:
                            m = re.match(r'^\s*(?:from|import)\s+([a-zA-Z0-9_]+)', line)
                            if m:
                                mod = m.group(1)
                                if mod not in stdlibish and not mod.startswith('_'):
                                    imports.add(mod)
                except Exception:
                    pass
        # Map common packages
        pkg_map = {
            'github': 'PyGithub',
            'requests': 'requests',
            'openai': 'openai',
            'anthropic': 'anthropic',
            'dotenv': 'python-dotenv',
            'yaml': 'PyYAML',
            'bs4': 'beautifulsoup4',
            'PIL': 'Pillow',
            'cv2': 'opencv-python',
            'sklearn': 'scikit-learn',
            'flask': 'flask',
            'fastapi': 'fastapi',
            'pydantic': 'pydantic',
            'numpy': 'numpy',
            'pandas': 'pandas',
            'torch': 'torch',
            'transformers': 'transformers',
        }
        lines = []
        for mod in sorted(imports):
            lines.append(pkg_map.get(mod, mod))
        if not lines:
            lines = ["# Auto-generated placeholder — add project dependencies here", "requests>=2.28.0"]
        content = "# Auto-generated by autonomous-github-agent v4.3\n" + "\n".join(lines) + "\n"
        with open(req_path, 'w') as f:
            f.write(content)
        result = {"success": True, "output": f"Wrote {req_path} with {len(lines)} entries"}
        if profile:
            profile.data["lockfiles_fixed"] = profile.data.get("lockfiles_fixed", 0) + 1
    except Exception as e:
        result["error"] = str(e)
    return result


# ==================== BROADER PROBLEM SCANNERS (v4.3) ====================

def scan_ci_gaps() -> List[Dict]:
    """Projects missing basic CI / workflow coverage."""
    tasks = []
    workflows_dir = ".github/workflows"
    has_workflows = os.path.isdir(workflows_dir)
    if not has_workflows:
        tasks.append({
            "type": "ci_gap",
            "id": "ci_root",
            "title": "Add root GitHub Actions workflows",
            "body": "Repository lacks .github/workflows — add lint/test/lockfile validation.",
            "impact": 2.0,
            "risk": 0.2,
            "path": ".github/workflows",
        })
    for proj in list(KNOWN_NODE_PROJECTS) + list(KNOWN_PYTHON_PROJECTS):
        if not os.path.isdir(proj):
            continue
        # Missing README
        if not os.path.isfile(os.path.join(proj, "README.md")):
            tasks.append({
                "type": "docs",
                "id": f"readme_{proj}",
                "title": f"Add README.md for {proj}",
                "body": f"Project `{proj}` has no README. Add setup, usage, and contribution notes.",
                "path": os.path.join(proj, "README.md"),
                "project_dir": proj,
                "impact": 1.5,
                "risk": 0.05,
            })
    return tasks


def scan_proactive_improvements() -> List[Dict]:
    """When few urgent tasks exist, still drive continuous development."""
    tasks = []
    # Health script presence
    if os.path.isdir("tools") and not os.path.isfile("tools/health-check.ps1"):
        tasks.append({
            "type": "agent_improvement",
            "id": "health_script",
            "title": "Add tools/health-check.ps1 for workspace lockfile/deps health",
            "body": "Create a PowerShell health check that verifies Node lockfiles and Python requirements across the monorepo.",
            "path": "tools/health-check.ps1",
            "impact": 1.7,
            "risk": 0.1,
        })
    # Agent self-improvement: ensure profile version tracked
    tasks.append({
        "type": "agent_improvement",
        "id": "agent_v43_note",
        "title": "Document v4.3 solve-all + lockfile autonomy in agent README",
        "body": "Ensure autonomous-github-agent/README.md reflects multi-task, lockfile generation, and continuous monorepo development.",
        "path": "autonomous-github-agent/README.md",
        "impact": 1.2,
        "risk": 0.05,
    })
    return tasks


# ==================== GITHUB HYGIENE ====================

def cleanup_remote_auto_fix_branches(profile: AgentProfile = None) -> Dict:
    result = {"deleted": [], "error": ""}
    if not GITHUB_AVAILABLE:
        return result
    try:
        token = os.getenv("GITHUB_TOKEN")
        repo = os.getenv("REPO")
        if not token or not repo:
            return result
        g = Github(token)
        r = g.get_repo(repo)
        main_sha = r.get_branch("main").commit.sha
        for b in r.get_branches():
            name = b.name
            if name in ("main", "master") or getattr(b, "protected", False):
                continue
            if not name.startswith("auto-fix-"):
                continue
            try:
                if b.commit.sha == main_sha:
                    r.get_git_ref(f"heads/{name}").delete()
                    result["deleted"].append(name)
                    continue
                comparison = r.compare("main", name)
                if comparison.ahead_by == 0:
                    r.get_git_ref(f"heads/{name}").delete()
                    result["deleted"].append(name)
            except Exception as e:
                logger.debug(f"Skip branch {name}: {e}")
        if profile and result["deleted"]:
            profile.data["branches_deleted"] = profile.data.get("branches_deleted", 0) + len(result["deleted"])
        logger.info(f"Remote branch cleanup: deleted {len(result['deleted'])}")
    except Exception as e:
        result["error"] = str(e)
        logger.debug(f"Remote cleanup error: {e}")
    return result


def close_stale_draft_prs(profile: AgentProfile = None, days: int = STALE_PR_DAYS) -> Dict:
    result = {"closed": [], "error": ""}
    if not GITHUB_AVAILABLE:
        return result
    try:
        token = os.getenv("GITHUB_TOKEN")
        repo = os.getenv("REPO")
        if not token or not repo:
            return result
        g = Github(token)
        r = g.get_repo(repo)
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        for pr in r.get_pulls(state="open"):
            try:
                created = pr.created_at
                if created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                head = pr.head.ref if pr.head else ""
                is_bot = pr.title.startswith("🤖") or (head or "").startswith("auto-fix-")
                if is_bot and created < cutoff:
                    pr.edit(state="closed")
                    result["closed"].append(pr.number)
            except Exception as e:
                logger.debug(f"PR close skip: {e}")
        if profile and result["closed"]:
            profile.data["prs_closed"] = profile.data.get("prs_closed", 0) + len(result["closed"])
        logger.info(f"Stale PR cleanup: closed {len(result['closed'])}")
    except Exception as e:
        result["error"] = str(e)
    return result


# ==================== GITHUB + CODE SCAN ====================

def fetch_github_issues() -> List[Dict]:
    tasks = []
    if not GITHUB_AVAILABLE:
        return tasks
    try:
        token = os.getenv("GITHUB_TOKEN")
        repo = os.getenv("REPO")
        if not token or not repo:
            return tasks
        g = Github(token)
        r = g.get_repo(repo)
        for issue in list(r.get_issues(state="open"))[:25]:
            if issue.pull_request:
                continue
            blob = (issue.title + " " + (issue.body or "")).lower()
            impact = 2.8 if any(k in blob for k in ("bug", "crash", "security", "broken", "fail")) else 2.2
            tasks.append({
                "type": "issue",
                "id": f"issue_{issue.number}",
                "title": sanitize_input(issue.title),
                "body": sanitize_input((issue.body or "")[:2500]),
                "impact": impact,
                "risk": 0.1,
                "url": issue.html_url,
                "issue_number": issue.number
            })
    except Exception as e:
        logger.debug(f"GitHub issues fetch failed: {e}")
    return tasks


def fetch_github_notifications() -> List[Dict]:
    tasks = []
    if not GITHUB_AVAILABLE:
        return tasks
    try:
        token = os.getenv("GITHUB_TOKEN")
        if not token:
            return tasks
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"}
        resp = requests.get(
            "https://api.github.com/notifications",
            headers=headers,
            params={"all": "false", "per_page": 20}
        )
        if resp.ok:
            for note in resp.json():
                title = sanitize_input(note.get("subject", {}).get("title", ""))
                tasks.append({
                    "type": "notification",
                    "id": f"note_{note.get('id')}",
                    "title": title,
                    "body": "",
                    "impact": 1.5,
                    "risk": 0.2,
                    "url": note.get("url", "")
                })
    except Exception as e:
        logger.debug(f"GitHub notifications fetch failed: {e}")
    return tasks


def fetch_pull_requests() -> List[Dict]:
    tasks = []
    if not GITHUB_AVAILABLE:
        return tasks
    try:
        token = os.getenv("GITHUB_TOKEN")
        repo = os.getenv("REPO")
        if not token or not repo:
            return tasks
        g = Github(token)
        r = g.get_repo(repo)
        for pr in list(r.get_pulls(state="open"))[:12]:
            tasks.append({
                "type": "pr_review",
                "id": f"pr_{pr.number}",
                "title": sanitize_input(f"Review PR #{pr.number}: {pr.title}"),
                "body": sanitize_input((pr.body or "")[:2000]),
                "impact": 1.3,
                "risk": 0.15,
                "url": pr.html_url,
                "pr_number": pr.number
            })
    except Exception as e:
        logger.debug(f"PR fetch failed: {e}")
    return tasks


def scan_code_todos() -> List[Dict]:
    tasks = []
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.')]
        for f in files:
            if not f.endswith(('.py', '.js', '.ts', '.tsx', '.md', '.json', '.yaml', '.yml', '.cjs', '.mjs')):
                continue
            path = os.path.join(root, f)
            try:
                with open(path, 'r', errors='ignore') as file:
                    content = file.read()
                for m in re.finditer(r'(TODO|FIXME|XXX|HACK):?\s*(.+?)(?:\n|$)', content):
                    match_text = m.group(0).lower()
                    impact = 2.2 if any(k in match_text for k in ("security", "bug", "critical", "fix", "broken")) else 1.6
                    tasks.append({
                        "type": "todo",
                        "title": m.group(0).strip()[:200],
                        "path": path,
                        "impact": impact,
                        "risk": 0.12
                    })
            except Exception as e:
                logger.debug(f"Scan error {path}: {e}")
    return tasks


def scan_tasks() -> List[Dict]:
    tasks = []
    tasks.extend(scan_lockfile_gaps())
    tasks.extend(scan_code_todos())
    tasks.extend(fetch_github_issues())
    tasks.extend(fetch_github_notifications())
    tasks.extend(fetch_pull_requests())
    tasks.extend(scan_ci_gaps())
    return tasks


def decide_tasks(tasks: List[Dict], profile: AgentProfile, limit: int = MAX_TASKS_PER_RUN) -> List[Dict]:
    """v4.3: return top-N prioritized tasks for multi-problem solving."""
    if not tasks:
        return []
    type_boosts = {
        "issue": 2.0,
        "lockfile": 1.95,
        "ci_gap": 1.7,
        "pr_review": 1.3,
        "security": 1.6,
        "todo": 1.15,
        "docs": 1.25,
        "notification": 1.0,
        "agent_improvement": 1.2,
    }
    for task in tasks:
        base = task.get("impact", 1.0) / (1 + task.get("risk", 0.5))
        task["priority"] = base * type_boosts.get(task.get("type", ""), 1.0)
    ranked = sorted(tasks, key=lambda t: t.get("priority", 0), reverse=True)
    # Deduplicate by id/title
    seen = set()
    out = []
    for t in ranked:
        key = t.get("id") or t.get("title", "")
        if key in seen:
            continue
        seen.add(key)
        out.append(t)
        if len(out) >= limit:
            break
    return out


# ==================== GIT OPERATIONS ====================

def merge_merged_branches(branch: str = "main") -> Dict:
    result = {"merged": [], "deleted": [], "error": ""}
    try:
        output = os.popen(f"git branch --merged {branch} | grep -v '\\*\\|main\\|master'").read()
        for b in output.strip().split('\n'):
            b = b.strip()
            if b:
                os.system(f"git branch -d {b} 2>/dev/null")
                result["merged"].append(b)
                result["deleted"].append(b)
        os.system("git remote prune origin 2>/dev/null || true")
    except Exception as e:
        result["error"] = str(e)
    return result


def sync_with_main() -> bool:
    try:
        os.system("git fetch origin && git merge origin/main -m 'Sync with main DEPTH:0' || true")
        return True
    except Exception:
        return False


def get_current_branch() -> str:
    try:
        return os.popen('git branch --show-current').read().strip() or "main"
    except Exception:
        return "main"


# ==================== TOOL EXECUTION ====================

def exec_tool(action: str, args: Dict = None, profile: AgentProfile = None) -> Dict:
    result = {"success": False, "output": "", "error": ""}
    if not args:
        args = {}
    try:
        if action == "read_file":
            path = args.get("path", "")
            if not os.path.exists(path):
                result["error"] = f"File not found: {path}"
                return result
            with open(path, 'r', errors='ignore') as f:
                result = {"success": True, "output": f.read()}
        elif action == "edit_file":
            path = args.get("path", "")
            content = args.get("content", "")
            if ".." in path or path.startswith("/"):
                if profile:
                    profile.record_security_event("high_risk")
                result["error"] = "Blocked: Invalid path"
                return result
            parent = os.path.dirname(path)
            if parent and not os.path.exists(parent):
                os.makedirs(parent, exist_ok=True)
            with open(path, 'w') as f:
                f.write(content)
            result = {"success": True, "output": f"Updated {path}"}
        elif action == "run_command":
            cmd = args.get("cmd", "")
            if is_high_risk(cmd):
                cat = get_risk_category(cmd)
                if profile:
                    profile.record_security_event("high_risk")
                result["error"] = f"Blocked: High-risk command ({cat})"
                return result
            result = {"success": True, "output": os.popen(cmd).read()}
        elif action == "create_branch":
            branch = args.get("branch", f"auto-fix-{int(time.time())}")
            branch = re.sub(r'[^a-zA-Z0-9_-]', '-', branch)
            os.system(f"git checkout -b {branch} 2>/dev/null || true")
            result = {"success": True, "output": f"Branch: {branch}"}
        elif action == "commit":
            message = re.sub(r'[<>]', '', args.get("message", "Auto"))
            depth = args.get("depth", 0)
            os.system(f"git add -A && git commit -m '{message} DEPTH:{depth}' || true")
            result = {"success": True, "output": "Committed"}
        elif action == "push":
            branch = args.get("branch", "")
            if branch:
                os.system(f"git push origin {branch} 2>/dev/null || true")
            result = {"success": True, "output": "Pushed"}
        elif action == "create_pr":
            if GITHUB_AVAILABLE:
                token = os.getenv("GITHUB_TOKEN")
                repo = os.getenv("REPO")
                if token and repo:
                    g = Github(token)
                    r = g.get_repo(repo)
                    pr = r.create_pull(
                        title=args.get("title", "Auto PR"),
                        body=args.get("body", "Automated changes"),
                        head=args.get("head", get_current_branch()),
                        base="main",
                        draft=True
                    )
                    result = {"success": True, "output": f"PR #{pr.number}", "pr_url": pr.html_url}
            else:
                result = {"success": False, "error": "GitHub not available"}
        elif action == "merge_branches":
            result = merge_merged_branches(args.get("branch", "main"))
            remote = cleanup_remote_auto_fix_branches(profile)
            result["remote_deleted"] = remote.get("deleted", [])
        elif action == "cleanup_remote":
            result = cleanup_remote_auto_fix_branches(profile)
            result["success"] = True
        elif action == "close_stale_prs":
            result = close_stale_draft_prs(profile)
            result["success"] = True
        elif action == "generate_lockfile":
            result = try_generate_lockfile(args.get("project_dir", "."), profile)
        elif action == "generate_python_req":
            result = try_generate_python_requirements(args.get("project_dir", "."), profile)
        elif action == "sync":
            result = {"success": sync_with_main(), "output": "Synced with main"}
        else:
            result["error"] = f"Unknown action: {action}"
    except Exception as e:
        result["error"] = str(e)
        if profile:
            profile.record_error()
    return result


def run_self_audit(profile: AgentProfile) -> List[Dict]:
    audit_tasks = []
    for root, dirs, files in os.walk('.github'):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for f in files:
            if f.endswith('.py'):
                path = os.path.join(root, f)
                try:
                    with open(path, 'r', errors='ignore') as file:
                        content = file.read()
                        if 'TODO' in content or 'FIXME' in content:
                            audit_tasks.append({
                                "type": "agent_improvement",
                                "title": f"Improve {f}",
                                "path": path,
                                "impact": 2.0,
                                "risk": 0.3
                            })
                except Exception as e:
                    logger.debug(f"Audit scan error: {e}")
    return audit_tasks


def evolve_agent_directives(profile: AgentProfile):
    directives = []
    if profile.data.get("errors", 0) > profile.data.get("runs", 1) * 0.3:
        directives.append("High error rate - reduce mutation aggressiveness")
    if profile.data.get("avg_latency", 0) > 10:
        directives.append("High latency - prioritize local providers (ollama)")
    if profile.data.get("security_events", 0) > 0:
        directives.append("Security events detected - enhance guardrails")
    if profile.data.get("lockfiles_fixed", 0) == 0 and profile.data.get("runs", 0) > 2:
        directives.append("Prioritize lockfile gaps for reproducible builds")
    if profile.data.get("problems_solved", 0) < profile.data.get("tasks_attempted", 0) * 0.3:
        directives.append("Low solve rate - prefer smaller, safer edits")
    if profile.data.get("provider_stats"):
        best_provider = min(
            profile.data["provider_stats"].items(),
            key=lambda x: x[1].get("latency", float('inf'))
        )[0]
        directives.append(f"Prefer {best_provider} (lowest latency)")
    profile.data["directives"] = directives
    return directives


def _strip_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r'^```[a-zA-Z0-9]*\n?', '', cleaned)
        cleaned = re.sub(r'\n?```$', '', cleaned)
    return cleaned


def execute_one_task(task: Dict, profile: AgentProfile, depth: int) -> bool:
    """Execute a single task; return True if a PR/commit was produced."""
    task_type = task.get("type", "unknown")
    branch_name = f"auto-fix-{int(time.time())}-{task.get('id', 'x')[:12]}"
    branch_name = re.sub(r'[^a-zA-Z0-9_-]', '-', branch_name)[:60]
    exec_tool("create_branch", {"branch": branch_name}, profile)
    sync_with_main()
    profile.data["tasks_attempted"] = profile.data.get("tasks_attempted", 0) + 1
    solved = False

    if task_type == "lockfile":
        proj = task.get("project_dir", ".")
        if task.get("python"):
            gen = try_generate_python_requirements(proj, profile)
            msg = f"chore: add requirements.txt for {proj}"
            title = f"🤖 Python deps: {proj}"
        else:
            gen = try_generate_lockfile(proj, profile)
            msg = f"chore: add lockfile for {proj}"
            title = f"🤖 Lockfile: {task.get('title', '')[:90]}"
        if gen.get("success"):
            exec_tool("commit", {"message": msg, "depth": depth + 1}, profile)
            exec_tool("push", {"branch": branch_name}, profile)
            exec_tool("create_pr", {
                "title": title,
                "body": (
                    f"Autonomous dependency lock for `{proj}`.\n\n"
                    f"Ensures reproducible installs.\n\n"
                    f"Source: {task.get('title')}\n\n"
                    f"Output:\n```\n{gen.get('output', '')[:600]}\n```"
                ),
                "head": branch_name
            }, profile)
            solved = True
        else:
            note_path = os.path.join(proj, "LOCKFILE_NEEDED.md") if proj != "." else "LOCKFILE_NEEDED.md"
            note = (
                f"# Lockfile / requirements needed for `{proj}`\n\n"
                f"Agent could not generate lockfile in CI (often no registry network).\n\n"
                f"Run locally:\n```bash\ncd {proj}\nnpm install   # or pip freeze > requirements.txt\ngit add -A\n```\n\n"
                f"Error:\n```\n{gen.get('error', '')}\n{gen.get('output', '')[:800]}\n```\n"
            )
            exec_tool("edit_file", {"path": note_path, "content": note}, profile)
            exec_tool("commit", {"message": f"docs: lockfile needed for {proj}", "depth": depth + 1}, profile)
            exec_tool("push", {"branch": branch_name}, profile)
            exec_tool("create_pr", {
                "title": f"🤖 Docs: lockfile needed — {proj}",
                "body": task.get("body", ""),
                "head": branch_name
            }, profile)
            solved = True  # documented the gap
    elif task_type in ("docs", "ci_gap", "agent_improvement"):
        path = task.get("path", "")
        prompt = (
            f"Implement this improvement fully. If creating/editing a file, output ONLY the full file content.\n"
            f"Task: {task.get('title')}\n\n{task.get('body', '')[:1500]}"
        )
        if path and os.path.isfile(path):
            try:
                with open(path, 'r', errors='ignore') as f:
                    prompt += f"\n\nCurrent content of {path}:\n{f.read()[:4000]}"
            except Exception:
                pass
        response = call_llm(prompt, profile=profile)
        if response and "[No LLM]" not in response and len(response) > 40:
            cleaned = _strip_fences(response)
            if path:
                exec_tool("edit_file", {"path": path, "content": cleaned}, profile)
            exec_tool("commit", {
                "message": f"Auto: {task.get('title', '')[:80]}",
                "depth": depth + 1
            }, profile)
            exec_tool("push", {"branch": branch_name}, profile)
            exec_tool("create_pr", {
                "title": f"🤖 {task.get('title', 'Improvement')[:100]}",
                "body": f"Autonomous development task.\n\n{task.get('body', '')[:500]}",
                "head": branch_name
            }, profile)
            solved = True
    else:
        # issues, todos, pr_review, notifications
        if task_type == "pr_review":
            prompt = (
                f"Review this PR and propose concrete code fixes if needed. "
                f"If fixing a file, output the FULL fixed file content only.\n"
                f"{task.get('title')}\n\n{task.get('body', '')[:1200]}"
            )
        elif task_type == "issue":
            prompt = (
                f"Solve this GitHub issue completely. Prefer minimal, correct changes. "
                f"When editing code, provide the FULL fixed file content.\n"
                f"Issue: {task.get('title')}\n\n{task.get('body', '')[:1800]}"
            )
        else:
            prompt = (
                f"Improve or fix the following. If changing a file, return full file content.\n"
                f"{task.get('title')}\n\n{task.get('body', '')[:800]}"
            )

        full_prompt = prompt
        if task.get("path") and os.path.isfile(task["path"]):
            try:
                with open(task["path"], 'r', errors='ignore') as f:
                    file_content = f.read()
                full_prompt = f"{prompt}\n\nFile: {task['path']}\n\nCurrent content:\n{file_content[:4500]}"
            except Exception:
                pass

        response = call_llm(full_prompt, profile=profile)

        if response and "[No LLM]" not in response and "error" not in response.lower()[:40]:
            if task.get("path") and len(response) > 80:
                cleaned = _strip_fences(response)
                exec_tool("edit_file", {"path": task["path"], "content": cleaned}, profile)
            exec_tool("commit", {
                "message": f"Auto-fix: {task.get('title', '')[:80]}",
                "depth": depth + 1
            }, profile)
            exec_tool("push", {"branch": branch_name}, profile)
            exec_tool("create_pr", {
                "title": f"🤖 {task.get('title', 'Autonomous improvement')[:100]}",
                "body": f"Autonomous improvement for: {task.get('title')}\n\nSource: {task.get('url', 'code scan')}",
                "head": branch_name
            }, profile)
            solved = True

    if solved:
        profile.data["problems_solved"] = profile.data.get("problems_solved", 0) + 1
    # Return to main for next task
    os.system("git checkout main 2>/dev/null || true")
    return solved


def main():
    profile = AgentProfile()
    depth = get_depth()
    logger.info(f"Starting agent v4.3 - Depth: {depth} (multi-task solve-all + lockfiles)")

    if depth >= MAX_DEPTH:
        logger.info("Max depth reached - exiting")
        return

    # 1) Hygiene first
    try:
        local = merge_merged_branches()
        if local.get("deleted"):
            logger.info(f"Local branches cleaned: {local['deleted']}")
        remote = cleanup_remote_auto_fix_branches(profile)
        if remote.get("deleted"):
            logger.info(f"Remote auto-fix deleted: {remote['deleted']}")
        closed = close_stale_draft_prs(profile)
        if closed.get("closed"):
            logger.info(f"Stale PRs closed: {closed['closed']}")
    except Exception as e:
        logger.debug(f"Hygiene skipped: {e}")

    # 2) Scan everything
    tasks = scan_tasks()
    tasks.extend(run_self_audit(profile))
    if len([t for t in tasks if t.get("type") in ("issue", "lockfile", "todo")]) < 2:
        tasks.extend(scan_proactive_improvements())

    selected = decide_tasks(tasks, profile, limit=MAX_TASKS_PER_RUN)
    if not selected:
        logger.info("No tasks found - hygiene complete, agent idle")
    else:
        logger.info(f"Selected {len(selected)} task(s) for this cycle")
        for task in selected:
            logger.info(f"Executing: {task.get('title')} (type={task.get('type')}, prio={task.get('priority', 0):.2f})")
            try:
                execute_one_task(task, profile, depth)
            except Exception as e:
                logger.warning(f"Task failed: {e}")
                profile.record_error()

    evolve_agent_directives(profile)
    profile.data["runs"] = profile.data.get("runs", 0) + 1
    profile.data["version"] = "4.3"
    profile.save()
    logger.info(
        f"Agent v4.3 complete (runs={profile.data['runs']}, "
        f"branches_deleted={profile.data.get('branches_deleted', 0)}, "
        f"prs_closed={profile.data.get('prs_closed', 0)}, "
        f"lockfiles_fixed={profile.data.get('lockfiles_fixed', 0)}, "
        f"tasks_attempted={profile.data.get('tasks_attempted', 0)}, "
        f"problems_solved={profile.data.get('problems_solved', 0)})"
    )


if __name__ == "__main__":
    main()
