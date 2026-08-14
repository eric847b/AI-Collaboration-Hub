"""Singularity Operator v0.5.10 Launcher — full cycle including AGA feedback.
"""

import os
from datetime import datetime

from singularity_operator import (
    EverythingDB,
    SelfImprover,
    ChaosEngine,
    SerendipityEngine,
    SingularityOrchestrator,
    BrowserAutomation,
    UserscriptGenerator,
    GitHubSeamless,
)


def main():
    print("=== Singularity Operator v0.5.10 ===")
    print(f"Time: {datetime.now().isoformat()}")
    print(f"Groq key present: {bool(os.getenv('GROQ_API_KEY'))}")
    print(f"GitHub token present: {bool(os.getenv('GITHUB_TOKEN') or os.getenv('GH_FULL_PAT'))}")

    db = EverythingDB(":memory:", mem_cache_size=8, enable_vectors=True)
    improver = SelfImprover(db=db)
    chaos = ChaosEngine(db=db)
    serendipity = SerendipityEngine(db=db)
    browser = BrowserAutomation()
    usgen = UserscriptGenerator()
    gh = GitHubSeamless()
    orch = SingularityOrchestrator(db=db)

    print("\n[1] Propose + evolve...")
    db.propose_unknown("core self-improvement + singularity", 3)
    improver.evolve("def core_v1(): return 'v1'", goal="compact + AGA feedback v0.5.10")

    print("\n[2] Vector demo...")
    demo = db.demo_vector_query("self improve serendipity singularity")
    print(f"  hits={demo.get('hits')}")

    print("\n[3] AGA metrics feedback ingest...")
    ing = gh.ingest_aga_feedback(db=db)
    fb = ing.get("feedback") or {}
    print(f"  status={ing.get('status')} runs={fb.get('runs')} roi_top={fb.get('roi_top_ref')} score={fb.get('roi_top_score')}")

    print("\n[4] Serendipity + chaos...")
    serendipity.run_cycle(connections=2, amplifications=1)
    chaos.run_battery(n=2)

    print("\n[5] Browser + userscript...")
    smoke = browser.run_smoke_suite()
    print(f"  smoke pass_rate={smoke.get('pass_rate')}")
    us = usgen.run_self_evo_test()
    print(f"  userscript ok={us.get('validation', {}).get('ok')}")

    print("\n[6] Orchestrated cycle...")
    cycle_results = orch.run_orchestrated_cycle()
    print("Cycle tasks:", [r.get("task") for r in cycle_results])
    print("Summary:", orch.evolution_summary())

    print("\n=== v0.5.10 complete. AGA feedback loop operational. ===")


if __name__ == "__main__":
    main()
