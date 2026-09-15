"""BrowserAutomation v0.5.8 - Measurable live self-evo browser/smoke path.

Stdlib-first: HTTP reachability + content probes against public endpoints.
Optional Playwright when installed. Results feed EverythingDB + evolution_summary.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

try:
    import requests
except ImportError:  # pragma: no cover
    requests = None  # type: ignore


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


# Safe public targets for CI / live smoke (no auth required)
DEFAULT_SMOKE_TARGETS = [
    {"url": "https://github.com/eric847b/singularity-operator", "expect": "singularity"},
    {"url": "https://github.com/eric847b/autonomous-github-agent", "expect": "autonomous"},
    {"url": "https://api.github.com/zen", "expect": None},
]


class BrowserAutomation:
    """Browser / web smoke hooks for self-evo tests."""

    def __init__(self, headless: bool = True):
        self.headless = headless
        self.session_metrics: Dict[str, Any] = {
            "actions": 0,
            "captures": 0,
            "smoke_ok": 0,
            "smoke_fail": 0,
            "latency_ms": [],
        }
        self.log: List[Dict[str, Any]] = []

    def capture_screen(self, description: str = "current view") -> Dict[str, Any]:
        """Logical capture record (real screenshot needs Playwright/OS hooks)."""
        self.session_metrics["captures"] += 1
        entry = {
            "status": "captured",
            "description": description,
            "timestamp": _utc_now(),
            "metrics": dict(self.session_metrics),
        }
        self.log.append(entry)
        return entry

    def simulate_input(
        self, action: str, target: str, value: Optional[str] = None
    ) -> Dict[str, Any]:
        self.session_metrics["actions"] += 1
        entry = {
            "status": "simulated",
            "action": action,
            "target": target,
            "value": value,
            "timestamp": _utc_now(),
        }
        self.log.append(entry)
        return entry

    def decide_and_act(self, goal: str, context: Dict) -> str:
        return f"Decided action for goal '{goal}' based on context keys={list(context.keys())[:6]}"

    def http_probe(self, url: str, expect_substring: Optional[str] = None, timeout: int = 12) -> Dict[str, Any]:
        """Stdlib/requests GET probe — measurable without a full browser."""
        if requests is None:
            return {"ok": False, "url": url, "error": "requests not installed"}
        start = time.time()
        try:
            r = requests.get(
                url,
                timeout=timeout,
                headers={"User-Agent": "SingularityOperator-BrowserAutomation/0.5.8"},
            )
            ms = int((time.time() - start) * 1000)
            self.session_metrics["latency_ms"].append(ms)
            self.session_metrics["actions"] += 1
            text = (r.text or "")[:4000]
            ok = r.status_code == 200
            if ok and expect_substring:
                ok = expect_substring.lower() in text.lower()
            if ok:
                self.session_metrics["smoke_ok"] += 1
            else:
                self.session_metrics["smoke_fail"] += 1
            entry = {
                "ok": ok,
                "url": url,
                "status_code": r.status_code,
                "latency_ms": ms,
                "expect": expect_substring,
                "snippet": text[:120].replace("\n", " "),
                "timestamp": _utc_now(),
            }
            self.log.append(entry)
            return entry
        except Exception as e:
            self.session_metrics["smoke_fail"] += 1
            entry = {"ok": False, "url": url, "error": str(e)[:200], "timestamp": _utc_now()}
            self.log.append(entry)
            return entry

    def run_smoke_suite(
        self, targets: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Run a batch of public probes — the live self-evo browser test."""
        targets = targets or DEFAULT_SMOKE_TARGETS
        results = []
        for t in targets:
            results.append(
                self.http_probe(t["url"], expect_substring=t.get("expect"))
            )
        ok = sum(1 for r in results if r.get("ok"))
        fail = len(results) - ok
        summary = {
            "suite": "browser_smoke",
            "total": len(results),
            "ok": ok,
            "fail": fail,
            "pass_rate": round(ok / max(len(results), 1), 3),
            "results": results,
            "metrics": self.get_metrics(),
            "timestamp": _utc_now(),
        }
        self.capture_screen(f"smoke suite complete ok={ok}/{len(results)}")
        return summary

    def try_playwright_nav(self, url: str = "https://example.com") -> Dict[str, Any]:
        """Optional Playwright path when package is installed."""
        try:
            from playwright.sync_api import sync_playwright  # type: ignore
        except Exception:
            return {"ok": False, "skipped": True, "reason": "playwright not installed"}
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=self.headless)
                page = browser.new_page()
                page.goto(url, timeout=20000)
                title = page.title()
                browser.close()
            self.session_metrics["actions"] += 1
            self.session_metrics["captures"] += 1
            return {"ok": True, "url": url, "title": title, "timestamp": _utc_now()}
        except Exception as e:
            return {"ok": False, "error": str(e)[:200]}

    def get_metrics(self) -> Dict[str, Any]:
        lat = self.session_metrics.get("latency_ms") or []
        avg = round(sum(lat) / len(lat), 1) if lat else 0
        return {**self.session_metrics, "avg_latency_ms": avg, "log_len": len(self.log)}

    def summary_line(self) -> str:
        m = self.get_metrics()
        return (
            f"Browser: actions={m.get('actions', 0)} "
            f"smoke_ok={m.get('smoke_ok', 0)} smoke_fail={m.get('smoke_fail', 0)} "
            f"avg_ms={m.get('avg_latency_ms', 0)}"
        )


print("BrowserAutomation v0.5.8 - Live smoke + optional Playwright ready")
