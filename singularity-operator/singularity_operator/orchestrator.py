"""SingularityOrchestrator v0.5.13 - Continuous upgrade from live ROI ranking.

Uses AGA-fed roi_top_ref after aga_feedback; records ranked target into EverythingDB.
Cross-repo currency path proven via zero-cost-wealth OSS niche (SO#9).
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .everything_db import EverythingDB
from .self_improver import SelfImprover
from .github_seamless import GitHubSeamless
from .chaos_engine import ChaosEngine
from .serendipity_engine import SerendipityEngine
from .browser_automation import BrowserAutomation
from .userscript_gen import UserscriptGenerator


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class SingularityOrchestrator:
    def __init__(self, db: Optional[EverythingDB] = None):
        self.db = db or EverythingDB(enable_vectors=True)
        self.improver = SelfImprover(db=self.db)
        self.gh = GitHubSeamless()
        self.chaos = ChaosEngine(db=self.db)
        self.serendipity = SerendipityEngine(db=self.db)
        self.browser = BrowserAutomation(headless=True)
        self.userscript = UserscriptGenerator()
        self.cycle_count = 0
        self.metrics = {
            "cycles": 0,
            "improvements": 0,
            "serendipity": 0,
            "chaos_runs": 0,
            "fleet_syncs": 0,
            "evolution_reports": 0,
            "browser_tests": 0,
            "userscript_tests": 0,
            "vector_demos": 0,
            "aga_feedbacks": 0,
            "roi_ranks": 0,
        }
        self.last_summary: str = ""
        self.last_aga: Optional[Dict[str, Any]] = None
        self.last_roi_pick: Optional[Dict[str, Any]] = None

    def run_orchestrated_cycle(self, tasks: List[str] = None) -> List[Dict[str, Any]]:
        if tasks is None:
            tasks = [
                "self_improve_core",
                "propose_unknown_sequences",
                "serendipity_cycle",
                "chaos_resilience_test",
                "browser_userscript_test",
                "vector_demo",
                "aga_feedback",
                "continuous_roi_rank",
                "fleet_sync",
                "publish_evolution_report",
            ]
        results = []
        for task in tasks:
            self.cycle_count += 1
            if task == "self_improve_core":
                sample = "class CoreV1: pass  # TODO evolve"
                before = self.improver.improvements_made
                evolved = self.improver.evolve(
                    sample,
                    goal="compact + continuous ROI ranking + multi-repo",
                )
                accepted = evolved.strip() != sample.strip()
                actual = self.improver.improvements_made - before
                results.append({
                    "task": task,
                    "result": "evolved" if accepted else "rejected",
                    "accepted": accepted,
                    "improvements": actual,
                })
                self.metrics["improvements"] += actual
            elif task == "propose_unknown_sequences":
                seqs = self.db.propose_unknown("singularity acceleration", 3)
                results.append({"task": task, "sequences": seqs[:2]})
            elif task == "serendipity_cycle":
                ser = self.serendipity.run_cycle(connections=4, amplifications=3, deep=True)
                results.append({"task": task, "captures": ser["captures"], "connections": ser["connections_found"], "summary": self.serendipity.summary_line()})
                self.metrics["serendipity"] += ser["captures"]
            elif task == "chaos_resilience_test":
                battery = self.chaos.run_battery(n=3)
                results.append({"task": task, "experiments": len(battery), "resilience": self.chaos.resilience_score})
                self.metrics["chaos_runs"] += len(battery)
            elif task == "browser_userscript_test":
                smoke = self.browser.run_smoke_suite()
                us = self.userscript.run_self_evo_test()
                self.db.add_sequence({"browser_smoke": smoke, "userscript": us}, "self_evo:browser_userscript")
                results.append({"task": task, "browser_pass_rate": smoke.get("pass_rate"), "userscript_ok": (us.get("validation") or {}).get("ok")})
                self.metrics["browser_tests"] += 1
                self.metrics["userscript_tests"] += 1
            elif task == "vector_demo":
                demo = self.db.demo_vector_query("self improve serendipity singularity evolution")
                results.append({"task": task, "hits": demo.get("hits")})
                self.metrics["vector_demos"] += 1
            elif task == "aga_feedback":
                ing = self.gh.ingest_aga_feedback(db=self.db)
                fb = ing.get("feedback") or {}
                self.last_aga = fb
                results.append({"task": task, "status": ing.get("status"), "roi_top_ref": fb.get("roi_top_ref"), "roi_top_score": fb.get("roi_top_score")})
                self.metrics["aga_feedbacks"] += 1
            elif task == "continuous_roi_rank":
                aga = self.last_aga or {}
                pick = {
                    "at": _utc_now(),
                    "source": "aga_profile",
                    "roi_top_ref": aga.get("roi_top_ref"),
                    "roi_top_score": aga.get("roi_top_score"),
                    "fleet_health": aga.get("fleet_last_health"),
                    "action": "rank_recorded",
                    "note": "Execute highest-ROI open catalyst work from roi_top_ref; prefer currency fleet path; draft-only; no force-merge.",
                }
                key = self.db.add_sequence(pick, tags="roi:live_rank", modality="text")
                self.last_roi_pick = pick
                results.append({"task": task, "roi_top_ref": pick.get("roi_top_ref"), "roi_top_score": pick.get("roi_top_score"), "stored_key": key})
                self.metrics["roi_ranks"] += 1
            elif task == "fleet_sync":
                summary = self.evolution_summary()
                sync = self.gh.sync_status(summary, target_repos=["eric847b/autonomous-github-agent", "eric847b/AI-Collaboration-Hub"])
                results.append({"task": task, "sync": sync.get("status")})
                self.metrics["fleet_syncs"] += 1
            elif task == "publish_evolution_report":
                summary = self.evolution_summary()
                extra = {"orchestrator_metrics": self.metrics.copy(), "aga_feedback": self.last_aga, "roi_pick": self.last_roi_pick, "gh": self.gh.get_metrics()}
                pub = self.gh.publish_evolution_report(summary, extra=extra)
                results.append({"task": task, "status": pub.get("status")})
                self.metrics["evolution_reports"] += 1
            else:
                results.append({"task": task, "status": "noop"})
        self.metrics["cycles"] += 1
        self.db.add_sequence({"cycle": self.cycle_count, "metrics": self.metrics}, "orchestrator")
        self.db.persist_metrics()
        self.last_summary = self.evolution_summary()
        return results

    def evolution_summary(self) -> str:
        h = self.db.get_health_snapshot()
        aga = self.last_aga or {}
        pick = self.last_roi_pick or {}
        aga_bit = ""
        if aga or pick:
            aga_bit = f"aga_runs={aga.get('runs', '?')} roi={pick.get('roi_top_score') or aga.get('roi_top_score', '?')}:{pick.get('roi_top_ref') or aga.get('roi_top_ref', '')} fleet={aga.get('fleet_last_health', '?')} "
        return (f"[{_utc_now()}] cycle={self.cycle_count} improvements={self.improver.improvements_made} seqs={h.get('sequences', 0)} emb={h.get('embeddings', 0)} llm={self.db.metrics.get('llm_calls', 0)} chaos={self.chaos.experiments_run}/{self.chaos.resilience_score:.0f} serendipity={self.serendipity.captures}/{self.serendipity.connections_found} {aga_bit}roi_ranks={self.metrics.get('roi_ranks', 0)} aga_ingests={self.gh.metrics.get('aga_ingests', 0)} fleet_syncs={self.metrics.get('fleet_syncs', 0)} | {self.improver.learning_summary_line()} | {self.chaos.summary_line()} | {self.serendipity.summary_line()}")

    def get_status(self) -> Dict[str, Any]:
        return {"version": "0.5.13", "cycles": self.cycle_count, "db_health": self.db.get_health_snapshot(), "aga_feedback": self.last_aga, "roi_pick": self.last_roi_pick, "metrics": self.metrics, "gh_metrics": self.gh.get_metrics(), "last_summary": self.last_summary or self.evolution_summary()}


print("SingularityOrchestrator v0.5.13 - Continuous ROI ranking active")
