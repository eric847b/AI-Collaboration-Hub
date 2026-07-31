#!/usr/bin/env python3
"""
Autonomous agent problem solvers v4.4
Handles CI failure classes:
  - npm ERESOLVE / peer dependency conflicts
  - Python syntax errors (py_compile)
  - Missing lockfiles (deps-aware)
"""

from __future__ import annotations

import ast
import json
import os
import re
import hashlib
from typing import Dict, List, Optional

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
    Best-effort local fixes for common syntax errors.
    Handles unterminated f-strings with nested quotes by converting to concat.
    Full complex fixes still go through LLM in the agent.
    """
    result = {"success": False, "output": "", "error": ""}
    try:
        with open(path, "r", errors="ignore") as fh:
            src = fh.read()
        # Try parse — if already OK, done
        try:
            ast.parse(src)
            result["success"] = True
            result["output"] = "already valid"
            return result
        except SyntaxError as e:
            msg = (e.msg or "").lower()

        fixed = src
        # Pattern: f"...{' + '.join(...)}...unterminated
        # Replace nested f-string join with precomputed variable pattern is LLM territory;
        # apply a narrow fix for the known advanced_userscript pattern.
        if "unterminated f-string" in msg or "unterminated string" in msg:
            # Convert f"....{' + '.join(x)}...." style if present on one broken line
            pattern = re.compile(
                r"script\s*=\s*f\"([^\"]*)\{' \+ '\.join\(([^)]+)\)\}([^\"]*)",
                re.DOTALL,
            )
            m = pattern.search(fixed)
            if m:
                before, join_arg, after = m.group(1), m.group(2), m.group(3)
                replacement = (
                    f"description = ' + '.join({join_arg})\n"
                    f"        script = (
"
                    f"            \"{before}\"\n"
                    f"            f\"{{description}}\"\n"
                    f"            \"{after}\"\n"
                    f"        )"
                )
                # Too fragile — mark for LLM
                result["error"] = "unterminated f-string — needs structured rewrite"
                result["output"] = f"line={e.lineno} msg={e.msg}"
                return result

        result["error"] = f"unfixed syntax: {e.msg} at line {e.lineno}"
        result["output"] = (e.text or "")[:200]
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
        # Include declared deps as unresolved stubs if present (agent should prefer npm install)
        deps = data.get("dependencies") or {}
        if deps:
            lock["packages"][""]["dependencies"] = deps
            lock["dependencies"] = {
                k: {"version": re.sub(r"^[~^>=<]+", "", str(v)), "resolved": "", "integrity": ""}
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
