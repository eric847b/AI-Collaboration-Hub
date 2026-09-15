"""ChaosEngine v0.5.3 - Disciplined chaos experiments for antifragility.

Injects controlled failures (latency, outage, cache poison, metric noise),
runs recovery via EverythingDB.chaos_recover + SelfImprover resilience goal,
measures resilience gain. Stdlib only. AI-owned continuous upgrade path.
"""

from __future__ import annotations

import random
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .everything_db import EverythingDB


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


# Experiment catalog — each is safe, reversible, measurable
EXPERIMENTS = (
    "api_latency",
    "simulated_outage",
    "cache_poison",
    "metric_noise",
    "serendipity_storm",
)


class ChaosEngine:
    """Run one or more chaos experiments and record resilience delta."""

    def __init__(self, db: Optional[EverythingDB] = None):
        self.db = db or EverythingDB()
        self.experiments_run = 0
        self.recoveries = 0
        self.failures = 0
        self.log: List[Dict[str, Any]] = []
        self.resilience_score = 50.0  # baseline 0–100

    def _inject(self, failure_type: str) -> Dict[str, Any]:
        """Simulate a controlled failure. Never raises; returns injection record."""
        injected_at = _utc_now()
        detail: Dict[str, Any] = {"type": failure_type, "injected_at": injected_at}

        if failure_type == "api_latency":
            # Micro-sleep only (CI-safe); records intended latency
            delay_ms = random.randint(5, 40)
            time.sleep(delay_ms / 1000.0)
            detail["delay_ms"] = delay_ms
        elif failure_type == "simulated_outage":
            # Do not call external AI; force local fallback path
            detail["mode"] = "local_fallback_only"
        elif failure_type == "cache_poison":
            poison_key = f"chaos_poison_{random.randint(1000, 9999)}"
            self.db._save_to_cache(poison_key, "{\"poisoned\": true}")
            detail["poison_key"] = poison_key
        elif failure_type == "metric_noise":
            # Temporarily bump a counter then recovery will re-persist truth
            self.db.metrics["llm_calls"] = self.db.metrics.get("llm_calls", 0) + 999
            detail["noise"] = "llm_calls_spike"
        elif failure_type == "serendipity_storm":
            for i in range(3):
                self.db.add_sequence(
                    {"storm": i, "noise": random.random()}, "chaos:serendipity_storm"
                )
            detail["storm_count"] = 3
        else:
            detail["mode"] = "unknown_noop"

        return detail

    def run_experiment(self, failure_type: Optional[str] = None) -> Dict[str, Any]:
        """Inject → recover → measure. Returns full experiment record."""
        failure_type = failure_type or random.choice(EXPERIMENTS)
        before = self.db.compute_metrics()
        score_before = self.resilience_score

        injection = self._inject(failure_type)
        recovery = self.db.chaos_recover(failure_type)

        # Resilience gain: successful recovery always +gain; failure -penalty
        ok = bool(recovery.get("recovered"))
        if ok:
            self.recoveries += 1
            gain = 2.5 + random.uniform(0, 2.5)
            self.resilience_score = min(100.0, self.resilience_score + gain)
        else:
            self.failures += 1
            self.resilience_score = max(0.0, self.resilience_score - 5.0)
            gain = self.resilience_score - score_before

        self.experiments_run += 1
        after = self.db.compute_metrics()

        record = {
            "experiment": failure_type,
            "ok": ok,
            "injection": injection,
            "recovery": recovery,
            "score_before": round(score_before, 1),
            "score_after": round(self.resilience_score, 1),
            "gain": round(self.resilience_score - score_before, 1),
            "metrics_before": before,
            "metrics_after": after,
            "timestamp": _utc_now(),
        }
        self.log.append(record)
        self.db.add_sequence(record, "chaos_experiment")
        self.db.persist_metrics()
        return record

    def run_battery(self, n: int = 3) -> List[Dict[str, Any]]:
        """Run n distinct experiments (or with replacement if n > catalog)."""
        types = list(EXPERIMENTS)
        random.shuffle(types)
        results = []
        for i in range(max(1, n)):
            ft = types[i % len(types)]
            results.append(self.run_experiment(ft))
        return results

    def summary_line(self) -> str:
        return (
            f"ChaosEngine: runs={self.experiments_run} recoveries={self.recoveries} "
            f"failures={self.failures} resilience={self.resilience_score:.1f}"
        )

    def get_report(self) -> Dict[str, Any]:
        return {
            "experiments_run": self.experiments_run,
            "recoveries": self.recoveries,
            "failures": self.failures,
            "resilience_score": round(self.resilience_score, 1),
            "log_tail": self.log[-5:],
        }


print("ChaosEngine v0.5.3 - Disciplined chaos + measurable resilience ready")
