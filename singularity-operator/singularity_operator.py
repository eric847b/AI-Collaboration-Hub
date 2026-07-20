"""Singularity Operator v0.5.0 Launcher - Resilient entry point + full demo cycle.

Runs EverythingDB + SelfImprover + Orchestrator. Exercises self-evolution.
Use in CI (auto-evolve.yml) or locally with GROQ_API_KEY for full power.

Perfection acceleration: Every run proposes unknowns, evolves code, captures serendipity, tests chaos recovery."""

import os
from datetime import datetime

# Package imports (v0.5.0 unified)
from singularity_operator import (
    EverythingDB, SelfImprover, call_ai, GitHubSeamless, SingularityOrchestrator
)


def main():
    print("=== Singularity Operator v0.5.0 ===")
    print(f"Time: {datetime.now().isoformat()}")
    print(f"Groq key present: {bool(os.getenv('GROQ_API_KEY'))}")

    # Init core
    db = EverythingDB(":memory:", mem_cache_size=8)  # In-mem for CI/demo; use file for persistence
    improver = SelfImprover(db=db)
    orch = SingularityOrchestrator(db=db)

    # Core demo: propose, evolve, orchestrate
    print("\n[1] Propose unknown sequences (EverythingDB + Groq router)...")
    unknowns = db.propose_unknown("core self-improvement + singularity", 4)
    print("Proposed:", unknowns[:3])

    print("\n[2] Self-evolve sample code...")
    evolved = improver.evolve("def core_v1(): return 'v1'  # TODO: self_improve", goal="compact + metrics + resilience v0.5")
    print("Evolved snippet preview:", evolved[:300] + "...")

    print("\n[3] Run orchestrated self-evolution cycle...")
    cycle_results = orch.run_orchestrated_cycle()
    print("Cycle results:", cycle_results)

    print("\n[4] Health & metrics...")
    print("DB Health:", db.get_health_snapshot())
    print("Improver report:", improver.get_improvement_report())
    print("Orchestrator status:", orch.get_status())

    print("\n=== v0.5.0 Self-evolution cycle complete. System stronger. ===")
    print("Next: Trigger more cycles, integrate with autonomous-github-agent/Userscripts, full chaos experiments.")


if __name__ == "__main__":
    main()
