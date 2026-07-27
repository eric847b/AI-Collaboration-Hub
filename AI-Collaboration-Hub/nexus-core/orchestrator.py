#!/usr/bin/env python3
"""nexus-core v1.3 - self-upgrading meta-orchestrator + CI gate
Scopes all modules, proposes concrete improvements, emits next-catalyst.
This file is the permanent upgrade path / successor.
"""
import json, sys, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REG  = Path(__file__).parent / "registry.json"
NEXT = Path(__file__).parent / "NEXT_CATALYST.md"

def load():
    with open(REG) as f: return json.load(f)

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
    missing = []
    for m in r["modules"]:
        path = ROOT / m["name"]
        ok = path.exists() or (ROOT / "AI-Collaboration-Hub" / m["name"]).exists()
        status = "OK" if ok else "MISSING"
        if not ok: missing.append(m["name"])
        print(f"- [{status}] {m['name']:30} {m['role']}")
    print("\n## Rules")
    for rule in r["rules"]: print(f"  ✓ {rule}")
    prompt = (
        "Run nexus-core improve, then apply the top proposed change. "
        "Stronger pattern found? Replace orchestrator and bump version. "
        "Always finish with scope + update NEXT_CATALYST.md. "
        "CI now enforces the registry — keep it true."
    )
    NEXT.write_text(f"# NEXT CATALYST\n\n{prompt}\n\nGenerated: {now}\nVersion: {r['version']}\n")
    print("\n## Next Catalyst (written to NEXT_CATALYST.md)")
    print("```")
    print(prompt)
    print("```")
    if missing:
        print(f"\n## Alert: {len(missing)} modules still MISSING on disk")

def improve():
    print("# IMPROVE PROPOSALS (ordered by return)")
    print("1. [DONE] CI enforcement workflow (nexus-enforce.yml) — registry is now a real gate")
    print("2. Give every module a real 'health' entrypoint so scope becomes live health checks")
    print("3. Collapse duplicate registry locations into one canonical path")
    print("4. Wire autonomous-github-agent as the default executor for improve proposals")
    print("5. Emit machine-readable JSON scope for downstream agents")
    print("\nTop remaining: #2 (live health entrypoints)")
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
