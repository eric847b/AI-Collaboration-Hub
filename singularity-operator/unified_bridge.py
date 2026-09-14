#!/usr/bin/env python3
"""singularity-operator -> unified-core bridge.

Additive + dependency-free: delegates ladder selection to the unified twin,
preserving groq_wrapper's offline-fallback result contract. Degrades to an
explicit offline-fallback if unified-core is not present (never crashes).

Source of truth: <repo-root>/unified-core/ — do NOT fork rotation logic here.
"""
from __future__ import annotations

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_CORE = os.path.join(os.path.dirname(_HERE), "unified-core")
if _CORE not in sys.path:
    sys.path.insert(0, _CORE)

try:
    import unified_orchestrator as core  # unified-core python twin
except ImportError:  # degraded mode — repo checked out standalone
    core = None


def call(prompt, transports=None, start_at=0, **opts):
    """Route one prompt through the unified ladder (groq_wrapper contract)."""
    if core is not None:
        return core.call_ai(prompt, transports=transports or {}, start_at=start_at, **opts)
    return {"response": "[offline-fallback] unified-core not linked",
            "provider": "", "model": "", "latency_s": 0.0,
            "error": "unified-core missing", "ok": False}


def swarm(prompts, **opts):
    """Fan out prompts through the unified ladder (node_i keys)."""
    if core is not None:
        return core.swarm(prompts, **opts)
    return {"node_%d" % i: call(p, **opts) for i, p in enumerate(prompts)}


if __name__ == "__main__":
    result = call("ping", transports={"cline": lambda p, m, o: "pong:" + p})
    print(result)
