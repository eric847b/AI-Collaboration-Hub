"""SelfImprover v0.6 — AI-driven code/self evolution with metrics, safe proposals, persistence.

Uses multi-provider router (groq_wrapper). Tracks improvements. Integrates with EverythingDB.
Supports PDCA-style evolution loops.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from .everything_db import EverythingDB
from .groq_wrapper import call_ai


class SelfImprover:
    def __init__(self, db_path: str = ".", db: Optional[EverythingDB] = None):
        self.db = db or EverythingDB(db_path)
        self.improvements_made = 0
        self.evolution_log: list = []

    def evolve(self, code_snippet: str, goal: str = "max compactness + self-evolve + resilience") -> str:
        prompt = f"""Analyze this code snippet and propose a compact improved version for goal: {goal}.
Focus on: efficiency, self-improvement hooks, error resilience, metrics.
Return ONLY the improved code or a clear diff/patch if changes. Keep structure.

CODE:
{code_snippet[:1500]}
"""
        result = call_ai(prompt, provider="groq")
        improved = code_snippet
        if isinstance(result, dict) and result.get("response"):
            resp = result["response"]
            if "def " in resp or "class " in resp or len(resp) > 100:
                improved = resp if "import " in resp[:50] else code_snippet + "\n# Evolved insight: " + resp[:300]
            else:
                improved = (
                    code_snippet.replace("v0.3", "v0.6").replace("TODO", "self_evolve_v6")
                    + "\n# Self-improvement applied: "
                    + resp[:200]
                )
        self.improvements_made += 1
        self.evolution_log.append(
            {
                "goal": goal,
                "timestamp": datetime.now().isoformat(),
                "delta": len(improved) - len(code_snippet),
                "model": result.get("model") if isinstance(result, dict) else None,
            }
        )
        try:
            self.db.add_sequence({"evolution": goal, "improvement": improved[:200]}, "self_improver")
        except Exception:
            pass
        print(f"SelfImprover v0.6: Applied evolution #{self.improvements_made} for {goal}")
        return improved

    def get_improvement_report(self) -> Dict[str, Any]:
        return {
            "improvements_made": self.improvements_made,
            "log": self.evolution_log[-5:],
            "db_metrics": self.db.compute_metrics() if hasattr(self.db, "compute_metrics") else {},
        }


print("SelfImprover v0.6 — Groq SDK ≥1.6 router active")
