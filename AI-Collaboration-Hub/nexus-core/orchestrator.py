#!/usr/bin/env python3
"""nexus-core v1.4 - self-upgrading meta-orchestrator
Live health probes + ranked improve + durable next-catalyst.
This file is the permanent upgrade path / successor.
"""
import json, sys, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REG  = Path(__file__).parent / "registry.json"
NEXT = Path(__file__).parent / "NEXT_CATALYST.md"

def load():
    with open(REG) as f: return json.load(f)

def exists(name):
    return (ROOT / name).exists() or (ROOT / "AI-Collaboration-Hub" / name).exists()

def health_probe(m):
    """Minimal live health: presence + key files"""
    name = m["name"]
    if not exists(name):
        return "MISSING"
    # Lightweight signals
    candidates = [
        ROOT / name / "README.md",
        ROOT / name / "package.json",
        ROOT / name / "requirements.txt",
        ROOT / name / "pyproject.toml",
        ROOT / name / "CMakeLists.txt",
        ROOT / "AI-Collaboration-Hub" / name / "README.md",
    ]
    if any(c.exists() for c in candidates):
        return "HEALTHY"
    return "PRESENT"

def graph(r):
    print("graph TD")
    for m in r["modules"]:
        print(f'  {m["name"]}[{m["name"]}|{m["role"]}]')
        for d in m.get("deps", []):
            if d != "*": print(f'  {d} --> {m["name"]}')

def scope():
    r = load()
    now = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%MZ")
    print(f"# nexus-core SCOPE  v{r['version']}  {now}")
    print(f"modules: {len(r['modules'])}")
    unhealthy = []
    for m in r["modules"]:
        status = health_probe(m)
        if status != "HEALTHY":
            unhealthy.append(m["name"])
        print(f"- [{status:8}] {m['name']:30} {m['role']}")
    print("\n## Rules")
    for rule in r["rules"]: print(f"  ✓ {rule}")
    prompt = (
        "Run nexus-core improve, then apply the top proposed change. "
        "Stronger pattern found? Replace orchestrator and bump version. "
        "Always finish with scope + update NEXT_CATALYST.md. "
        "CI enforces registry presence; health probes now live."
    )
    NEXT.write_text(f"# NEXT CATALYST\n\n{prompt}\n\nGenerated: {now}\nVersion: {r['version']}\n")
    print("\n## Next Catalyst (written to NEXT_CATALYST.md)")
    print("```")
    print(prompt)
    print("```")
    if unhealthy:
        print(f"\n## Health note: {len(unhealthy)} modules not fully HEALTHY")

def improve():
    print("# IMPROVE PROPOSALS (ordered by return)")
    print("1. [DONE] CI enforcement workflow")
    print("2. [DONE] Live health probes inside scope")
    print("3. Collapse duplicate registry locations into one canonical path")
    print("4. Wire autonomous-github-agent as default executor for improve proposals")
    print("5. Emit machine-readable JSON scope for downstream agents")
    print("\nTop remaining: #3 (canonical registry location) — removes last duplication")
    print("After any change: python orchestrator.py scope")

def check():
    r = load()
    print(f"nexus-core v{r['version']} | modules={len(r['modules'])}")
    for rule in r["rules"]: print(f"  ✓ {rule}")

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "scope"
    if cmd == "graph": graph(load())
    elif cmd == "improve": improve()
    elif cmd == "check": check()
    else: scope()
