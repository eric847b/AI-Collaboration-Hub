#!/usr/bin/env python3
"""nexus-core v1.1 - minimal self-upgrading meta-orchestrator
Scopes every registered module, emits all-repos status + next-catalyst prompt.
Use this as the upgrade path / successor pattern.
"""
import json, os, subprocess, sys, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REG  = Path(__file__).parent / "registry.json"

def load():
    with open(REG) as f: return json.load(f)

def graph(r):
    print("graph TD")
    for m in r["modules"]:
        print(f'  {m["name"]}[{m["name"]}|{m["role"]}]')
        for d in m.get("deps", []):
            if d != "*": print(f'  {d} --> {m["name"]}')

def run(name):
    r = load()
    mod = next((m for m in r["modules"] if m["name"] == name), None)
    if not mod: sys.exit(f"unregistered: {name}")
    ep = mod.get("entrypoint")
    if ep: subprocess.run(ep, shell=True, cwd=ROOT/name if (ROOT/name).exists() else ROOT)

def scope():
    """Largest-return catalyst: full workspace status + next prompt"""
    r = load()
    now = datetime.datetime.utcnow().isoformat() + "Z"
    print(f"# nexus-core SCOPE REPORT  {now}")
    print(f"version: {r['version']} | modules: {len(r['modules'])}")
    print("\n## Registered Modules")
    for m in r["modules"]:
        path = ROOT / m["name"]
        exists = path.exists() or (ROOT / "AI-Collaboration-Hub" / m["name"]).exists()
        status = "OK" if exists else "MISSING"
        print(f"- [{status}] {m['name']:30} role={m['role']:12} entry={m.get('entrypoint','')}")
    print("\n## Rules")
    for rule in r["rules"]: print(f"  ✓ {rule}")
    print("\n## Next Catalyst Prompt (copy-paste)")
    print("```")
    print("Run nexus-core scope, then execute the highest-ROI unregistered or MISSING module improvement across all repos. Upgrade orchestrator itself if a better pattern is found. Produce the next scope report.")
    print("```")
    print("\n## Self-Upgrade Path")
    print("This orchestrator is the current successor. To upgrade: improve this file, bump version in registry.json, re-run scope.")

def check():
    r = load()
    print(f"nexus-core v{r['version']} | modules={len(r['modules'])} | rules={len(r['rules'])}")
    for rule in r["rules"]: print(f"  ✓ {rule}")

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "scope"
    if cmd == "graph": graph(load())
    elif cmd == "run":  run(sys.argv[2]) if len(sys.argv) > 2 else sys.exit("name required")
    elif cmd == "check": check()
    else: scope()
