#!/usr/bin/env python3
"""Minimal entrypoint for FailureSolver in AI-Collaboration-Hub."""
import os, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from failure_solver import get_failure_solver

def main():
    repo = os.getenv("GITHUB_REPOSITORY", "eric847b/AI-Collaboration-Hub")
    profile = {}
    def record(e, c=""): print(f"[ERROR:{c}] {e}")
    solver = get_failure_solver(repo, profile=profile, record_error=record)
    print(solver.run_proactive_pass(max_issues=3))
    print("Profile:", {k: profile.get(k) for k in ("failures_triaged", "failure_solver_runs", "issues_created")})

if __name__ == "__main__":
    main()
