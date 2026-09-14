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


def call_ai(prompt, transports=None, ledger=None, usable=None, start_at=0,
            temperature=None, max_tokens=None, system=None):
    """Unified call contract (twin-identical with orchestrator.mjs callAI).

    Returns { response, provider, model, latency_s, error, ok, fallback, errors }.
    Absorb-and-continue ladder: any failure/empty output skips to the next
    provider; ok=False + fallback=True only when ALL rungs are gone.
    Never raises.
    """
    import time as _time

    t0 = _time.time()
    transports = transports or {}
    ledger = ledger or UsageLedger()
    usable_fn = usable or (lambda pid: pid in transports)
    errors = []
    n = len(MODEL_LADDER)
    for i in range(n):
        idx = (start_at + i) % n
        entry = MODEL_LADDER[idx]
        if not usable_fn(entry["id"]):
            errors.append({"provider": entry["id"], "error": "unusable"})
            continue
        if ledger.used(entry["id"]) >= entry["cap"]:
            errors.append({"provider": entry["id"], "error": "cap-exhausted"})
            continue
        transport = transports.get(entry["id"])
        ledger.record(entry["id"], 1)  # every attempt counts against the cap
        if transport is None:
            errors.append({"provider": entry["id"], "error": "no transport"})
            continue
        opts = {"temperature": temperature, "max_tokens": max_tokens, "system": system}
        try:
            raw = transport(prompt, entry["model"], opts)
            if asyncio.iscoroutine(raw):
                raw = asyncio.get_event_loop().run_until_complete(raw)
            response = str(raw if raw is not None else "").strip()
            if not response:
                errors.append({"provider": entry["id"], "error": "empty response"})
                continue
            return {
                "response": response,
                "provider": entry["id"],
                "model": entry["model"],
                "latency_s": _time.time() - t0,
                "error": None,
                "ok": True,
                "fallback": False,
                "errors": errors,
            }
        except Exception as exc:  # noqa: BLE001 — absorb-and-continue by design
            errors.append({"provider": entry["id"], "error": str(exc)})
    meaningful = next((e for e in errors if e["error"] not in SKIP_KINDS), None)
    last = meaningful["error"] if meaningful else (
        errors[-1]["error"] if errors else "all providers exhausted or unusable"
    )
    return {
        "response": OFFLINE_RESPONSE,
        "provider": "offline",
        "model": "none",
        "latency_s": _time.time() - t0,
        "error": last,
        "ok": False,
        "fallback": True,
        "errors": errors,
    }


def swarm(prompts, **kwargs):
    """Swarm fan-out (multi_ai_orchestrator.py parity): node_i -> result per prompt."""
    return {"node_%d" % i: call_ai(p, **kwargs) for i, p in enumerate(prompts)}


def load_ledger_file(path):
    """Load persisted ledger counts from JSON file; returns {} when missing."""
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data.get("counts", data) if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}


def save_ledger_file(path, ledger):
    """Persist ledger counts to JSON file (mirrors model-governor's model-usage.json)."""
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(ledger.to_json(), fh, indent=2)


class UnifiedOrchestrator:
    """Stateful single-transport runner with rotation (mirrors JS-side usage).

    Wraps call_ai with a fixed transport applied to every ladder rung plus a
    persistent ledger and rotating start_at. Each successful run rotates
    start_at past the winning rung so consecutive calls spread across the
    ladder; failures fall through to the offline-fallback contract.
    """

    def __init__(self, transport=None, ledger=None, start_at=0,
                 temperature=None, max_tokens=None, system=None):
        self.transport = transport or (lambda entry, task: "echo:%s" % task)
        self.ledger = ledger or UsageLedger()
        self.start_at = start_at
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.system = system

    def run(self, task):
        transports = {e["id"]: (lambda p, m, o, _t=self.transport, _e=e: _t(_e, p))
                      for e in MODEL_LADDER}
        result = call_ai(task, transports=transports, ledger=self.ledger,
                         start_at=self.start_at, temperature=self.temperature,
                         max_tokens=self.max_tokens, system=self.system)
        if result["ok"]:
            for i, e in enumerate(MODEL_LADDER):
                if e["id"] == result["provider"]:
                    self.start_at = (i + 1) % len(MODEL_LADDER)
                    break
        return result


def _selftest():
    """Offline self-test: exercises ledger, selection, call_ai, swarm, rotation."""
    failures = []

    def check(name, cond, detail=""):
        print(("  PASS " if cond else "  FAIL ") + name + (" — " + detail if detail and not cond else ""))
        if not cond:
            failures.append(name)

    check("ledger accumulates", UsageLedger().record("cline", 3) == 3)
    l = UsageLedger({"cline": 50}, "2026-01-01", lambda: "2026-01-02")
    l.rollover()
    check("rollover resets", l.used("cline") == 0 and l.today == "2026-01-02")
    check("skips capped", select_provider(ledger=UsageLedger({"cline": 100}))["entry"]["id"] == "huggingface")
    check("rotates start_at", select_provider(start_at=3)["entry"]["id"] == "openrouter")
    full = {e["id"]: e["cap"] for e in MODEL_LADDER}
    check("exhausted -> None", select_provider(ledger=UsageLedger(full)) is None)

    ledger = UsageLedger()
    r = call_ai("ping", ledger=ledger, transports={"gemini": lambda p, m, o: "  pong  "})
    check("success contract", r["ok"] and r["response"] == "pong" and r["provider"] == "gemini"
          and r["model"] == "gemini-2.5-flash" and r["error"] is None and ledger.used("gemini") == 1)

    def boom(prompt, model, opts):
        raise RuntimeError("kaput")

    r = call_ai("ping", transports={"gemini": boom})
    check("absorbs failure walks ladder",
          (not r["ok"]) and r["fallback"] and r["response"] == OFFLINE_RESPONSE
          and r["error"] == "kaput" and len(r["errors"]) == len(MODEL_LADDER))
    r = call_ai("ping", transports={"gemini": lambda p, m, o: "   "})
    check("empty response is error", (not r["ok"]) and r["error"] == "empty response")
    r = call_ai("ping", ledger=UsageLedger(full), transports={})
    check("exhausted offline-fallback", (not r["ok"]) and r["response"] == OFFLINE_RESPONSE)
    nodes = swarm(["a", "b"], transports={"cline": lambda p, m, o: p.upper()})
    check("swarm node_i keys", list(nodes.keys()) == ["node_0", "node_1"]
          and nodes["node_0"]["response"] == "A" and nodes["node_1"]["response"] == "B")
    orch = UnifiedOrchestrator(transport=lambda entry, task: "echo:%s" % task, start_at=1)
    r = orch.run("hi")
    check("orchestrator run+rotate", r["ok"] and r["response"] == "echo:hi"
          and r["provider"] == "huggingface" and orch.start_at == 2)

    print("\n%d/%d selftest checks passed" % (11 - len(failures), 11))
    return 1 if failures else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="unified-core Python twin (offline self-test)")
    parser.add_argument("--selftest", action="store_true", help="run offline self-test")
    args = parser.parse_args()
    if args.selftest or len(sys.argv) == 1:
        sys.exit(_selftest())

