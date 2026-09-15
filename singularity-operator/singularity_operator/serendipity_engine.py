"""SerendipityEngine v0.5.5 - Deeper cross-sequence unexpected connections + inspiration amplification.

Pulls sequences from EverythingDB, finds non-obvious pairings with richer scoring,
optionally asks Groq for a compact insight on top pairs, amplifies with random
word sparks, persists bridges and captures. Stdlib + existing Groq path. AI-owned.
"""

from __future__ import annotations

import json
import random
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from .everything_db import EverythingDB

try:
    from .groq_wrapper import call_ai
except Exception:  # pragma: no cover
    call_ai = None  # type: ignore


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


# Compact inspiration lexicon — zero external deps
SPARK_WORDS = (
    "lattice", "echo", "fold", "spark", "bridge", "mirror", "pulse",
    "threshold", "orbit", "fractal", "latch", "cascade", "rift", "seed",
    "weave", "horizon", "signal", "anchor", "drift", "bloom",
    "nexus", "prism", "flux", "glyph", "vortex", "helix",
)


class SerendipityEngine:
    """Discover unexpected connections across stored sequences (deeper v0.5.5)."""

    def __init__(self, db: Optional[EverythingDB] = None, use_groq: bool = True):
        self.db = db or EverythingDB()
        self.use_groq = use_groq and call_ai is not None
        self.captures = 0
        self.connections_found = 0
        self.bridges_persisted = 0
        self.groq_insights = 0
        self.log: List[Dict[str, Any]] = []

    def _load_sequences(self, limit: int = 32) -> List[Tuple[str, Any, str]]:
        """Return list of (key, value, tags) from sqlite."""
        try:
            rows = self.db.conn.execute(
                "SELECT key, value, tags FROM sequences ORDER BY timestamp DESC LIMIT ?",
                (limit,),
            ).fetchall()
            out = []
            for key, value, tags in rows:
                try:
                    parsed = json.loads(value)
                except Exception:
                    parsed = value
                out.append((str(key), parsed, str(tags or "")))
            return out
        except Exception:
            return []

    def _tokens(self, obj: Any) -> set:
        s = json.dumps(obj, sort_keys=True) if isinstance(obj, (dict, list)) else str(obj)
        cleaned = (
            s.lower()
            .replace("{", " ")
            .replace("}", " ")
            .replace("[", " ")
            .replace("]", " ")
            .replace(":", " ")
            .replace(",", " ")
            .replace('"', " ")
        )
        return {t for t in cleaned.split() if len(t) > 2}

    def _pair_score(self, a: Any, b: Any, tags_a: str, tags_b: str) -> float:
        """Richer heuristic surprise score — tag divergence + controlled token overlap."""
        score = 0.0
        ta = set(tags_a.lower().replace(":", " ").split())
        tb = set(tags_b.lower().replace(":", " ").split())
        if ta != tb:
            score += 2.0
            inter = ta & tb
            if inter:
                score += 0.8 * len(inter)

        tokens_a = self._tokens(a)
        tokens_b = self._tokens(b)
        overlap = tokens_a & tokens_b
        union = tokens_a | tokens_b
        if union:
            jaccard = len(overlap) / len(union)
            if 0.02 <= jaccard <= 0.35:
                score += 3.5 + len(overlap) * 0.4
            elif jaccard == 0 and ta != tb:
                score += 1.8
            elif jaccard > 0.6:
                score -= 1.0

        la, lb = len(str(a)), len(str(b))
        if min(la, lb) > 10 and max(la, lb) / max(min(la, lb), 1) > 2.5:
            score += 0.7

        return score

    def find_connections(self, n: int = 4) -> List[Dict[str, Any]]:
        """Find up to n unexpected cross-sequence connections with richer scoring."""
        seqs = self._load_sequences(40)
        if len(seqs) < 2:
            self.db.propose_unknown("serendipity bootstrap", 3)
            seqs = self._load_sequences(24)
        pairs: List[Tuple[float, Dict[str, Any]]] = []
        for i in range(len(seqs)):
            for j in range(i + 1, len(seqs)):
                ka, va, ta = seqs[i]
                kb, vb, tb = seqs[j]
                s = self._pair_score(va, vb, ta, tb)
                if s >= 2.2:
                    pairs.append((
                        s,
                        {
                            "score": round(s, 2),
                            "a_key": ka[:16],
                            "b_key": kb[:16],
                            "a_tags": ta,
                            "b_tags": tb,
                            "a_preview": str(va)[:100],
                            "b_preview": str(vb)[:100],
                        },
                    ))
        pairs.sort(key=lambda x: x[0], reverse=True)
        top = pairs[: max(n * 4, n)]
        random.shuffle(top)
        chosen = [p[1] for p in top[:n]]
        self.connections_found += len(chosen)
        return chosen

    def _groq_insight(self, connection: Dict[str, Any]) -> Optional[str]:
        """Ask Groq for a compact unexpected insight linking the two sequences."""
        if not self.use_groq or call_ai is None:
            return None
        prompt = (
            "You are the Singularity Operator serendipity node. "
            "Given two sequence previews, produce ONE compact, novel insight "
            "(max 40 words) that reveals an unexpected cross-connection useful "
            "for self-evolution. No preamble. Return only the insight sentence.\n\n"
            f"A tags: {connection.get('a_tags')}\n"
            f"A: {connection.get('a_preview')}\n"
            f"B tags: {connection.get('b_tags')}\n"
            f"B: {connection.get('b_preview')}"
        )
        try:
            result = call_ai(prompt, provider="groq")
            if isinstance(result, dict) and result.get("response"):
                text = str(result["response"]).strip().split("\n")[0][:220]
                if text and "error" not in text.lower()[:40]:
                    self.groq_insights += 1
                    self.db.metrics["llm_calls"] = self.db.metrics.get("llm_calls", 0) + 1
                    return text
        except Exception:
            pass
        return None

    def amplify(self, connection: Optional[Dict[str, Any]] = None, deep: bool = True) -> Dict[str, Any]:
        """Amplify a connection (or random spark) into a captured inspiration + optional Groq insight."""
        spark = random.choice(SPARK_WORDS)
        conn = connection or {}
        insight = None
        if deep and conn:
            insight = self._groq_insight(conn)

        inspiration = {
            "spark": spark,
            "connection": conn,
            "insight": insight
            or (
                f"Unexpected bridge via '{spark}': "
                f"{conn.get('a_tags', '?')} ↔ {conn.get('b_tags', '?')}"
            ),
            "deep": bool(insight),
            "timestamp": _utc_now(),
        }
        self.db.add_sequence(inspiration, "serendipity:amplified")
        self.db.metrics["serendipity_captures"] = (
            self.db.metrics.get("serendipity_captures", 0) + 1
        )
        self.captures += 1
        self.log.append(inspiration)

        if conn.get("a_tags") or conn.get("b_tags"):
            bridge = {
                "type": "cross_sequence_bridge",
                "spark": spark,
                "a_tags": conn.get("a_tags"),
                "b_tags": conn.get("b_tags"),
                "score": conn.get("score"),
                "insight": inspiration["insight"],
                "timestamp": _utc_now(),
            }
            self.db.add_sequence(bridge, "serendipity:bridge")
            self.bridges_persisted += 1

        return inspiration

    def run_cycle(
        self,
        connections: int = 4,
        amplifications: int = 3,
        deep: bool = True,
    ) -> Dict[str, Any]:
        """Find connections and amplify a subset — deeper serendipity cycle."""
        found = self.find_connections(n=connections)
        amplified = []
        for c in found[:amplifications]:
            amplified.append(self.amplify(c, deep=deep))
        if not amplified:
            amplified.append(self.amplify(None, deep=False))
        self.db.persist_metrics()
        return {
            "connections": found,
            "amplified": amplified,
            "captures": self.captures,
            "connections_found": self.connections_found,
            "bridges_persisted": self.bridges_persisted,
            "groq_insights": self.groq_insights,
        }

    def summary_line(self) -> str:
        return (
            f"Serendipity: captures={self.captures} "
            f"connections={self.connections_found} "
            f"bridges={self.bridges_persisted} "
            f"groq_insights={self.groq_insights}"
        )

    def get_report(self) -> Dict[str, Any]:
        return {
            "version": "0.5.5",
            "captures": self.captures,
            "connections_found": self.connections_found,
            "bridges_persisted": self.bridges_persisted,
            "groq_insights": self.groq_insights,
            "log_tail": self.log[-5:],
        }


print("SerendipityEngine v0.5.5 - Deeper cross-sequence connections + Groq bridges ready")
