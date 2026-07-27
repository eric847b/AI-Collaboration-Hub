#!/usr/bin/env python3
"""nexus-core v1.8 - agent owns GitHub, free stack, zero user time
Live health + JSON scope + quiet autonomous executor.
This file is the permanent successor.
"""
import json, sys, datetime, subprocess, os
from pathlib import Path

CORE = Path(__file__).resolve().parent
ROOT = CORE.parents[1]
REG  = CORE / "registry.json"
NEXT = CORE / "NEXT_CATALYST.md"
SCOPE_JSON = CORE / "scope.json"
AGENT = ROOT / "autonomous-github-agent" / ".github" / "scripts" / "agent.py"

def load():
    with open(REG) as f: return json.load(f)

def exists(name):
    return (ROOT / name).exists() or (ROOT / "AI-Collaboration-Hub" / name).exists()

def health_probe(m):
    name = m["name"]
    if not exists(name): return "MISSING"
    candidates = [
        ROOT / name / "README.md",
        ROOT / name / "package.json",
        ROOT / name / "requirements.txt",
        ROOT / name / "pyproject.toml",
        ROOT / name / "CMakeLists.txt",
        ROOT / "AI-Collaboration-Hub" / name / "README.md",
    ]
    return "HEALTHY" if any(c.exists() for c in candidates) else "PRESENT"

def graph(r):
    print("graph TD")
    for m in r["modules"]:
        print(f'  {m["name"]}[{m["name"]}|{m["role"]}]')
        for d in m.get("deps", []):
            if d != "*": print(f'  {d} --> {m["name"]}')

def build_scope_data():
    r = load()
    now = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%MZ")
    modules = []
    unhealthy = []
    for m in r["modules"]:
        status = health_probe(m)
        if status != "HEALTHY": unhealthy.append(m["name"])
        modules.append({
            "name": m["name"], "role": m["role"], "status": status,
            "entrypoint": m.get("entrypoint", ""), "deps": m.get("deps", [])
        })
    return {
        "system": "nexus-core", "version": r["version"], "generated": now,
        "modules": modules, "unhealthy": unhealthy, "rules": r["rules"],
        "canonical": "AI-Collaboration-Hub/nexus-core",
        "executor": "autonomous-github-agent (quiet, owns all GitHub)",
        "cost": "zero", "user_time": "zero"
    }

def scope(json_only=False):
    data = build_scope_data()
    SCOPE_JSON.write_text(json.dumps(data, indent=2))
    if json_only:
        print(json.dumps(data)); return data
    print(f"# nexus-core SCOPE  v{data['version']}  {data['generated']}")
    print(f"modules: {len(data['modules'])} | free stack | agent owns GitHub")
    for m in data["modules"]:
        print(f"- [{m['status']:8}] {m['name']:30} {m['role']}")
    print("\n## Rules")
    for rule in data["rules"]: print(f"  ✓ {rule}")
    prompt = (
        "Run nexus-core improve, then apply the top proposed change. "
        "Stronger pattern found? Replace orchestrator and bump version. "
        "Always finish with scope + update NEXT_CATALYST.md. "
        "Agent owns all GitHub responsibilities and notifications. Free stack. Zero user time."
    )
    NEXT.write_text(f"# NEXT CATALYST\n\n{prompt}\n\nGenerated: {data['generated']}\nVersion: {data['version']}\n")
    print("\n## Next Catalyst (written to NEXT_CATALYST.md)")
    print("```")
    print(prompt)
    print("```")
    print(f"\n## Machine scope → {SCOPE_JSON.name}")
    if data["unhealthy"]:
        print(f"## Health note: {len(data['unhealthy'])} not fully HEALTHY")
    return data

def improve():
    print("# IMPROVE PROPOSALS (ordered by return)")
    print("1-5. [DONE] CI, health, canonical, quiet agent, JSON scope")
    print("6. [DONE] Agent owns notifications + all GitHub responsibilities (free stack)")
    print("7. Expand agent problem-solving skill set (local free tools only)")
    print("8. Auto-close or auto-triage issues/PRs that the agent has already handled")
    print("\nTop remaining: #7 (expand free problem-solving skills)")
    print("After any change: python orchestrator.py scope")

def run_agent():
    if not AGENT.exists():
        print("agent not found"); return
    os.environ["QUIET"] = "1"
    os.environ["SUPPRESS_NOTIFICATIONS"] = "1"
    os.environ["AGENT_OWNS_GITHUB"] = "1"
    print("Launching autonomous-github-agent (owns all GitHub, quiet, free)...")
    subprocess.run([sys.executable, str(AGENT)], cwd=str(ROOT))

def check():
    r = load()
    print(f"nexus-core v{r['version']} | free | agent-owns-github | json-scope")
    for rule in r["rules"]: print(f"  ✓ {rule}")

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "scope"
    if cmd == "graph": graph(load())
    elif cmd == "improve": improve()
    elif cmd == "check": check()
    elif cmd == "agent": run_agent()
    elif cmd == "json": scope(json_only=True)
    else: scope()
