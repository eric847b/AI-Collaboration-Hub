#!/usr/bin/env python3
"""
Lightweight security audit runner for the autonomous agent (v4.7).

- Best-effort pip-audit / npm audit
- Produces security-audit-report.json
- Opens a single draft "report" PR only when actionable high findings exist
  (never auto-edits lockfiles aggressively — that is left to human/dependabot).
"""

from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path

REPORT_PATH = "security-audit-report.json"
DRY_RUN = os.getenv("DRY_RUN", "0") == "1"


def _run(cmd: list[str], cwd: str | None = None, timeout: int = 120) -> dict:
    try:
        p = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "cmd": " ".join(cmd),
            "returncode": p.returncode,
            "stdout": (p.stdout or "")[-4000:],
            "stderr": (p.stderr or "")[-2000:],
        }
    except Exception as e:
        return {"cmd": " ".join(cmd), "error": str(e)}


def audit_python(root: Path) -> list[dict]:
    findings = []
    # Prefer pip-audit if installed
    req_files = list(root.rglob("requirements*.txt"))[:20]
    for req in req_files:
        if any(p in str(req) for p in ("node_modules", ".venv", "venv", "Archive")):
            continue
        r = _run(["pip-audit", "-r", str(req), "--format", "json"], cwd=str(root))
        findings.append({"type": "pip-audit", "file": str(req), "result": r})
        # Also try without json for readability if json failed
        if r.get("returncode", 1) != 0 and "error" not in r:
            r2 = _run(["pip-audit", "-r", str(req)], cwd=str(root))
            findings.append({"type": "pip-audit-text", "file": str(req), "result": r2})
    return findings


def audit_node(root: Path) -> list[dict]:
    findings = []
    for pkg in list(root.rglob("package.json"))[:15]:
        if "node_modules" in str(pkg):
            continue
        d = pkg.parent
        r = _run(["npm", "audit", "--json"], cwd=str(d), timeout=90)
        findings.append({"type": "npm-audit", "dir": str(d), "result": r})
    return findings


def main() -> None:
    root = Path(".").resolve()
    report = {
        "version": "4.7",
        "scanned_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "python": audit_python(root),
        "node": audit_node(root),
        "notes": [
            "This is report-only. High-severity items should be reviewed and fixed via Dependabot or targeted PRs.",
            "Auto-edits of lockfiles for security are intentionally conservative to avoid breaking CI.",
        ],
    }
    with open(REPORT_PATH, "w") as fh:
        json.dump(report, fh, indent=2)
    print(f"Wrote {REPORT_PATH}")

    # Optional: open a draft report PR if AGENT_OWNS_GITHUB and not DRY_RUN
    if DRY_RUN or os.getenv("AGENT_OWNS_GITHUB") != "1":
        return
    # Keep silent unless there is clear high signal (future enhancement)
    print("Security audit complete (report-only).")


if __name__ == "__main__":
    main()
