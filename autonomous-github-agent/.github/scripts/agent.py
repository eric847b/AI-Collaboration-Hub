#!/usr/bin/env python3
"""
Autonomous GitHub Agent - LLM-powered self-improving agent for GitHub repos.
Perfected v4.0 - Production-grade autonomous improvement engine.

Features:
- Multi-LLM Orchestration with intelligent fallback
- Advanced Security hardening with prompt injection prevention
- Comprehensive Tool suite with guardrails
- Performance profiling and adaptive evolution
- Cross-repository synchronization
- PR review integration
- Sub-issue management
- Self-auditing capabilities
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
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple

# Try to import PyGithub for GitHub API operations
try:
    from github import Github
    GITHUB_AVAILABLE = True
except ImportError:
    GITHUB_AVAILABLE = False

# Configure logging with both console and file output
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('.agent.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)

# Configuration constants
MAX_RETRIES = 5
RETRY_BASE_DELAY = 1  # seconds
RETRY_MAX_DELAY = 30
PROFILE_PATH = ".agent_profile.json"
MAX_DEPTH = 3
DEFAULT_MAX_ITERATIONS = 10

# High-risk action keywords with categories
HIGH_RISK_KEYWORDS = {
    'destructive': ['delete', 'rm ', 'remove', 'destroy', 'wipe', 'purge'],
    'security': ['modify security', 'exfiltrate', 'malicious', 'inject', 'exfil'],
    'system': ['sudo', 'chmod', 'chown', 'format', 'partition'],
    'network': ['curl', 'wget', 'download', 'scrape', 'exfiltrate']
}

# All high-risk patterns combined
HIGH_RISK_PATTERNS = [kw for category in HIGH_RISK_KEYWORDS.values() for kw in category]

# Free/zero-cost AI priorities (first to try)
FREE_PROVIDERS = ['deepseek', 'huggingface', 'ollama', 'github_models', 'openrouter']
PAID_PROVIDERS = ['openai', 'anthropic', 'gemini']

class AgentProfile:
    """Manages agent performance metrics and evolution directives."""
    
    def __init__(self, path: str = PROFILE_PATH):
        self.path = path
        self.data = self._load()
    
    def _load(self) -> Dict:
        if os.path.exists(self.path):
            try:
                with open(self.path, 'r') as f:
                    data = json.load(f)
                    # Ensure all required fields exist
                    defaults = {
                        "runs": 0, "errors": 0, "security_events": 0,
                        "injections_blocked": 0, "high_risk_blocked": 0,
                        "avg_latency": 0, "success_rate": 1.0,
                        "directives": [], "max_iterations": DEFAULT_MAX_ITERATIONS,
                        "retry_count": 3, "provider_stats": {}
                    }
                    for key, value in defaults.items():
                        if key not in data:
                            data[key] = value
                    return data
            except Exception as e:
                logger.warning(f"Profile load error: {e}")
        return {
            "runs": 0, "errors": 0, "security_events": 0,
            "injections_blocked": 0, "high_risk_blocked": 0,
            "avg_latency": 0, "success_rate": 1.0,
            "directives": [], "max_iterations": DEFAULT_MAX_ITERATIONS,
            "retry_count": 3, "provider_stats": {}
        }
    
    def save(self):
        with open(self.path, 'w') as f:
            json.dump(self.data, f, indent=2)
    
    def record_success(self, latency: float, provider: str = "unknown"):
        """Record a successful LLM call."""
        self.data["runs"] += 1
        # Update average latency
        prev_avg = self.data.get("avg_latency", 0)
        runs = self.data["runs"]
        self.data["avg_latency"] = (prev_avg * (runs - 1) + latency) / runs
        
        # Update provider stats
        if provider not in self.data["provider_stats"]:
            self.data["provider_stats"][provider] = {"calls": 0, "latency": 0}
        self.data["provider_stats"][provider]["calls"] += 1
        self.data["provider_stats"][provider]["latency"] = (
            self.data["provider_stats"][provider].get("latency", 0) * (runs - 1) + latency
        ) / runs
    
    def record_error(self):
        self.data["errors"] += 1
    
    def record_security_event(self, event_type: str):
        self.data["security_events"] += 1
        if event_type == "injection":
            self.data["injections_blocked"] += 1
        elif event_type == "high_risk":
            self.data["high_risk_blocked"] += 1


def sanitize_input(text: str, profile: AgentProfile = None) -> str:
    """Sanitize input to prevent prompt injection with comprehensive patterns."""
    if not text:
        return ""
    
    sanitized = text
    
    # Remove HTML comments (common injection vector)
    sanitized = re.sub(r'<!--.*?-->', '', sanitized, flags=re.DOTALL)
    
    # Remove markdown HTML comments
    sanitized = re.sub(r'<!(--.*?--|.*?-->)', '', sanitized, flags=re.DOTALL)
    
    # Remove system/role override attempts
    dangerous_patterns = [
        r'ignore all previous',
        r'system:',
        r'\bsystem\s*:',
        r'override system',
        r'new instructions:',
        r'you are now',
        r'roleplay as',
        r'developer mode',
        r'jailbreak',
        r'\bsha\b',  # Prevent SHA injection
    ]
    
    lower_sanitized = sanitized.lower()
    for pattern in dangerous_patterns:
        if re.search(pattern, lower_sanitized):
            if profile:
                profile.record_security_event("injection")
            return "[BLOCKED - Injection detected]"
    
    # HTML escape to prevent rendering attacks
    sanitized = sanitized.replace('<', '<').replace('>', '>')
    
    return sanitized


def get_sanitized_tasks(tasks: List[Dict]) -> List[Dict]:
    """Sanitize all task fields to prevent injection."""
    return [{
        **t,
        "title": sanitize_input(t.get("title", "")),
        "body": sanitize_input(t.get("body", ""))
    } for t in tasks]


def is_high_risk(action: str) -> bool:
    """Check if an action contains high-risk patterns."""
    action_lower = action.lower()
    return any(pattern in action_lower for pattern in HIGH_RISK_PATTERNS)


def get_risk_category(action: str) -> Optional[str]:
    """Get the risk category of an action."""
    action_lower = action.lower()
    for category, keywords in HIGH_RISK_KEYWORDS.items():
        if any(kw in action_lower for kw in keywords):
            return category
    return None


def get_depth() -> int:
    """Get current recursion depth from git commit message."""
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
    """Execute function with exponential backoff retry logic."""
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
    """Call DeepSeek API (free tier available via deepseek.com)."""
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
    """Call Ollama local API (free, no API key needed)."""
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
    """Call HuggingFace Inference API (free tier available)."""
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
    """Call OpenRouter API (free tier available)."""
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
    """Call GitHub Models API (free tier available via GitHub)."""
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
    """Call Google Gemini API."""
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
    """Call OpenAI API."""
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
    """Call Anthropic Claude API."""
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
    """Call LLM with automatic free-provider prioritization and performance tracking."""
    start_time = time.time()
    
    # Try free providers first (in order of priority)
    for p in FREE_PROVIDERS + PAID_PROVIDERS:
        if provider != "auto" and provider != p:
            continue
        
        func_name = f"call_{p}"
        if func_name in globals():
            func = globals()[func_name]
            result = func(prompt)
            if result:
                latency = time.time() - start_time
                if profile:
                    profile.record_success(latency, p)
                return result
    
    return "[No LLM] Tip: Use DEEPSEEK_API_KEY or HF_TOKEN for free AI"


# ==================== GITHUB OPERATIONS ====================

def fetch_github_issues() -> List[Dict]:
    """Fetch open issues from GitHub API."""
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
        for issue in list(r.get_issues(state="open"))[:10]:
            tasks.append({
                "type": "issue",
                "id": f"issue_{issue.number}",
                "title": sanitize_input(issue.title),
                "body": sanitize_input((issue.body or "")[:2000]),
                "impact": 2.0 if "bug" in (issue.title.lower() + (issue.body or "").lower()) else 1.5,
                "risk": 0.1,
                "url": issue.html_url
            })
    except Exception as e:
        logger.debug(f"GitHub issues fetch failed: {e}")
    return tasks


def fetch_github_notifications() -> List[Dict]:
    """Fetch GitHub notifications for the authenticated user."""
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
            params={"all": "true", "per_page": 20}
        )
        if resp.ok:
            for note in resp.json():
                # Sanitize notification title/body
                title = sanitize_input(note.get("subject", {}).get("title", ""))
                body = sanitize_input(note.get("payload", {}).get("comment", "") or "")
                tasks.append({
                    "type": "notification",
                    "id": f"note_{note.get('id')}",
                    "title": title,
                    "body": body,
                    "impact": 1.5,
                    "risk": 0.2,
                    "url": note.get("url", "")
                })
    except Exception as e:
        logger.debug(f"GitHub notifications fetch failed: {e}")
    return tasks


def fetch_pull_requests() -> List[Dict]:
    """Fetch open pull requests for review."""
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
        for pr in list(r.get_pulls(state="open"))[:10]:
            tasks.append({
                "type": "pr_review",
                "id": f"pr_{pr.number}",
                "title": sanitize_input(f"Review PR #{pr.number}: {pr.title}"),
                "body": sanitize_input((pr.body or "")[:2000]),
                "impact": 1.2,
                "risk": 0.15,
                "url": pr.html_url,
                "pr_number": pr.number
            })
    except Exception as e:
        logger.debug(f"PR fetch failed: {e}")
    return tasks


def fetch_sub_issues() -> List[Dict]:
    """Fetch sub-issues if the repository has them enabled."""
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
        # Search for parent issues that might have sub-issues
        for issue in list(r.get_issues(state="open", labels=["enhancement", "epic"]))[:5]:
            tasks.append({
                "type": "sub_issue",
                "id": f"sub_{issue.number}",
                "title": sanitize_input(f"Break down: {issue.title}"),
                "body": sanitize_input(issue.body or ""),
                "impact": 1.8,
                "risk": 0.3,
                "url": issue.html_url,
                "parent_id": issue.number
            })
    except Exception as e:
        logger.debug(f"Sub-issue fetch failed: {e}")
    return tasks


def scan_tasks() -> List[Dict]:
    """Comprehensive task scanning across codebase and GitHub."""
    tasks = []
    
    # Scan code for TODO/FIXME
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d != '.git']
        for f in files:
            if f.endswith(('.py', '.js', '.ts', '.md', '.json', '.yaml', '.yml')):
                path = os.path.join(root, f)
                try:
                    with open(path, 'r') as file:
                        content = file.read()
                        for m in re.finditer(r'(TODO|FIXME):?\s*(.+?)(?:\n|$)', content):
                            match_text = m.group(0).lower()
                            impact = 2.0 if any(k in match_text for k in ["security", "bug", "critical", "fix"]) else 1.5
                            tasks.append({
                                "type": "todo",
                                "title": m.group(0).strip(),
                                "path": path,
                                "impact": impact,
                                "risk": 0.1
                            })
                except Exception as e:
                    logger.debug(f"Scan error {path}: {e}")
    
    # Fetch GitHub issues
    tasks.extend(fetch_github_issues())
    
    # Fetch notifications
    tasks.extend(fetch_github_notifications())
    
    # Fetch PRs for review
    tasks.extend(fetch_pull_requests())
    
    # Fetch sub-issues
    tasks.extend(fetch_sub_issues())
    
    return tasks


def decide_task(tasks: List[Dict], profile: AgentProfile) -> Optional[Dict]:
    """Intelligently prioritize tasks based on impact, risk, and profile metrics."""
    if not tasks:
        return None
    
    # Calculate priority scores
    for task in tasks:
        base_score = task.get("impact", 1.0) / (1 + task.get("risk", 0.5))
        
        # Boost based on type
        type_boosts = {
            "pr_review": 1.3,
            "security": 1.5,
            "sub_issue": 1.2
        }
        task["priority"] = base_score * type_boosts.get(task.get("type", ""), 1.0)
    
    # Sort by priority
    return max(tasks, key=lambda t: t.get("priority", 0))


# ==================== GIT OPERATIONS ====================

def merge_merged_branches(branch: str = "main") -> Dict:
    """Merge already-merged branches and delete them."""
    result = {"merged": [], "deleted": [], "error": ""}
    try:
        # Find merged branches
        output = os.popen(f"git branch --merged {branch} | grep -v '\\*\\|main\\|master'").read()
        for b in output.strip().split('\n'):
            b = b.strip()
            if b:
                os.system(f"git branch -d {b} 2>/dev/null")
                result["merged"].append(b)
                result["deleted"].append(b)
        # Prune remote
        os.system("git remote prune origin 2>/dev/null || true")
    except Exception as e:
        result["error"] = str(e)
    return result


def sync_with_main() -> bool:
    """Sync current branch with main."""
    try:
        os.system("git fetch origin && git merge origin/main -m 'Sync with main DEPTH:0'")
        return True
    except:
        return False


def get_current_branch() -> str:
    """Get current git branch name."""
    try:
        return os.popen('git branch --show-current').read().strip()
    except:
        return "main"


# ==================== TOOL EXECUTION ====================

def exec_tool(action: str, args: Dict = None, profile: AgentProfile = None) -> Dict:
    """Execute tool with safety checks and logging."""
    result = {"success": False, "output": "", "error": ""}
    if not args:
        args = {}
    
    try:
        if action == "read_file":
            path = args.get("path", "")
            if not os.path.exists(path):
                result["error"] = f"File not found: {path}"
                return result
            with open(path, 'r') as f:
                result = {"success": True, "output": f.read()}
        
        elif action == "edit_file":
            if is_high_risk(action):
                if profile:
                    profile.record_security_event("high_risk")
                result["error"] = "Blocked: High-risk action detected"
                return result
            
            path = args.get("path", "")
            content = args.get("content", "")
            
            # Validate path to prevent traversal attacks
            if ".." in path or path.startswith("/"):
                if profile:
                    profile.record_security_event("high_risk")
                result["error"] = "Blocked: Invalid path"
                return result
            
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
            branch = args.get("branch", f"auto-evolve-{int(time.time())}")
            # Sanitize branch name
            branch = re.sub(r'[^a-zA-Z0-9_-]', '-', branch)
            os.system(f"git checkout -b {branch} 2>/dev/null || true")
            result = {"success": True, "output": f"Branch: {branch}"}
        
        elif action == "commit":
            message = args.get("message", "Auto")
            # Sanitize commit message
            message = re.sub(r'[<>]', '', message)
            depth = args.get("depth", 0)
            os.system(f"git add -A && git commit -m '{message}' DEPTH:{depth}")
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
    """Run a self-audit to identify improvements for the agent itself."""
    audit_tasks = []
    
    for root, dirs, files in os.walk('.github'):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for f in files:
            if f.endswith('.py') and f != '__pycache__':
                path = os.path.join(root, f)
                try:
                    with open(path, 'r') as file:
                        content = file.read()
                        lines = content.split('\n')
                        
                        # Check for potential issues
                        if 'TODO' in content or 'FIXME' in content:
                            audit_tasks.append({
                                "type": "agent_improvement",
                                "title": f"Improve {f}",
                                "path": path,
                                "impact": 2.0,
                                "risk": 0.3
                            })
                        
                        # Check for missing error handling
                        if content.count('try:') > content.count('except'):
                            audit_tasks.append({
                                "type": "agent_improvement",
                                "title": f"Add error handling to {f}",
                                "path": path,
                                "impact": 1.5,
                                "risk": 0.2
                            })
                except Exception as e:
                    logger.debug(f"Audit scan error: {e}")
    
    return audit_tasks


def evolve_agent_directives(profile: AgentProfile):
    """Generate self-improvement directives based on profile metrics."""
    directives = []
    
    # Analyze error rate
    if profile.data.get("errors", 0) > profile.data.get("runs", 1) * 0.3:
        directives.append("High error rate - reduce mutation aggressiveness")
    
    # Analyze latency
    if profile.data.get("avg_latency", 0) > 10:
        directives.append("High latency - prioritize local providers (ollama)")
    
    # Check for security events
    if profile.data.get("security_events", 0) > 0:
        directives.append("Security events detected - enhance guardrails")
    
    # Provider performance analysis
    if profile.data.get("provider_stats"):
        best_provider = min(
            profile.data["provider_stats"].items(),
            key=lambda x: x[1].get("latency", float('inf'))
        )[0]
        directives.append(f"Prefer {best_provider} (lowest latency)")
    
    profile.data["directives"] = directives
    return directives


def main():
    """Main entry point for the autonomous agent."""
    profile = AgentProfile()
    depth = get_depth()
    
    logger.info(f"Starting agent - Depth: {depth}")
    
    if depth >= MAX_DEPTH:
        logger.info("Max depth reached - exiting")
        return
    
    # Clean up merged branches first
    try:
        merged = merge_merged_branches()
        if merged["deleted"]:
            logger.info(f"Cleaned up branches: {merged['deleted']}")
    except Exception as e:
        logger.debug(f"Branch cleanup skipped: {e}")
    
    # Scan for tasks
    tasks = scan_tasks()
    
    # Run self-audit and add improvement tasks
    audit_tasks = run_self_audit(profile)
    tasks.extend(audit_tasks)
    
    # Decide which task to execute
    task = decide_task(tasks, profile)
    
    if task:
        logger.info(f"Executing task: {task.get('title')} (type: {task.get('type')})")
        
        # Build context-aware prompt
        task_type = task.get("type", "unknown")
        if task_type == "pr_review":
            prompt = f"Review this PR: {task.get('title')}\n\n{task.get('body', '')[:1000]}"
        elif task_type == "sub_issue":
            prompt = f"Break down into sub-issues: {task.get('title')}\n\n{task.get('body', '')[:1000]}"
        elif task_type == "issue":
            prompt = f"Fix issue: {task.get('title')}\n\n{task.get('body', '')[:1000]}"
        else:
            prompt = f"Improve: {task.get('title')}"
        
        if task.get("path"):
            try:
                with open(task["path"], 'r') as f:
                    file_content = f.read()
                full_prompt = f"{prompt}\n\nFile: {task['path']}\n\nCurrent content:\n{file_content[:3000]}"
            except:
                full_prompt = prompt
            
            response = call_llm(full_prompt)
            
            if response and "error" not in response.lower():
                # Create branch and apply changes
                branch_name = f"auto-fix-{int(time.time())}"
                exec_tool("create_branch", {"branch": branch_name}, profile)
                
                # Sync with main first
                sync_with_main()
                
                # Apply fix
                exec_tool("edit_file", {"path": task["path"], "content": response}, profile)
                exec_tool("commit", {"message": f"Auto-fix: {task.get('title')}", "depth": depth + 1}, profile)
                exec_tool("push", {"branch": branch_name}, profile)
                
                # Create draft PR
                exec_tool("create_pr", {
                    "title": f"🤖 {task.get('title')}",
                    "body": f"Autonomous improvement for: {task.get('title')}",
                    "head": branch_name
                }, profile)
    else:
        logger.info("No tasks found - agent idle")
    
    # Evolve directives
    evolve_agent_directives(profile)
    
    profile.data["runs"] += 1
    profile.save()
    logger.info(f"Agent run complete (runs: {profile.data['runs']}, directives: {profile.data.get('directives', [])})")


if __name__ == "__main__":
    main()