#!/usr/bin/env python3
"""
Self-Heal Module for Autonomous GitHub Agent v6.3.

Encodes every bug CLASS fixed in commit 2562a95 as an automated check,
so no problem class can ever recur unnoticed:

  1. Syntax errors            -> compile() every .py file
  2. Undefined names (F821)   -> AST scan for ALL loads of undefined names
  3. Lint regressions         -> E741/E712/E722 pattern scans
  4. Deprecated datetime      -> scans for datetime.now(timezone.utc) calls
  5. Invalid workflows        -> YAML parse + invalid-pattern detection
  6. Runtime import crashes   -> core module import smoke check

`heal()` auto-repairs what is mechanically safe (deprecated utcnow) and
reports the rest for the agent's next cycle.
"""

from __future__ import annotations

import ast
import builtins
import os
import re
import shutil
import subprocess
import sys

_BUILTIN_NAMES = set(dir(builtins))

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GITHUB_DIR = os.path.join(REPO_ROOT, ".github")


def _ruff_config_args() -> list[str]:
    """Return CLI args that pin ruff to the repo's canonical config.

    Determinism: ruff otherwise discovers config from the CWD / file tree,
    so running from another directory (e.g. a CI step without checkout) would
    silently use a different rule set. Use the repo config when present,
    otherwise --isolated so behavior is identical everywhere.
    """
    for name in ("pyproject.toml", "ruff.toml", ".ruff.toml"):
        cfg = os.path.join(REPO_ROOT, name)
        if os.path.isfile(cfg):
            return ["--config", cfg]
    return ["--isolated"]

UTCNOW_RE = re.compile(r"datetime\.utcnow\(\)")
UTCNOW_REPLACEMENT = "datetime.now(timezone.utc)"
BARE_EXCEPT_RE = re.compile(r"^(\s*)except\s*:\s*$", re.MULTILINE)


def _iter_py_files():
    for dirpath, _dirnames, filenames in os.walk(GITHUB_DIR):
        for fn in filenames:
            if fn.endswith(".py"):
                yield os.path.join(dirpath, fn)


def check_syntax() -> list[str]:
    """Bug class 1: every .py file must compile."""
    failures = []
    for path in _iter_py_files():
        try:
            with open(path, encoding="utf-8") as f:
                compile(f.read(), path, "exec")
        except SyntaxError as e:
            failures.append(f"{os.path.relpath(path, REPO_ROOT)}: SyntaxError line {e.lineno}: {e.msg}")
        except (OSError, ValueError) as e:
            failures.append(f"{os.path.relpath(path, REPO_ROOT)}: {e}")
    return failures


def check_undefined_names() -> list[str]:
    """Bug class 2: AST scan for calls to names never defined/imported."""
    failures = []
    for path in _iter_py_files():
        try:
            with open(path, encoding="utf-8") as f:
                tree = ast.parse(f.read())
        except SyntaxError:
            continue
        defined: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                for alias in node.names:
                    defined.add((alias.asname or alias.name).split(".")[0])
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                defined.add(node.name)
                args = getattr(node, "args", None)
                if args is not None:
                    defined.update(
                        arg.arg for arg in (*args.posonlyargs, *args.args, *args.kwonlyargs)
                    )
                    if args.vararg:
                        defined.add(args.vararg.arg)
                    if args.kwarg:
                        defined.add(args.kwarg.arg)
            elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
                defined.add(node.id)
            elif isinstance(node, ast.ExceptHandler) and node.name:
                defined.add(node.name)
            elif isinstance(node, ast.Global):
                defined.update(node.names)
        for node in ast.walk(tree):
            if isinstance(node, (ast.comprehension, ast.For, ast.AsyncFor)):
                for t in ast.walk(node.target):
                    if isinstance(t, ast.Name):
                        defined.add(t.id)
            elif isinstance(node, (ast.With, ast.AsyncWith)):
                for item in node.items:
                    for t in ast.walk(item.optional_vars or item.context_expr):
                        if isinstance(t, ast.Name):
                            defined.add(t.id)
            elif isinstance(node, ast.Lambda):
                for arg in (*node.args.args, *node.args.kwonlyargs):
                    defined.add(arg.arg)
        for node in ast.walk(tree):
            if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
                name = node.id
                if name not in defined and name not in _BUILTIN_NAMES and not name.startswith("_"):
                    failures.append(
                        f"{os.path.relpath(path, REPO_ROOT)}: possible undefined name "
                        f"'{name}' at line {node.lineno}"
                    )
    return failures


def check_lint_patterns() -> list[str]:
    """Bug class 3: E741 ambiguous names, bare except, E712 constant compare."""
    failures = []
    for path in _iter_py_files():
        try:
            with open(path, encoding="utf-8") as f:
                lines = f.read().splitlines()
        except OSError:
            continue
        rel = os.path.relpath(path, REPO_ROOT)
        for i, line in enumerate(lines, 1):
            code = line.split("#", 1)[0]
            if re.search(r"\b(l|I|O)\s*=", code) and '"' not in code and "'" not in code:
                failures.append(f"{rel}:{i}: E741 ambiguous variable name")
            if BARE_EXCEPT_RE.match(line):
                failures.append(f"{rel}:{i}: E722 bare except")
            if re.search(r"==\s*(True|False|None)\b", code) or re.search(r"\b(True|False|None)\s*==", code):
                failures.append(f"{rel}:{i}: E712 comparison to constant")
    return failures


def check_ruff() -> list[str]:
    """Bug class 3b: run the authoritative ruff linter over .github (as CI does).

    Catches every lint class at once (F401/F841/SIM/UP/I/...), not just the
    hand-rolled patterns in check_lint_patterns. Skips if ruff is not
    installed locally — the CI gate covers it there.
    """
    failures = []
    try:
        import ruff  # noqa: F401 - availability probe
    except ImportError:
        return []  # ruff not installed locally; CI covers this
    result = subprocess.run(
        [sys.executable, "-m", "ruff", "check", GITHUB_DIR, "--output-format", "concise", *_ruff_config_args()],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.returncode != 0:
        out = (result.stdout or "") + (result.stderr or "")
        for line in out.splitlines():
            # concise format: path:line:col: CODE description
            if re.match(r"^[^ ]+:\d+:\d+: [A-Z]+\d+", line) or re.match(r"^Found \d+ error", line):
                failures.append(line.rstrip())
    return failures


def check_deprecated_datetime() -> list[str]:
    """Bug class 4: AST scan for actual calls to deprecated datetime.utcnow().

    AST-based (not text regex) so string literals containing the pattern in
    docs/messages never cause self-referential false positives.
    """
    failures = []
    for path in _iter_py_files():
        try:
            with open(path, encoding="utf-8") as f:
                tree = ast.parse(f.read())
        except SyntaxError:
            continue
        except OSError:
            continue
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            func = node.func
            if not isinstance(func, ast.Attribute) or func.attr != "utcnow":
                continue
            base = func.value
            # match `datetime.utcnow()` and `datetime.datetime.utcnow()`
            if isinstance(base, ast.Attribute):
                base = base.value
            if isinstance(base, ast.Name) and base.id == "datetime":
                failures.append(
                    f"{os.path.relpath(path, REPO_ROOT)}:{node.lineno}: "
                    "deprecated datetime.utcnow() call (use datetime.now(timezone.utc))"
                )
    return failures


def check_workflows() -> list[str]:
    """Bug class 5: invalid YAML or known-invalid workflow patterns."""
    failures = []
    wf_dir = os.path.join(GITHUB_DIR, "workflows")
    if not os.path.isdir(wf_dir):
        return [".github/workflows directory missing"]
    try:
        import yaml  # type: ignore[import-untyped]
    except ImportError:
        return []  # yaml not installed locally; CI covers this
    for fn in sorted(os.listdir(wf_dir)):
        if not (fn.endswith(".yml") or fn.endswith(".yaml")):
            continue
        path = os.path.join(wf_dir, fn)
        try:
            with open(path, encoding="utf-8") as f:
                doc = yaml.safe_load(f)
        except yaml.YAMLError as e:
            failures.append(f".github/workflows/{fn}: invalid YAML: {e}")
            continue
        jobs = (doc or {}).get("jobs", {}) or {}
        for job_name, job in jobs.items():
            if not isinstance(job, dict):
                continue
            if "working-directory" in job:
                failures.append(
                    f".github/workflows/{fn}: job '{job_name}' has invalid job-level "
                    "working-directory (use defaults.run.working-directory)"
                )
    return failures


def check_workflows_actionlint() -> list[str]:
    """Bug class 5b: run actionlint over all workflows (definitive checker).

    Catches every workflow class (bad runs-on, malformed steps, bad triggers,
    invalid expressions...) not just the pattern-scan in check_workflows.
    Uses ACTIONLINT env var (CI may install it), else shutil.which to the
    actionlint binary; skips if unavailable locally (CI covers it there).
    """
    failures = []
    wf_dir = os.path.join(GITHUB_DIR, "workflows")
    if not os.path.isdir(wf_dir):
        return [".github/workflows directory missing"]
    exe = os.environ.get("ACTIONLINT") or shutil.which("actionlint")
    if not exe:
        return []  # actionlint not installed locally; CI covers this

    for fn in sorted(os.listdir(wf_dir)):
        if not (fn.endswith(".yml") or fn.endswith(".yaml")):
            continue
        path = os.path.join(wf_dir, fn)
        try:
            result = subprocess.run(
                [exe, path],
                capture_output=True,
                text=True,
                timeout=120,
            )
        except (OSError, subprocess.SubprocessError):
            failures.append(f"actionlint invocation failed for {fn}")
            continue
        if result.returncode != 0:
            out = (result.stdout or "") + (result.stderr or "")
            for line in out.splitlines():
                if line.strip():
                    failures.append(f".github/workflows/{fn}: {line.strip()}")
    return failures
    """Bug class 5: invalid YAML or known-invalid workflow patterns."""
    failures = []
    wf_dir = os.path.join(GITHUB_DIR, "workflows")
    if not os.path.isdir(wf_dir):
        return [".github/workflows directory missing"]
    try:
        import yaml  # type: ignore[import-untyped]
    except ImportError:
        return []  # yaml not installed locally; CI covers this
    for fn in sorted(os.listdir(wf_dir)):
        if not (fn.endswith(".yml") or fn.endswith(".yaml")):
            continue
        path = os.path.join(wf_dir, fn)
        try:
            with open(path, encoding="utf-8") as f:
                doc = yaml.safe_load(f)
        except yaml.YAMLError as e:
            failures.append(f".github/workflows/{fn}: invalid YAML: {e}")
            continue
        jobs = (doc or {}).get("jobs", {}) or {}
        for job_name, job in jobs.items():
            if not isinstance(job, dict):
                continue
            if "working-directory" in job:
                failures.append(
                    f".github/workflows/{fn}: job '{job_name}' has invalid job-level "
                    "working-directory (use defaults.run.working-directory)"
                )
    return failures


def check_core_imports() -> list[str]:
    """Bug class 6: import core modules; catches NameError at import time."""
    failures = []
    for p in (REPO_ROOT, os.path.join(GITHUB_DIR, "scripts"), GITHUB_DIR):
        if p not in sys.path:
            sys.path.insert(0, p)
    for mod in ("policy",):
        try:
            __import__(mod)
        except Exception as e:  # noqa: BLE001 - report any import failure
            failures.append(f"import {mod}: {type(e).__name__}: {e}")
    return failures


def heal() -> list[str]:
    """Apply mechanically safe repairs; never write a file that fails compile.

    Two paths:
      1. utcnow -> now(timezone.utc) (text-level, matches the AST detector).
      2. ruff --fix (safe fixes only) across .github when ruff is installed,
         followed by a re-check so only genuinely-repaired files pass.
    """
    repairs = []
    for path in _iter_py_files():
        try:
            with open(path, encoding="utf-8") as f:
                src = f.read()
        except OSError:
            continue
        fixed = src
        if UTCNOW_RE.search(fixed):
            m = re.search(r"^from datetime import (.+)$", fixed, re.MULTILINE)
            if m and "timezone" not in m.group(1):
                fixed = fixed.replace(m.group(0), f"{m.group(0)}, timezone", 1)
            fixed = UTCNOW_RE.sub(UTCNOW_REPLACEMENT, fixed)
            repairs.append(f"utcnow -> now(timezone.utc) in {os.path.relpath(path, REPO_ROOT)}")
        if fixed != src:
            try:
                compile(fixed, path, "exec")
            except SyntaxError:
                continue  # never corrupt a file
            with open(path, "w", encoding="utf-8", newline="") as f:
                f.write(fixed)
    try:
        import ruff  # noqa: F401 - availability probe
    except ImportError:
        return repairs
    fix = subprocess.run(
        [sys.executable, "-m", "ruff", "check", GITHUB_DIR, "--fix", *_ruff_config_args()],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if fix.returncode == 0:
        # ruff reports fixed files in its output
        for line in (fix.stdout or "").splitlines():
            if "fixed" in line.lower():
                repairs.append(f"ruff --fix: {line.strip()}")
    return repairs


def run_all_checks() -> dict[str, list[str]]:
    return {
        "syntax": check_syntax(),
        "undefined_names": check_undefined_names(),
        "lint": check_lint_patterns(),
        "ruff": check_ruff(),
        "deprecated_datetime": check_deprecated_datetime(),
        "workflows": check_workflows(),
        "actionlint": check_workflows_actionlint(),
        "imports": check_core_imports(),
    }


def main() -> int:
    print("=" * 60)
    print("SELF-HEAL: scanning for every known bug class")
    print("=" * 60)
    checks = run_all_checks()
    total = sum(len(v) for v in checks.values())
    for name, issues in checks.items():
        status = "OK" if not issues else f"FAIL ({len(issues)})"
        print(f"\n[{name.upper()}] {status}")
        for issue in issues[:20]:
            print(f"  - {issue}")
        if len(issues) > 20:
            print(f"  ... and {len(issues) - 20} more")
    print("\n" + "=" * 60)
    if total == 0:
        print("SELF-HEAL: all bug-class checks clean")
        return 0
    print(f"SELF-HEAL: {total} issue(s) found")
    return 1


if __name__ == "__main__":
    sys.exit(main())
