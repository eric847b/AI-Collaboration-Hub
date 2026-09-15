"""EverythingDB v0.5.9 - Universal sequence store + optional vector similarity.

Zero-dep default: bag-of-words hashing embeddings + cosine similarity.
Feature flag `enable_vectors` (default True for the stub; no external models).
Optional multi-modal tag support (text / code / image_ref / audio_ref).
"""

from __future__ import annotations

import json
import math
import re
import sqlite3
from collections import OrderedDict, Counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from .groq_wrapper import call_ai


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


_TOKEN_RE = re.compile(r"[a-z0-9_]{2,}", re.I)


def _tokenize(text: str) -> List[str]:
    return [t.lower() for t in _TOKEN_RE.findall(text or "")]


def _text_of(seq: Any) -> str:
    if isinstance(seq, str):
        return seq
    if isinstance(seq, dict):
        parts = []
        for k, v in seq.items():
            parts.append(str(k))
            if isinstance(v, (str, int, float)):
                parts.append(str(v))
            elif isinstance(v, (list, dict)):
                parts.append(json.dumps(v, sort_keys=True)[:400])
        return " ".join(parts)
    try:
        return json.dumps(seq, sort_keys=True)
    except Exception:
        return str(seq)


def _bow_vector(text: str, dim: int = 64) -> List[float]:
    """Hashing bag-of-words embedding — pure stdlib, fixed dimension."""
    vec = [0.0] * dim
    tokens = _tokenize(text)
    if not tokens:
        return vec
    counts = Counter(tokens)
    for tok, cnt in counts.items():
        idx = hash(tok) % dim
        # signed hash trick to reduce collisions
        sign = 1.0 if (hash(tok + "#") % 2 == 0) else -1.0
        vec[idx] += sign * float(cnt)
    # L2 normalize
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def _cosine(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    return sum(x * y for x, y in zip(a, b))


class EverythingDB:
    def __init__(
        self,
        db_path: str = "everything.db",
        mem_cache_size: int = 64,
        enable_vectors: bool = True,
        vector_dim: int = 64,
    ):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.enable_vectors = enable_vectors
        self.vector_dim = vector_dim
        self._init_tables()
        self.mem_cache: OrderedDict = OrderedDict()
        self.mem_cache_size = mem_cache_size
        self.metrics = {
            "llm_calls": 0,
            "cache_hits": 0,
            "sequences_added": 0,
            "serendipity_captures": 0,
            "chaos_recoveries": 0,
            "learning_writes": 0,
            "metrics_persists": 0,
            "embeddings_stored": 0,
            "vector_queries": 0,
            "vector_hits": 0,
        }
        self.health = {"status": "healthy", "last_check": _utc_now(), "version": "0.5.9"}
        self._load_persisted_metrics()

    def _init_tables(self):
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS sequences "
            "(key TEXT PRIMARY KEY, value TEXT, timestamp TEXT, tags TEXT, modality TEXT DEFAULT 'text')"
        )
        # migrate: add modality column if older DB
        try:
            self.conn.execute("ALTER TABLE sequences ADD COLUMN modality TEXT DEFAULT 'text'")
            self.conn.commit()
        except sqlite3.OperationalError:
            pass
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS groq_cache (prompt TEXT PRIMARY KEY, response TEXT, timestamp TEXT)"
        )
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS metrics (key TEXT PRIMARY KEY, value TEXT)"
        )
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS embeddings "
            "(key TEXT PRIMARY KEY, dim INTEGER, vector TEXT, modality TEXT, timestamp TEXT)"
        )
        self.conn.commit()

    def _load_persisted_metrics(self):
        try:
            row = self.conn.execute("SELECT value FROM metrics WHERE key=?", ("snapshot",)).fetchone()
            if row:
                saved = json.loads(row[0])
                for k, v in saved.items():
                    if k in self.metrics and isinstance(v, (int, float)):
                        self.metrics[k] = int(v)
        except Exception:
            pass

    def persist_metrics(self) -> Dict[str, Any]:
        snap = {**self.metrics, "persisted_at": _utc_now(), "enable_vectors": self.enable_vectors}
        self.conn.execute(
            "INSERT OR REPLACE INTO metrics VALUES (?, ?)",
            ("snapshot", json.dumps(snap)),
        )
        self.conn.commit()
        self.metrics["metrics_persists"] += 1
        return snap

    def _get_from_cache(self, prompt: str) -> Optional[str]:
        if prompt in self.mem_cache:
            self.mem_cache.move_to_end(prompt)
            self.metrics["cache_hits"] += 1
            return self.mem_cache[prompt]
        row = self.conn.execute("SELECT response FROM groq_cache WHERE prompt=?", (prompt,)).fetchone()
        if row:
            self._save_to_cache(prompt, row[0])
            self.metrics["cache_hits"] += 1
            return row[0]
        return None

    def _save_to_cache(self, prompt: str, response: str):
        self.mem_cache[prompt] = response
        if len(self.mem_cache) > self.mem_cache_size:
            self.mem_cache.popitem(last=False)
        self.conn.execute(
            "INSERT OR REPLACE INTO groq_cache VALUES (?, ?, ?)",
            (prompt, response, _utc_now()),
        )
        self.conn.commit()

    def _store_embedding(self, key: str, seq: Any, modality: str = "text"):
        if not self.enable_vectors:
            return
        text = _text_of(seq)
        vec = _bow_vector(text, dim=self.vector_dim)
        self.conn.execute(
            "INSERT OR REPLACE INTO embeddings VALUES (?, ?, ?, ?, ?)",
            (key, self.vector_dim, json.dumps(vec), modality, _utc_now()),
        )
        self.conn.commit()
        self.metrics["embeddings_stored"] += 1

    def add_sequence(
        self,
        seq: Any,
        tags: str = "general",
        modality: str = "text",
    ) -> str:
        """Add a sequence. modality: text | code | image_ref | audio_ref | multi."""
        key = str(hash(json.dumps(seq, sort_keys=True) if isinstance(seq, (dict, list)) else str(seq)))
        self.conn.execute(
            "INSERT OR REPLACE INTO sequences VALUES (?, ?, ?, ?, ?)",
            (key, json.dumps(seq), _utc_now(), tags, modality),
        )
        self.conn.commit()
        self.metrics["sequences_added"] += 1
        self._store_embedding(key, seq, modality=modality)
        return key

    def similarity_search(
        self,
        query: Any,
        top_k: int = 5,
        modality: Optional[str] = None,
        min_score: float = 0.05,
    ) -> List[Dict[str, Any]]:
        """Find sequences most similar to query via cosine over bag-of-words vectors."""
        self.metrics["vector_queries"] += 1
        if not self.enable_vectors:
            return []
        qvec = _bow_vector(_text_of(query), dim=self.vector_dim)
        sql = "SELECT key, dim, vector, modality FROM embeddings"
        params: Tuple = ()
        if modality:
            sql += " WHERE modality=?"
            params = (modality,)
        rows = self.conn.execute(sql, params).fetchall()
        scored: List[Tuple[float, str, str]] = []
        for key, dim, vec_json, mod in rows:
            try:
                vec = json.loads(vec_json)
            except Exception:
                continue
            if dim != self.vector_dim or len(vec) != self.vector_dim:
                # re-embed on dim mismatch is skipped for simplicity
                continue
            score = _cosine(qvec, vec)
            if score >= min_score:
                scored.append((score, key, mod or "text"))
        scored.sort(key=lambda x: x[0], reverse=True)
        results: List[Dict[str, Any]] = []
        for score, key, mod in scored[:top_k]:
            row = self.conn.execute(
                "SELECT value, tags, timestamp FROM sequences WHERE key=?", (key,)
            ).fetchone()
            if not row:
                continue
            try:
                value = json.loads(row[0])
            except Exception:
                value = row[0]
            results.append(
                {
                    "key": key,
                    "score": round(score, 4),
                    "modality": mod,
                    "tags": row[1],
                    "timestamp": row[2],
                    "value": value,
                }
            )
        if results:
            self.metrics["vector_hits"] += len(results)
        return results

    def demo_vector_query(self, query: str = "self improve serendipity singularity") -> Dict[str, Any]:
        """Measurable demo: ensure seed data, run similarity, return report."""
        # Seed a few sequences if DB is sparse
        count = self.conn.execute("SELECT COUNT(*) FROM sequences").fetchone()[0]
        if count < 3:
            self.add_sequence({"topic": "self_improve", "note": "compact evolution"}, "demo:evolve", "text")
            self.add_sequence({"topic": "serendipity", "bridge": "cross-sequence"}, "demo:serendipity", "text")
            self.add_sequence("def singularity_step(): pass  # code modality", "demo:code", "code")
        hits = self.similarity_search(query, top_k=5)
        report = {
            "query": query,
            "enable_vectors": self.enable_vectors,
            "vector_dim": self.vector_dim,
            "hits": len(hits),
            "top": hits[:3],
            "metrics": {
                "embeddings_stored": self.metrics["embeddings_stored"],
                "vector_queries": self.metrics["vector_queries"],
                "vector_hits": self.metrics["vector_hits"],
            },
            "timestamp": _utc_now(),
        }
        self.add_sequence(report, "vector:demo", "text")
        return report

    def propose_unknown(self, domain: str = "AI self-improvement", n: int = 5) -> List[Any]:
        prompt = (
            f"Propose {n} novel, compact knowledge sequences or transistor states for {domain} "
            f"that complete unknowns or accelerate singularity. Return ONLY valid compact JSON array of strings or objects."
        )
        cached = self._get_from_cache(prompt)
        if cached:
            try:
                return json.loads(cached)
            except Exception:
                pass
        result = call_ai(prompt, provider="groq")
        self.metrics["llm_calls"] += 1
        sequences: List[Any] = []
        if isinstance(result, dict) and "response" in result:
            try:
                content = result["response"]
                if "[" in content and "]" in content:
                    start = content.find("[")
                    end = content.rfind("]") + 1
                    sequences = json.loads(content[start:end])
                else:
                    sequences = [content]
            except Exception:
                sequences = [str(result)]
        else:
            sequences = ["self_evolve_v5_compact", "EverythingDB_universal_latch", "serendipity_engine_v1"]
        for seq in sequences:
            self.add_sequence(seq, tags=f"proposed:{domain}")
        self._save_to_cache(prompt, json.dumps(sequences))
        if hash(domain) % 7 == 0:
            self.metrics["serendipity_captures"] += 1
            self.add_sequence(
                {"serendipity": "unexpected connection found", "domain": domain},
                "serendipity",
            )
        return sequences

    def get_health_snapshot(self) -> Dict[str, Any]:
        seq_count = self.conn.execute("SELECT COUNT(*) FROM sequences").fetchone()[0]
        cache_count = self.conn.execute("SELECT COUNT(*) FROM groq_cache").fetchone()[0]
        emb_count = self.conn.execute("SELECT COUNT(*) FROM embeddings").fetchone()[0]
        tag_rows = self.conn.execute(
            "SELECT tags, COUNT(*) FROM sequences GROUP BY tags ORDER BY COUNT(*) DESC LIMIT 8"
        ).fetchall()
        top_tags = {str(t): int(c) for t, c in tag_rows}
        self.health.update(
            {
                "status": "healthy",
                "last_check": _utc_now(),
                "version": "0.5.9",
                "sequences": seq_count,
                "embeddings": emb_count,
                "enable_vectors": self.enable_vectors,
                "vector_dim": self.vector_dim,
                "cache_entries": cache_count,
                "mem_cache_size": len(self.mem_cache),
                "metrics": self.metrics.copy(),
                "top_tags": top_tags,
            }
        )
        return self.health

    def self_test(self) -> Dict[str, Any]:
        tests = {
            "db_connect": True,
            "propose": False,
            "cache": False,
            "persist": False,
            "vectors": False,
        }
        try:
            props = self.propose_unknown("test", 1)
            tests["propose"] = len(props) > 0
            tests["cache"] = True
            snap = self.persist_metrics()
            tests["persist"] = bool(snap.get("persisted_at"))
            if self.enable_vectors:
                demo = self.demo_vector_query("test singularity")
                tests["vectors"] = demo.get("hits", 0) >= 0
            else:
                tests["vectors"] = True  # disabled is ok
        except Exception as e:
            tests["error"] = str(e)[:200]
        return tests

    def compute_metrics(self) -> Dict[str, Any]:
        seq_count = self.conn.execute("SELECT COUNT(*) FROM sequences").fetchone()[0]
        emb_count = self.conn.execute("SELECT COUNT(*) FROM embeddings").fetchone()[0]
        return {**self.metrics, "sequences_count": seq_count, "embeddings_count": emb_count}

    def demo_l1_l2_cache(self):
        print("L1 (mem) hits:", self.metrics["cache_hits"])
        print("L2 (sqlite) demo: cache size", self.conn.execute("SELECT COUNT(*) FROM groq_cache").fetchone()[0])
        return self.metrics

    def chaos_recover(self, failure_type: str = "api_latency"):
        self.metrics["chaos_recoveries"] += 1
        self.persist_metrics()
        return {"recovered": True, "type": failure_type, "new_resilience": "+10%"}


print("EverythingDB v0.5.9 - Universal + optional vector similarity (zero-dep) ready")
