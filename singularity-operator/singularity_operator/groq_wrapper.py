#!/usr/bin/env python3
"""Groq multi-provider router — singularity-operator v0.6 / groq SDK ≥1.6.

Missing module restored. Public API expected by the package:
  - call_ai(prompt, provider="groq") -> {"response": str, "provider": str, ...}
  - get_provider_status() -> dict
  - GroqWrapper (CLI metrics + chat)
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional

log = logging.getLogger("groq_wrapper")

# Prefer current free/fast Groq models; override via GROQ_MODEL
DEFAULT_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
FALLBACK_MODELS = [
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
]


def _get_client():
    api_key = os.getenv("GROQ_API_KEY") or os.getenv("GROQ_KEY")
    if not api_key:
        return None, "GROQ_API_KEY not set"
    try:
        from groq import Groq

        return Groq(api_key=api_key), None
    except ImportError:
        return None, "groq package not installed (pip install 'groq>=1.6.0')"
    except Exception as e:
        return None, str(e)


def call_ai(
    prompt: str,
    provider: str = "groq",
    model: Optional[str] = None,
    system: Optional[str] = None,
    max_tokens: int = 2048,
    temperature: float = 0.4,
) -> Dict[str, Any]:
    """Unified AI call. Returns dict with 'response' key (SelfImprover / EverythingDB contract)."""
    start = time.time()
    out: Dict[str, Any] = {
        "response": "",
        "provider": provider,
        "model": model or DEFAULT_MODEL,
        "latency_s": 0.0,
        "error": None,
        "ok": False,
    }

    if provider not in ("groq", "auto", ""):
        # Reserved for future multi-provider routing
        out["error"] = f"Unsupported provider '{provider}' in this build (use groq)"
        out["response"] = f"[fallback] Provider {provider} not wired. Prompt length={len(prompt)}"
        out["latency_s"] = time.time() - start
        return out

    client, err = _get_client()
    if client is None:
        out["error"] = err
        out["response"] = (
            f"[offline-fallback] {err}. "
            f"Set GROQ_API_KEY for live inference. Prompt preview: {prompt[:120]!r}"
        )
        out["latency_s"] = time.time() - start
        return out

    messages: List[Dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    models_try = [model or DEFAULT_MODEL] + [m for m in FALLBACK_MODELS if m != (model or DEFAULT_MODEL)]
    last_err = None
    for m in models_try:
        try:
            completion = client.chat.completions.create(
                model=m,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            text = ""
            if completion.choices:
                text = (completion.choices[0].message.content or "").strip()
            out["response"] = text
            out["model"] = m
            out["ok"] = bool(text)
            out["latency_s"] = time.time() - start
            if hasattr(completion, "usage") and completion.usage:
                out["usage"] = {
                    "prompt_tokens": getattr(completion.usage, "prompt_tokens", None),
                    "completion_tokens": getattr(completion.usage, "completion_tokens", None),
                    "total_tokens": getattr(completion.usage, "total_tokens", None),
                }
            return out
        except Exception as e:
            last_err = str(e)
            log.warning("Groq model %s failed: %s", m, e)
            continue

    out["error"] = last_err or "all models failed"
    out["response"] = f"[error] {out['error']}"
    out["latency_s"] = time.time() - start
    return out


def get_provider_status() -> Dict[str, Any]:
    client, err = _get_client()
    return {
        "groq_installed": err is None or "not installed" not in (err or ""),
        "api_key_present": bool(os.getenv("GROQ_API_KEY") or os.getenv("GROQ_KEY")),
        "client_ok": client is not None,
        "default_model": DEFAULT_MODEL,
        "error": err,
        "sdk": "groq>=1.6",
    }


class GroqWrapper:
    """Stateful helper used by CLI and orchestrator hooks."""

    def __init__(self, model: Optional[str] = None):
        self.model = model or DEFAULT_MODEL
        self.calls = 0
        self.errors = 0
        self.total_latency = 0.0
        self.last_response: Optional[str] = None

    def call(self, prompt: str, **kwargs) -> str:
        result = call_ai(prompt, provider="groq", model=kwargs.get("model", self.model))
        self.calls += 1
        self.total_latency += float(result.get("latency_s") or 0)
        if result.get("error") or not result.get("ok"):
            self.errors += 1
        self.last_response = result.get("response") or ""
        return self.last_response

    def get_metrics(self) -> Dict[str, Any]:
        avg = (self.total_latency / self.calls) if self.calls else 0.0
        return {
            "calls": self.calls,
            "errors": self.errors,
            "avg_latency_s": round(avg, 3),
            "model": self.model,
            "provider_status": get_provider_status(),
        }


# Alias used by multi_ai_orchestrator demo snippet
class SingularityGroq(GroqWrapper):
    pass
