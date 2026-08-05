#!/usr/bin/env python3
"""
Nexus Consensus (v6.0) — collaborative multi-role AI inspired by CollabHub userscripts.

Roles (from OmniNexus / UltimateNexus patterns):
  Planner → Researcher → Critic → Forge → Echo

Each role can prefer a different provider. Results are merged into a single
actionable consensus with confidence score.
"""

from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, List, Optional

ROLE_PROVIDER = {
    "Planner": "auto",
    "Researcher": "auto",
    "Critic": "auto",
    "Forge": "auto",
    "Echo": "auto",
}

ROLE_PROMPTS = {
    "Planner": (
        "You are the Planner. Break the task into 3–7 concrete steps. "
        "Prefer minimal, high-ROI actions. Output JSON: {\"steps\": [\"...\"]}"
    ),
    "Researcher": (
        "You are the Researcher. Given the task and plan, list risks, "
        "dependencies, and any missing context. Output JSON: "
        "{\"risks\": [], \"deps\": [], \"notes\": []}"
    ),
    "Critic": (
        "You are the Critic. Challenge the plan. Flag anything unsafe, "
        "over-scoped, or likely to break CI. Output JSON: "
        "{\"blockers\": [], \"warnings\": [], \"approve\": true/false}"
    ),
    "Forge": (
        "You are the Forge. Produce the smallest correct change set. "
        "If code is needed, describe exact file paths and patches. "
        "Output JSON: {\"actions\": [{\"type\": \"...\", \"path\": \"...\", \"summary\": \"...\"}]}"
    ),
    "Echo": (
        "You are the Echo. Summarize the consensus for humans in 5 lines max. "
        "Output plain text."
    ),
}


def _safe_json(text: str) -> Any:
    text = (text or "").strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)
    try:
        return json.loads(text)
    except Exception:
        return {"raw": text[:2000]}


def run_consensus(
    task: str,
    call_llm_fn,
    profile=None,
    roles: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Run multi-role consensus on a task string.
    call_llm_fn(prompt, provider='auto', profile=None) -> str
    """
    roles = roles or list(ROLE_PROMPTS.keys())
    transcript: List[Dict[str, str]] = []
    context = f"TASK:\n{task}\n"

    for role in roles:
        system = ROLE_PROMPTS.get(role, "You are a helpful collaborator.")
        prompt = f"{system}\n\n{context}\n\nRespond now."
        provider = ROLE_PROVIDER.get(role, "auto")
        start = time.time()
        try:
            out = call_llm_fn(prompt, provider=provider, profile=profile) or ""
        except Exception as e:
            out = f"[role error: {e}]"
        latency = time.time() - start
        transcript.append({"role": role, "content": out[:4000], "latency": round(latency, 2)})
        context += f"\n### {role}\n{out[:1500]}\n"
    critic_raw = next((t["content"] for t in transcript if t["role"] == "Critic"), "")
    forge_raw = next((t["content"] for t in transcript if t["role"] == "Forge"), "")
    critic = _safe_json(critic_raw)
    forge = _safe_json(forge_raw)
    approve = True
    if isinstance(critic, dict) and "approve" in critic:
        approve = bool(critic.get("approve"))
    actions = []
    if isinstance(forge, dict):
        actions = forge.get("actions") or []

    confidence = 0.5
    if approve:
        confidence += 0.25
    if actions:
        confidence += 0.2
    if len(transcript) >= 4:
        confidence += 0.05

    echo = next((t["content"] for t in transcript if t["role"] == "Echo"), "")

    return {
        "version": "6.0",
        "task": task[:500],
        "approve": approve,
        "confidence": round(min(confidence, 1.0), 2),
        "actions": actions,
        "echo": echo[:1000],
        "transcript": transcript,
        "critic": critic if isinstance(critic, dict) else {},
        "forge": forge if isinstance(forge, dict) else {},
    }
