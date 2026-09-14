#!/usr/bin/env python3
"""unified-core parity tests (stdlib only) — mirrors unified-core/test-orchestrator.mjs.

Run: python unified-core/test_unified_orchestrator.py
"""
import io
import json
import os
import sys
import unittest
from contextlib import redirect_stdout

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from unified_orchestrator import (  # noqa: E402
    MODEL_LADDER, OFFLINE_RESPONSE, VERSION, UsageLedger, UnifiedOrchestrator,
    call_ai, load_ledger_file, save_ledger_file, select_provider, swarm,
)


class LedgerTests(unittest.TestCase):
    def test_record_used_accumulates(self):
        l = UsageLedger()
        l.record("cline")
        l.record("cline", 2)
        self.assertEqual(l.used("cline"), 3)

    def test_rollover_resets_on_new_day_clock_driven(self):
        l = UsageLedger({"cline": 50}, "2026-01-01", lambda: "2026-01-02")
        l.rollover()
        self.assertEqual(l.used("cline"), 0)
        self.assertEqual(l.today, "2026-01-02")

    def test_explicit_rollover_resets_and_stays_pinned(self):
        l = UsageLedger({"cline": 50}, "2026-01-01", lambda: "2026-01-01")
        l.rollover("2026-01-02")
        self.assertEqual(l.today, "2026-01-02")
        self.assertEqual(l.counts["cline"], 0)
        l.record("cline")
        self.assertEqual(l.used("cline"), 1)


class SelectionTests(unittest.TestCase):
    def test_skips_capped_providers(self):
        l = UsageLedger({"cline": 100})
        self.assertEqual(select_provider(ledger=l)["entry"]["id"], "huggingface")

    def test_respects_usable(self):
        pick = select_provider(usable=lambda pid: pid == "gemini")
        self.assertEqual(pick["entry"]["id"], "gemini")

    def test_rotates_with_start_at(self):
        self.assertEqual(select_provider(start_at=3)["entry"]["id"], "openrouter")

    def test_returns_none_when_exhausted(self):
        full = {e["id"]: e["cap"] for e in MODEL_LADDER}
        self.assertIsNone(select_provider(ledger=UsageLedger(full)))


class CallAITests(unittest.TestCase):
    def test_success_contract(self):
        ledger = UsageLedger()
        r = call_ai("ping", ledger=ledger, transports={"gemini": lambda p, m, o: "  pong  "})
        self.assertTrue(r["ok"])
        self.assertEqual(r["response"], "pong")
        self.assertEqual(r["provider"], "gemini")
        self.assertEqual(r["model"], "gemini-2.5-flash")
        self.assertIsNone(r["error"])
        self.assertFalse(r["fallback"])
        self.assertEqual(ledger.used("gemini"), 1)

    def test_absorbs_transport_failure_walks_full_ladder(self):
        def boom(prompt, model, opts):
            raise RuntimeError("kaput")

        r = call_ai("ping", transports={"gemini": boom})
        self.assertFalse(r["ok"])
        self.assertTrue(r["fallback"])
        self.assertEqual(r["response"], OFFLINE_RESPONSE)
        self.assertEqual(r["error"], "kaput")  # first non-skip failure surfaced
        self.assertEqual(len(r["errors"]), len(MODEL_LADDER))  # every rung visited

    def test_empty_response_is_error(self):
        r = call_ai("ping", transports={"gemini": lambda p, m, o: "   "})
        self.assertFalse(r["ok"])
        self.assertEqual(r["error"], "empty response")

    def test_offline_fallback_when_exhausted(self):
        full = {e["id"]: e["cap"] for e in MODEL_LADDER}
        r = call_ai("ping", ledger=UsageLedger(full), transports={})
        self.assertFalse(r["ok"])
        self.assertEqual(r["response"], OFFLINE_RESPONSE)

    def test_attempt_counts_against_cap_even_on_failure(self):
        ledger = UsageLedger()
        call_ai("ping", ledger=ledger, transports={"cline": lambda p, m, o: None})
        self.assertEqual(ledger.used("cline"), 1)

    def test_swarm_node_keys(self):
        nodes = swarm(["a", "b"], transports={"cline": lambda p, m, o: p.upper()})
        self.assertEqual(list(nodes.keys()), ["node_0", "node_1"])
        self.assertEqual(nodes["node_0"]["response"], "A")
        self.assertEqual(nodes["node_1"]["response"], "B")


class OrchestratorTests(unittest.TestCase):
    def test_single_transport_run_and_rotation(self):
        orch = UnifiedOrchestrator(
            transport=lambda entry, task: "echo:%s" % task, start_at=1
        )
        r = orch.run("hi")
        self.assertTrue(r["ok"])
        self.assertEqual(r["response"], "echo:hi")
        self.assertEqual(r["provider"], "huggingface")  # start_at=1
        self.assertEqual(orch.start_at, 2)  # rotated past success

    def test_ledger_file_roundtrip(self):
        path = os.path.join(
            os.environ.get("TEMP", "/tmp"), "unified-core-test-ledger.json"
        )
        l = UsageLedger({"cline": 7})
        save_ledger_file(path, l)
        loaded = load_ledger_file(path)
        self.assertEqual(loaded.get("cline"), 7)
        os.remove(path)


if __name__ == "__main__":
    unittest.main(verbosity=2)
