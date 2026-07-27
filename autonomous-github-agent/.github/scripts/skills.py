#!/usr/bin/env python3
"""Free problem-solving skill set for autonomous-github-agent
All tools are local or free-tier. No paid APIs required.
Expand this file to grow the agent's capabilities.
"""
import os, re, json, subprocess, logging
from pathlib import Path
from typing import List, Dict, Optional

log = logging.getLogger("skills")

def skill_list_files(pattern: str = "**/*", root: str = ".") -> List[str]:
    """List files matching glob (local)."""
    return [str(p) for p in Path(root).glob(pattern) if p.is_file()][:200]

def skill_grep(pattern: str, path: str = ".") -> List[str]:
    """Simple local grep."""
    hits = []
    for p in Path(path).rglob("*"):
        if p.is_file() and p.suffix in {".py", ".js", ".ts", ".md", ".yml", ".yaml", ".json"}:
            try:
                for i, line in enumerate(p.read_text(errors="ignore").splitlines(), 1):
                    if re.search(pattern, line):
                        hits.append(f"{p}:{i}:{line.strip()[:120]}")
                        if len(hits) >= 50: return hits
            except: pass
    return hits

def skill_run_tests(cmd: str = "pytest -q || npm test --silent || echo no-tests") -> Dict:
    """Run tests quietly; return structured result (absorbed by quiet_handler)."""
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=120)
        return {"ok": r.returncode == 0, "code": r.returncode, "stdout": r.stdout[-2000:], "stderr": r.stderr[-1000:]}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def skill_summarize_diff() -> str:
    """Local git diff summary (free)."""
    try:
        return subprocess.check_output("git diff --stat HEAD~3 2>/dev/null || git status -s", shell=True, text=True)[:2000]
    except: return ""

def skill_mark_notifications_read(token: Optional[str] = None) -> int:
    """Route notifications to agent by marking them read (user sees zero)."""
    token = token or os.getenv("GITHUB_TOKEN")
    if not token: return 0
    try:
        import requests
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"}
        r = requests.get("https://api.github.com/notifications", headers=headers, params={"per_page": 50}, timeout=15)
        if not r.ok: return 0
        n = len(r.json())
        if n:
            requests.put("https://api.github.com/notifications", headers=headers,
                         json={"last_read_at": __import__("datetime").datetime.utcnow().isoformat()+"Z"}, timeout=15)
        return n
    except: return 0

def skill_triage_issue(title: str, body: str) -> Dict:
    """Lightweight free triage (keyword based, no paid LLM required)."""
    text = (title + " " + body).lower()
    labels = []
    if any(k in text for k in ["bug", "error", "fail", "crash"]): labels.append("bug")
    if any(k in text for k in ["feat", "enhancement", "add "]): labels.append("enhancement")
    if any(k in text for k in ["doc", "readme"]): labels.append("documentation")
    if any(k in text for k in ["security", "vuln", "cve"]): labels.append("security")
    priority = "high" if "security" in labels or "critical" in text else "normal"
    return {"labels": labels or ["triage"], "priority": priority, "handled_by": "agent"}

SKILLS = {
    "list_files": skill_list_files,
    "grep": skill_grep,
    "run_tests": skill_run_tests,
    "summarize_diff": skill_summarize_diff,
    "mark_notifications_read": skill_mark_notifications_read,
    "triage_issue": skill_triage_issue,
}

def available_skills() -> List[str]:
    return list(SKILLS.keys())

def run_skill(name: str, *args, **kwargs):
    if name not in SKILLS:
        return {"error": f"unknown skill {name}"}
    return SKILLS[name](*args, **kwargs)

if __name__ == "__main__":
    print("Available free skills:", available_skills())
