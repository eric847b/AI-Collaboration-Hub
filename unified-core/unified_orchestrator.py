#!/usr/bin/env python3
"""unified-core v1.0.0 — Python twin of orchestrator.mjs (identical semantics).

Cross-trained from:
  - model-governor.ps1                   : cap-aware FREE-provider rotation + ledger
  - singularity-operator/groq_wrapper.py : offline-fallback result contract
  - singularity-operator/multi_ai_orchestrator.py : swarm fan-out (node_i keys)
  - nexus-core/registry.json             : module manifest + roles

Zero dependencies. Python >= 3.8. Source of truth for the ladder lives in
orchestrator.mjs / manifest.json; this twin mirrors it for Python consumers.

Unified call contract (twin-identical with orchestrator.mjs callAI):
  { response, provider, model, latency_s, error, ok, fallback, errors }
Absorb-and-continue ladder: any transport failure/empty output skips to the
next provider; ok:false + fallback:true only when ALL rungs are gone.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone

VERSION = "1.0.0"

MODEL_LADDER = [
    {"id": "cline", "model": "stealth/ox-alpha", "cap": 100},
    {"id": "huggingface", "model": "deepseek-ai/DeepSeek-V4-Flash-0731", "cap": 50},
    {"id": "gemini", "model": "gemini-2.5-flash", "cap": 200},
    {"id": "openrouter", "model": "nvidia/nemotron-3.5-lightning:free", "cap": 45},
    {"id": "openai-compatible", "model": "qwen2.5-coder:3b", "cap": 9999},
]

SKIP_KINDS = ("unusable", "no transport", "cap-exhausted")
OFFLINE_RESPONSE = "[offline-fallback] no free slot with remaining capacity."


def date_stamp(now=None):
    if now is None:
        now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%d")


class UsageLedger:
    """Today-scoped usage ledger (mirrors model-governor's model-usage.json shape).

    `clock` is injectable (-> 'YYYY-MM-DD') so tests and ledger replays can pin
    a date; production callers get the real UTC date via the default.
    """

    def __init__(self, initial=None, today=None, clock=date_stamp):
        self.clock = clock
        self.today = today if today is not None else clock()
        counts = {e["id"]: 0 for e in MODEL_LADDER}
        counts.update(initial or {})
        self.counts = counts

    def rollover(self, today=None):
        if today is None:
            today = self.clock()
        if today != self.today:
            self.today = today
            for e in MODEL_LADDER:
                self.counts[e["id"]] = 0
        return self

    def record(self, provider_id, amount=1):
        self.rollover()
        self.counts[provider_id] = self.counts.get(provider_id, 0) + amount
        return self.counts[provider_id]

    def used(self, provider_id):
        self.rollover()
        return self.counts.get(provider_id, 0)

    def to_json(self):
        return {"date": self.today, "counts": dict(self.counts)}


def select_provider(ledger=None, usable=None, start_at=0):
    """Pick the first usable provider under its daily cap, starting at start_at."""
    ledger = ledger or UsageLedger()
    usable = usable or (lambda pid: True)
    n = len(MODEL_LADDER)
    for i in range(n):
        idx = (start_at + i) % n
        entry = MODEL_LADDER[idx]
        if not usable(entry["id"]):
            continue
        if ledger.used(entry["id"]) >= entry["cap"]:
            continue
        return {"entry": entry, "index": idx}
    return None
