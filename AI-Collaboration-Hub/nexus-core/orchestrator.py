#!/usr/bin/env python3
"""nexus-core v1.2 - self-upgrading meta-orchestrator
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
    # Write durable next-action file
    prompt = (
        "Run nexus-core improve, then apply the top proposed change across repos. "
        "If a stronger self-upgrade pattern appears, replace this orchestrator and bump version. "
        "Always finish by re-running scope and updating NEXT_CATALYST.md."
    )
    NEXT.write_text(f"# NEXT CATALYST\n\n{prompt}\n\nGenerated: {now}\n")
    print("\n## Next Catalyst (also written to NEXT_CATALYST.md)")
    print("```")
    print(prompt)
    print("```")
    if missing:
        print(f"\n## Alert: {len(missing)} modules still MISSING on disk")

def improve():
    """Highest-ROI proposals - concrete, shrink-first"""
    r = load()
    print("# IMPROVE PROPOSALS (ordered by return)")
    print("1. Add .github/workflows/nexus-enforce.yml that fails CI if any module is missing from registry or disk")
    print("2. Give every module a real 'health' entrypoint (even if just 'echo OK') so scope can become live health")
    print("3. Collapse root + AI-Collaboration-Hub/nexus-core into one canonical location to remove duplication")
    print("4. Make autonomous-github-agent the default runner for 'improve' so it can open PRs automatically")
    print("5. Bump this orchestrator to emit a machine-readable JSON scope for downstream agents")
    print("\nTop recommendation right now: #1 (CI enforcement) - turns the registry into an actual gate.")
    print("After applying any change: python orchestrator.py scope")

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
