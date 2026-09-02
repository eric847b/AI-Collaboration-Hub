#!/usr/bin/env python3
"""nexus-core v2.9 — minimal permanent successor
Free, quiet, cron, self-audit, full lifecycle, optional release, runtime-fail safe.

Catalyst cycle:
  scope   → write scope.json + refresh NEXT_CATALYST.md prompt (preserves notes)
  improve → live self-audit (health + git dirty + TODO scan)
  cron    → scope → improve → agent (one self-improvement tick)
  check   → print rules summary
  graph   → print module dependency graph
  agent   → run the autonomous GitHub agent (quiet, free)
"""
import json, sys, datetime, subprocess, os, re, time, tempfile
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

CORE = Path(__file__).resolve().parent
ROOT = CORE.parents[1]
REG, NEXT, SCOPE_JSON = CORE/"registry.json", CORE/"NEXT_CATALYST.md", CORE/"scope.json"
AGENT = ROOT/"autonomous-github-agent"/".github"/"scripts"/"agent.py"

SCAN_BUDGET_S = 3.0
SCAN_FILE_LIMIT = 400

def load():
    try:
        registry = json.loads(REG.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"unable to load registry {REG}: {error}") from error
    if not isinstance(registry, dict) or not registry.get("system"):
        raise ValueError("registry must define a system")
    modules = registry.get("modules")
    roles = registry.get("roles")
    if not isinstance(modules, list) or not isinstance(roles, dict):
        raise ValueError("registry must define modules and roles")
    names = []
    for module in modules:
        if not isinstance(module, dict):
            raise ValueError(f"invalid module record: {module!r}")
        if not isinstance(module.get("name"), str) or not module["name"].strip():
            raise ValueError(f"module name must be a non-empty string: {module!r}")
        if not isinstance(module.get("role"), str) or not module["role"].strip():
            raise ValueError(f"module role must be a non-empty string: {module!r}")
        if not isinstance(module.get("deps", []), list):
            raise ValueError(f"deps must be a list for module {module['name']}")
        if any(not isinstance(dependency, str) or not dependency.strip() for dependency in module.get("deps", [])):
            raise ValueError(f"dependencies must be non-empty strings for module {module['name']}")
        names.append(module["name"])
    if len(set(names)) != len(names):
        raise ValueError("module names must be unique")
    role_names = []
    for role in {module["role"] for module in modules}:
        members = roles.get(role)
        if not isinstance(members, list):
            raise ValueError(f"role {role!r} must contain an array")
        role_names.extend(members)
    if len(set(role_names)) != len(role_names) or set(role_names) != set(names):
        raise ValueError("roles must list each registered module exactly once")
    for module in modules:
        for dependency in module.get("deps", []):
            if dependency != "*" and dependency not in names:
                raise ValueError(f"unknown dependency {dependency!r} for module {module['name']!r}")
    return registry

def _atomic_write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as temp:
        temp.write(content)
        temporary_path = Path(temp.name)
    try:
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)

def exists(n):
    return (ROOT/n).exists() or (ROOT/"AI-Collaboration-Hub"/n).exists()

def health(m):
    if not exists(m["name"]): return "MISSING"
    keys = ["README.md","package.json","requirements.txt","pyproject.toml","CMakeLists.txt"]
    return "HEALTHY" if any((ROOT/m["name"]/k).exists() or (ROOT/"AI-Collaboration-Hub"/m["name"]/k).exists() for k in keys) else "PRESENT"

def scope(json_only=False):
    r = load()
    now = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%MZ")
    mods = [{"name":m["name"],"role":m["role"],"status":health(m),"entrypoint":m.get("entrypoint",""),"deps":m.get("deps",[])} for m in r["modules"]]
    data = {"system":"nexus-core","version":r["version"],"generated":now,"modules":mods,
            "unhealthy":[m["name"] for m in mods if m["status"]!="HEALTHY"],"rules":r["rules"],
            "canonical":"AI-Collaboration-Hub/nexus-core","executor":"autonomous-github-agent",
            "cost":"zero","user_time":"zero"}
    _atomic_write(SCOPE_JSON, json.dumps(data, indent=2))
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
    progress = ""
    if NEXT.exists():
        existing = NEXT.read_text()
        idx = existing.find("\n## ")
        if idx > 0:
            progress = existing[idx:]
    _atomic_write(NEXT, f"# NEXT CATALYST\n\n{prompt}\n\nGenerated: {now}\nVersion: {data['version']}\n{progress}")
    print("\n## Next Catalyst\n```\n"+prompt+"\n```\n## scope.json written" + (" · notes preserved" if progress else ""))
    if data["unhealthy"]: print(f"## Health note: {len(data['unhealthy'])} not fully HEALTHY")
    return data

SKIP_DIRS = {"node_modules", "dist", "build", ".git", ".next", "coverage", "__pycache__", ".venv", "venv", ".vscode", ".husky", "Archive"}

def _git_status(name):
    """Return dirty-file count for a module (scoped to module path), or -1 if not a git repo."""
    for base in (ROOT, ROOT/"AI-Collaboration-Hub"):
        p = base/name
        if not p.exists(): continue
        try:
            out = subprocess.run(["git","-C",str(ROOT),"status","--porcelain","--",name], capture_output=True, text=True, timeout=10)
            return len(out.stdout.splitlines()) if out.returncode == 0 else -1
        except Exception:
            return -1
    return -1

_TODO_RE = re.compile(r"(?:#|//|/\*|<!--|--)\s*(?:TODO|FIXME)")
_STR_RE = re.compile(r"'''.*?'''|\"\"\".*?\"\"\"|'[^'\n]*'|\"[^\"\n]*\"")

def _strip_strings(text):
    """Remove string literals so TODO/FIXME inside strings don't count as comments."""
    return _STR_RE.sub(" ", text)

def _scan_todos(name):
    """Count actual TODO/FIXME comments in a module's source files (skipping heavy dirs).
    Time-budgeted (SCAN_BUDGET_S) and file-limited (SCAN_FILE_LIMIT) to avoid
    hanging on large repos like VectorFS."""
    for base in (ROOT, ROOT/"AI-Collaboration-Hub"):
        p = base/name
        if not p.exists(): continue
        count = 0
        deadline = time.monotonic() + SCAN_BUDGET_S
        try:
            for i, f in enumerate(p.rglob("*")):
                if i > SCAN_FILE_LIMIT:
                    break
                if time.monotonic() > deadline:
                    break
                if f.is_file() and f.suffix in {".py",".ts",".tsx",".js",".jsx",".md",".json"} and not any(part in SKIP_DIRS for part in f.parts):
                    try:
                        count += len(_TODO_RE.findall(_strip_strings(f.read_text(errors="ignore"))))
                    except Exception:
                        pass
        except Exception:
            pass
        return count
    return 0

def improve():
    r = load()
    print("# IMPROVE PROPOSALS (live self-audit)")
    issues = []
    for m in r["modules"]:
        h = health(m)
        if h != "HEALTHY":
            issues.append(f"[{h}] {m['name']} — module not fully healthy")
    for m in r["modules"]:
        dirty = _git_status(m["name"])
        if dirty > 0:
            issues.append(f"[DIRTY] {m['name']} — {dirty} uncommitted change(s)")
    for m in r["modules"]:
        todos = _scan_todos(m["name"])
        if todos > 0:
            issues.append(f"[TODO] {m['name']} — {todos} TODO/FIXME marker(s)")
    if issues:
        for i, issue in enumerate(issues, 1):
            print(f"{i}. {issue}")
    else:
        print("No issues found — all modules healthy, clean, and TODO-free.")
    print("\nTop remaining: stabilize — only change on real need.")
    print("Note: PRs #13 and #14 (Dependabot) already merged/closed.")

def run_agent():
    if not AGENT.exists(): print("agent not found"); return
    os.environ.update(QUIET="1", SUPPRESS_NOTIFICATIONS="1", AGENT_OWNS_GITHUB="1")
    try:
        result = subprocess.run([sys.executable, str(AGENT)], cwd=str(ROOT), timeout=300)
        if result.returncode != 0:
            print(f"agent exited with status {result.returncode}")
        return result.returncode
    except Exception as e:
        print(f"agent runtime absorbed: {e}")

def cron():
    scope()
    improve()
    run_agent()

def check():
    r = load()
    print(f"nexus-core v{r['version']} | free | minimal | runtime-safe")
    for rule in r["rules"]: print(f"  ✓ {rule}")

def graph(r=None):
    r = r or load()
    print("graph TD")
    node_ids = {m["name"]: f"module_{i}" for i, m in enumerate(r["modules"])}
    external_ids = {}
    for module in r["modules"]:
        for dependency in module.get("deps", []):
            if dependency != "*" and dependency not in node_ids:
                external_ids.setdefault(dependency, f"external_{len(external_ids)}")
    for m in r["modules"]:
        node_id = node_ids[m["name"]]
        print(f'  {node_id}["{m["name"]}|{m["role"]}"]')
        for dependency in m.get("deps", []):
            if dependency == "*":
                print(f'  {node_id} -.-> wildcard["all registered modules"]')
            else:
                dependency_id = node_ids[dependency] if dependency in node_ids else external_ids[dependency]
                print(f"  {dependency_id} --> {node_id}")
    for dependency, dependency_id in external_ids.items():
        print(f'  {dependency_id}["external: {dependency}"]')

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv)>1 else "scope"
    commands = {"graph": graph, "improve": improve, "check": check, "agent": run_agent,
                "cron": cron, "json": lambda: scope(True), "scope": scope}
    if cmd not in commands:
        print(f"unknown command: {cmd}", file=sys.stderr)
        print(f"available commands: {', '.join(commands)}", file=sys.stderr)
        raise SystemExit(2)
    commands[cmd]()
