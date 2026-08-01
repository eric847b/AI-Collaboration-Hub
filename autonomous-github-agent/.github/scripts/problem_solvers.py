#!/usr/bin/env python3
"""
Autonomous agent problem solvers v5.0 Nexus
Handles CI failure classes:
  - npm ERESOLVE / peer dependency conflicts
  - Python syntax errors (py_compile)
  - Missing lockfiles (deps-aware)
  - Missing requirements.txt / pyproject.toml for Python projects with 3rd-party imports
  - Outdated GitHub Actions versions (common deprecations)
Works with problem_solvers_runner v5.0 (duplicate cleanup + closed-loop ledger).
"""

from __future__ import annotations

import ast
import json
import os
import re
import hashlib
from typing import Dict, List, Optional, Set

SKIP_DIRS = {
    ".git", "node_modules", "Archive", "dist", "build", "__pycache__",
    ".venv", "venv", ".tox", "coverage", ".next", ".expo", ".cache", "archive",
}

# Known peer ranges that commonly break CI
PEER_RULES = [
    # (package_needing_peer, peer_name, max_exclusive_major_hint, fix_pin)
    ("typescript-eslint", "typescript", 6, "~5.9.3"),
    ("@typescript-eslint/eslint-plugin", "typescript", 6, "~5.9.3"),
    ("@typescript-eslint/parser", "typescript", 6, "~5.9.3"),
]

# Common 3rd-party Python packages we can safely pin when detected
KNOWN_PY_PINS = {
    "requests": "requests>=2.28.0",
    "httpx": "httpx>=0.24.0",
    "aiohttp": "aiohttp>=3.8.0",
    "numpy": "numpy>=1.23.0",
    "pandas": "pandas>=1.5.0",
    "pyyaml": "PyYAML>=6.0",
    "yaml": "PyYAML>=6.0",
    "pydantic": "pydantic>=1.10.0",
    "fastapi": "fastapi>=0.100.0",
    "flask": "flask>=2.2.0",
    "django": "django>=4.0",
    "sqlalchemy": "SQLAlchemy>=1.4.0",
    "pytest": "pytest>=7.0.0",
    "black": "black>=23.0.0",
    "ruff": "ruff>=0.1.0",
    "mypy": "mypy>=1.0.0",
    "click": "click>=8.0.0",
    "typer": "typer>=0.9.0",
    "rich": "rich>=13.0.0",
    "tqdm": "tqdm>=4.64.0",
    "python-dotenv": "python-dotenv>=1.0.0",
    "dotenv": "python-dotenv>=1.0.0",
    "openai": "openai>=1.0.0",
    "anthropic": "anthropic>=0.20.0",
    "groq": "groq>=0.4.0",
    "github": "PyGithub>=1.59.0",
    "PyGithub": "PyGithub>=1.59.0",
}

# GitHub Actions known-good majors (surgical bump targets)
GHA_KNOWN_GOOD = {
    "actions/checkout": "v4",
    "actions/setup-node": "v4",
    "actions/setup-python": "v5",
    "actions/cache": "v4",
    "actions/upload-artifact": "v4",
    "actions/download-artifact": "v4",
    "actions/github-script": "v7",
    "actions/setup-java": "v4",
    "actions/setup-go": "v5",
    "docker/build-push-action": "v5",
    "docker/login-action": "v3",
}


def _walk_files(root: str, suffixes: tuple) -> List[str]:
    out = []
    for r, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        for f in files:
            if f.endswith(suffixes):
                out.append(os.path.join(r, f))
    return out


def package_has_deps(pkg_path: str) -> bool:
    try:
        with open(pkg_path, "r", errors="ignore") as fh:
            data = json.load(fh)
        return bool(
            data.get("dependencies")
            or data.get("devDependencies")
            or data.get("optionalDependencies")
        )
    except Exception:
        return True


def has_node_lockfile(dir_path: str) -> bool:
    for name in ("package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock"):
        if os.path.isfile(os.path.join(dir_path, name)):
            return True
    return False


def scan_python_syntax(root: str = ".") -> List[Dict]:
    """Find Python files that fail to parse (SyntaxError). High ROI."""
    tasks = []
    for path in _walk_files(root, (".py",)):
        try:
            with open(path, "r", errors="ignore") as fh:
                src = fh.read()
            ast.parse(src, filename=path)
        except SyntaxError as e:
            tasks.append({
                "type": "python_syntax",
                "id": f"pysyn_{hashlib.md5(path.encode()).hexdigest()[:10]}",
                "title": f"Fix Python SyntaxError in {path}",
                "body": (
                    f"File `{path}` fails to parse.\n"
                    f"Line {e.lineno}: {e.msg}\n"
                    f"Text: {e.text!r}\n\n"
                    f"Common causes: unterminated f-string, mismatched quotes, "
                    f"invalid escapes inside nested string literals."
                ),
                "path": path,
                "impact": 2.9,
                "risk": 0.15,
                "lineno": e.lineno,
                "msg": str(e.msg),
            })
        except Exception:
            pass
    return tasks


def _parse_semver_major(spec: str) -> Optional[int]:
    """Extract leading major from a version range like ^7.0.2 or ~5.9.3."""
    if not spec:
        return None
    m = re.search(r"(\d+)", str(spec))
    return int(m.group(1)) if m else None


def scan_peer_dependency_conflicts(root: str = ".") -> List[Dict]:
    """Detect typescript vs typescript-eslint style peer mismatches in package.json."""
    tasks = []
    for path in _walk_files(root, ("package.json",)):
        if "node_modules" in path:
            continue
        try:
            with open(path, "r", errors="ignore") as fh:
                data = json.load(fh)
        except Exception:
            continue
        all_deps = {}
        for key in ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies"):
            all_deps.update(data.get(key) or {})

        for needy, peer, max_major, pin in PEER_RULES:
            if needy not in all_deps:
                continue
            if peer not in all_deps:
                continue
            major = _parse_semver_major(all_deps[peer])
            if major is not None and major >= max_major:
                rel = os.path.dirname(path) or "."
                tasks.append({
                    "type": "peer_conflict",
                    "id": f"peer_{hashlib.md5(path.encode()).hexdigest()[:10]}",
                    "title": f"Fix peer conflict: {peer}@{all_deps[peer]} vs {needy} in {rel}",
                    "body": (
                        f"`{path}` declares `{peer}` at `{all_deps[peer]}` but `{needy}` "
                        f"typically requires `{peer} < {max_major}.1.0`.\n\n"
                        f"This causes `npm error ERESOLVE could not resolve` in CI.\n\n"
                        f"Recommended fix: pin `{peer}` to `{pin}` in devDependencies, "
                        f"then regenerate package-lock.json.\n\n"
                        f"Alternative: `npm install --legacy-peer-deps` (CI fallback only)."
                    ),
                    "path": path,
                    "project_dir": rel,
                    "impact": 2.7,
                    "risk": 0.2,
                    "peer": peer,
                    "pin": pin,
                    "needy": needy,
                })
    return tasks


def fix_peer_conflict_in_package_json(pkg_path: str, peer: str, pin: str) -> Dict:
    """Rewrite package.json pinning peer version. Returns success dict."""
    result = {"success": False, "output": "", "error": ""}
    try:
        with open(pkg_path, "r", errors="ignore") as fh:
            data = json.load(fh)
        changed = False
        for section in ("devDependencies", "dependencies", "optionalDependencies"):
            if section in data and peer in data[section]:
                old = data[section][peer]
                data[section][peer] = pin
                changed = True
                result["output"] = f"{section}.{peer}: {old} -> {pin}"
        if not changed:
            data.setdefault("devDependencies", {})[peer] = pin
            result["output"] = f"added devDependencies.{peer}={pin}"
            changed = True
        if changed:
            with open(pkg_path, "w") as fh:
                json.dump(data, fh, indent=2)
                fh.write("\n")
            result["success"] = True
    except Exception as e:
        result["error"] = str(e)
    return result


def fix_python_syntax_file(path: str, content_hint: str = "") -> Dict:
    """
    Best-effort local check for Python syntax errors.
    Complex rewrites are handled by problem_solvers_runner / LLM agent.
    """
    result = {"success": False, "output": "", "error": ""}
    try:
        with open(path, "r", errors="ignore") as fh:
            src = fh.read()
        try:
            ast.parse(src)
            result["success"] = True
            result["output"] = "already valid"
            return result
        except SyntaxError as e:
            result["error"] = f"unfixed syntax: {e.msg} at line {e.lineno}"
            result["output"] = (e.text or "")[:200]
            return result
    except Exception as ex:
        result["error"] = str(ex)
    return result


def scan_lockfile_gaps_smart(root: str = ".") -> List[Dict]:
    """Only flag missing lockfiles when package.json has real dependencies."""
    tasks = []
    seen = set()
    for r, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        if "package.json" not in files:
            continue
        pkg = os.path.join(r, "package.json")
        rel = r if r != "." else "."
        if rel in seen:
            continue
        seen.add(rel)
        if has_node_lockfile(r):
            continue
        has_deps = package_has_deps(pkg)
        impact = 2.5 if has_deps else 1.2
        tasks.append({
            "type": "lockfile",
            "id": f"lockfile_{hashlib.md5(rel.encode()).hexdigest()[:8]}",
            "title": f"Generate missing Node lockfile for {rel}",
            "body": (
                f"Project at `{rel}` has package.json but no lockfile. "
                + ("Has dependencies — required for CI." if has_deps else "No deps — optional minimal lockfile OK.")
            ),
            "path": pkg,
            "project_dir": rel,
            "impact": impact,
            "risk": 0.12,
            "has_deps": has_deps,
        })
    return tasks


def create_minimal_lockfile(project_dir: str) -> Dict:
    """Write a valid lockfileVersion 3 stub for no-deps packages."""
    result = {"success": False, "output": "", "error": ""}
    try:
        pkg = os.path.join(project_dir, "package.json")
        with open(pkg, "r") as fh:
            data = json.load(fh)
        name = data.get("name") or os.path.basename(project_dir) or "package"
        version = data.get("version") or "1.0.0"
        lock = {
            "name": name,
            "version": version,
            "lockfileVersion": 3,
            "requires": True,
            "packages": {
                "": {"name": name, "version": version}
            },
        }
        deps = data.get("dependencies") or {}
        if deps:
            lock["packages"][""]["dependencies"] = deps
            lock["dependencies"] = {
                k: {
                    "version": re.sub(r"^[~^>=<]+", "", str(v)),
                    "resolved": "",
                    "integrity": "",
                }
                for k, v in deps.items()
            }
        path = os.path.join(project_dir, "package-lock.json")
        with open(path, "w") as fh:
            json.dump(lock, fh, indent=2)
            fh.write("\n")
        result = {"success": True, "output": f"wrote {path}"}
    except Exception as e:
        result["error"] = str(e)
    return result


def _collect_third_party_imports(py_path: str) -> Set[str]:
    """Return set of top-level third-party module names imported in a file."""
    found: Set[str] = set()
    try:
        with open(py_path, "r", errors="ignore") as fh:
            src = fh.read()
        tree = ast.parse(src, filename=py_path)
    except Exception:
        return found
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                top = alias.name.split(".")[0]
                if top and not top.startswith("_"):
                    found.add(top)
        elif isinstance(node, ast.ImportFrom):
            if node.module and node.level == 0:
                top = node.module.split(".")[0]
                if top and not top.startswith("_"):
                    found.add(top)
    stdlibish = {
        "os", "sys", "re", "json", "ast", "hashlib", "typing", "collections",
        "pathlib", "datetime", "time", "logging", "subprocess", "shutil",
        "tempfile", "io", "copy", "functools", "itertools", "operator",
        "contextlib", "dataclasses", "enum", "abc", "traceback", "inspect",
        "importlib", "pkgutil", "unittest", "doctest", "argparse", "getopt",
        "configparser", "csv", "xml", "html", "http", "urllib", "email",
        "base64", "binascii", "struct", "codecs", "locale", "gettext",
        "string", "textwrap", "unicodedata", "difflib", "pprint", "reprlib",
        "math", "cmath", "decimal", "fractions", "random", "statistics",
        "secrets", "hmac", "uuid", "socket", "ssl", "select",
        "selectors", "asyncio", "concurrent", "multiprocessing", "threading",
        "queue", "sched", "signal", "mmap", "ctypes", "platform", "errno",
        "gc", "sysconfig", "builtins", "__future__",
    }
    return {m for m in found if m not in stdlibish}


def scan_missing_requirements(root: str = ".") -> List[Dict]:
    """Find Python project dirs that import 3rd-party packages but lack requirements.txt / pyproject.toml."""
    tasks = []
    candidates: Dict[str, Set[str]] = {}
    for path in _walk_files(root, (".py",)):
        d = os.path.dirname(path) or "."
        proj = d
        for _ in range(3):
            parent = os.path.dirname(proj) or "."
            if parent == proj:
                break
            if os.path.isfile(os.path.join(proj, "setup.py")) or os.path.isfile(os.path.join(proj, "pyproject.toml")):
                break
            proj = parent
        mods = _collect_third_party_imports(path)
        if mods:
            candidates.setdefault(proj, set()).update(mods)

    for proj, mods in candidates.items():
        req = os.path.join(proj, "requirements.txt")
        pyproj = os.path.join(proj, "pyproject.toml")
        if os.path.isfile(req) or os.path.isfile(pyproj):
            continue
        pins = [KNOWN_PY_PINS[m] for m in sorted(mods) if m in KNOWN_PY_PINS]
        if not pins:
            pins = ["# Auto-generated placeholder — add project dependencies here", "requests>=2.28.0"]
        rel = proj if proj != "." else "."
        tasks.append({
            "type": "missing_requirements",
            "id": f"pyreq_{hashlib.md5(rel.encode()).hexdigest()[:10]}",
            "title": f"Add requirements.txt for Python project {rel}",
            "body": (
                f"Directory `{rel}` contains Python files importing third-party modules "
                f"({', '.join(sorted(mods)[:8])}{'...' if len(mods) > 8 else ''}) "
                f"but has no requirements.txt or pyproject.toml.\n\n"
                f"This causes non-reproducible installs and CI failures.\n\n"
                f"Auto-fix will write a minimal requirements.txt with known-good pins."
            ),
            "path": req,
            "project_dir": rel,
            "impact": 2.6,
            "risk": 0.1,
            "pins": pins,
            "modules": sorted(mods),
        })
    return tasks


def fix_missing_requirements(project_dir: str, pins: List[str]) -> Dict:
    """Write a minimal requirements.txt."""
    result = {"success": False, "output": "", "error": ""}
    try:
        path = os.path.join(project_dir, "requirements.txt")
        lines = ["# Auto-generated by autonomous-github-agent v5.0"] + list(pins)
        with open(path, "w") as fh:
            fh.write("\n".join(lines) + "\n")
        result = {"success": True, "output": f"Wrote {path} with {len(pins)} entries"}
    except Exception as e:
        result["error"] = str(e)
    return result


def scan_gha_deprecations(root: str = ".") -> List[Dict]:
    """Find workflow uses: actions/*@vN that are behind known-good majors."""
    tasks = []
    workflow_dirs = []
    for r, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        if os.path.basename(r) == "workflows" and ".github" in r.replace("\\", "/"):
            workflow_dirs.append(r)
    for wdir in workflow_dirs:
        for fname in os.listdir(wdir):
            if not (fname.endswith(".yml") or fname.endswith(".yaml")):
                continue
            path = os.path.join(wdir, fname)
            try:
                with open(path, "r", errors="ignore") as fh:
                    content = fh.read()
            except Exception:
                continue
            for m in re.finditer(r"uses:\s*([\w\-]+/[\w\-]+)@v?(\d+)", content):
                action, major = m.group(1), int(m.group(2))
                if action in GHA_KNOWN_GOOD:
                    good = GHA_KNOWN_GOOD[action]
                    good_major = int(re.search(r"\d+", good).group(0))
                    if major < good_major:
                        tasks.append({
                            "type": "gha_deprecation",
                            "id": f"gha_{hashlib.md5((path + action).encode()).hexdigest()[:10]}",
                            "title": f"Bump {action}@v{major} -> {good} in {path}",
                            "body": (
                                f"`{path}` uses `{action}@v{major}` which is behind the "
                                f"monorepo known-good `{good}`.\n\n"
                                f"Surgical bump recommended for security and feature parity."
                            ),
                            "path": path,
                            "action": action,
                            "old_major": major,
                            "new_ref": good,
                            "impact": 2.4,
                            "risk": 0.18,
                        })
    return tasks


def fix_gha_version(path: str, action: str, new_ref: str) -> Dict:
    """Replace uses: action@vN with known-good ref."""
    result = {"success": False, "output": "", "error": ""}
    try:
        with open(path, "r", errors="ignore") as fh:
            content = fh.read()
        pattern = re.compile(rf"(uses:\s*{re.escape(action)}@)v?\d+")
        new_content, n = pattern.subn(rf"\g<1>{new_ref}", content)
        if n == 0:
            result["error"] = "no match"
            return result
        with open(path, "w") as fh:
            fh.write(new_content)
        result = {"success": True, "output": f"Updated {n} occurrence(s) of {action} -> {new_ref}"}
    except Exception as e:
        result["error"] = str(e)
    return result
