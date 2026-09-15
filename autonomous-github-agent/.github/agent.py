"""Primary entrypoint: duplicate guard + single-pass autonomous control plane."""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GUARD = ROOT / "duplicate_guard.py"
CORE = ROOT / "autonomous_core.py"


def guard_allows_run() -> bool:
    if os.getenv("TASK", "").strip():
        print("[duplicate-guard] explicit TASK supplied; bypassing duplicate circuit breaker")
        return True
    try:
        p = subprocess.run(
            [sys.executable, str(GUARD)], cwd=str(ROOT.parent), text=True,
            capture_output=True, timeout=30, check=False,
        )
        output = (p.stdout or "") + (p.stderr or "")
        print(output.rstrip())
        match = re.search(r"should_run=(true|false)", output)
        if match:
            return match.group(1) == "true"
        print("[duplicate-guard] no decision returned; failing closed")
        return False
    except Exception as exc:
        if os.getenv("DUPLICATE_GUARD_FAIL_OPEN", "0").strip().lower() in {"1", "true", "yes"}:
            print(f"[duplicate-guard] unavailable; fail-open override enabled: {exc}")
            return True
        print(f"[duplicate-guard] unavailable; failing closed: {exc}")
        return False


def main() -> None:
    if not guard_allows_run():
        print("=== Autonomous Agent suppressed: duplicate guard denied or was unavailable. ===")
        print("No issue, PR, branch, or commit will be created by this pass.")
        return
    sys.path.insert(0, str(ROOT))
    from autonomous_core import run_once
    rc = int(run_once())
    try:
        from scripts.agent_profile_persist import persist_profile_to_repo
        p=Path(ROOT.parent / ".agent_profile.json")
        profile=json.loads(p.read_text()) if p.exists() else {}
        result=persist_profile_to_repo(profile,os.getenv("GITHUB_REPOSITORY",""))
        print(f"[profile-persist] {result}")
    except Exception as exc:
        print(f"[profile-persist] skipped: {str(exc)[:120]}")
    raise SystemExit(rc)


if __name__ == "__main__":
    main()
