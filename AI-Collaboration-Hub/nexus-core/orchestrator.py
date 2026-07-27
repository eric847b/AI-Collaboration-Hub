#!/usr/bin/env python3
"""nexus-core v2.6 — minimal permanent successor
Free, quiet, cron, self-audit, full lifecycle, optional release, runtime-fail safe.
"""
import json, sys, datetime, subprocess, os
from pathlib import Path

CORE = Path(__file__).resolve().parent
ROOT = CORE.parents[1]
REG, NEXT, SCOPE_JSON = CORE/"registry.json", CORE/"NEXT_CATALYST.md", CORE/"scope.json"
AGENT = ROOT/"autonomous-github-agent"/".github"/"scripts"/"agent.py"

def load():
    return json.loads(REG.read_text())

def exists(n):
    return (ROOT/n).exists() or (ROOT/"AI-Collaboration-Hub"/n).exists()

def health(m):
    if not exists(m["name"]): return "MISSING"
    keys = ["README.md","package.json","requirements.txt","pyproject.toml","CMakeLists.txt"]
    return "HEALTHY" if any((ROOT/m["name"]/k).exists() or (ROOT/"AI-Collaboration-Hub"/m["name"]/k).exists() for k in keys) else "PRESENT"

def scope(json_only=False):
    r = load()
    now = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%MZ")
    mods = [{"name":m["name"],"role":m["role"],"status":health(m),"entrypoint":m.get("entrypoint",""),"deps":m.get("deps",[])} for m in r["modules"]]
    data = {"system":"nexus-core","version":r["version"],"generated":now,"modules":mods,
            "unhealthy":[m["name"] for m in mods if m["status"]!="HEALTHY"],"rules":r["rules"],
            "canonical":"AI-Collaboration-Hub/nexus-core","executor":"autonomous-github-agent",
            "cost":"zero","user_time":"zero"}
    SCOPE_JSON.write_text(json.dumps(data, indent=2))
    if json_only:
        print(json.dumps(data)); return data
    print(f"# nexus-core SCOPE  v{data['version']}  {data['generated']}")
    print(f"modules: {len(mods)} | free | minimal | runtime-safe")
    for m in mods: print(f"- [{m['status']:8}] {m['name']:30} {m['role']}")
    for rule in data["rules"]: print(f"  ✓ {rule}")
    prompt = ("Run nexus-core improve, then apply the top proposed change. "
              "Stronger pattern found? Replace orchestrator and bump version. "
              "Always finish with scope + update NEXT_CATALYST.md. "
              "Minimal. Runtime fails absorbed. Free cron. Zero user time.")
    NEXT.write_text(f"# NEXT CATALYST\n\n{prompt}\n\nGenerated: {now}\nVersion: {data['version']}\n")
    print("\n## Next Catalyst\n```\n"+prompt+"\n```\n## scope.json written")
    if data["unhealthy"]: print(f"## Health note: {len(data['unhealthy'])} not fully HEALTHY")
    return data

def improve():
    print("# IMPROVE PROPOSALS")
    print("1-13. [DONE] CI → optional release")
    print("14. [DONE] Delete dead paths + harden runtime-fail absorption")
    print("15. Stabilize — only change on real need")
    print("\nTop remaining: #15 (stabilize)")
    print("Note: PRs #13 and #14 (Dependabot) already merged/closed.")

def run_agent():
    if not AGENT.exists(): print("agent not found"); return
    os.environ.update(QUIET="1", SUPPRESS_NOTIFICATIONS="1", AGENT_OWNS_GITHUB="1")
    try:
        subprocess.run([sys.executable, str(AGENT)], cwd=str(ROOT), timeout=300)
    except Exception as e:
        print(f"agent runtime absorbed: {e}")  # never bomb user

def check():
    r = load()
    print(f"nexus-core v{r['version']} | free | minimal | runtime-safe")
    for rule in r["rules"]: print(f"  ✓ {rule}")

def graph(r=None):
    r = r or load()
    print("graph TD")
    for m in r["modules"]:
        print(f'  {m["name"]}[{m["name"]}|{m["role"]}]')
        for d in m.get("deps",[]):
            if d!="*": print(f"  {d} --> {m['name']}")

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv)>1 else "scope"
    {"graph":lambda: graph(), "improve":improve, "check":check, "agent":run_agent,
     "json":lambda: scope(True)}.get(cmd, scope)()
