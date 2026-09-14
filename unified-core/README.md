# unified-core

Single model-governance ladder + unified AI call contract for the whole fleet.
**One source of truth, every repo consumes it via a thin bridge — no repo forks
rotation logic anymore.**

## What it is

| File | Role |
|------|------|
| `orchestrator.mjs` | JS ladder engine (source of truth). Node ≥ 18, zero deps. |
| `unified_orchestrator.py` | Python twin — identical semantics. Py ≥ 3.8, zero deps. |
| `manifest.json` | Fleet manifest (**not** a second registry — canonical registry stays `AI-Collaboration-Hub/nexus-core/registry.json`). |
| `test-orchestrator.mjs` | Test harness for the JS engine incl. manifest-parity checks. |
| `cross-training.md` | Which upstream pattern each piece was trained from. |

## The ladder (free-provider rotation, cap-aware)

```
cline (100/day) → huggingface (50/day) → gemini (200/day)
→ openrouter (45/day) → openai-compatible local qwen (9999/day)
```

Semantics fused from three upstream systems:
- **model-governor.ps1** — daily-cap rotation + today-scoped usage ledger
- **groq_wrapper.py** (singularity-operator) — offline-fallback result contract
- **multi_ai_orchestrator.py** (singularity-operator) — swarm fan-out (`node_i` keys)

## Result contract (never throws)

```js
{ response, provider, model, latency_s, error, ok }
// response always present: '[offline-fallback]…' / '[error]…' when not ok
```

## Usage

```js
// Node ESM (direct)
import { callAI, swarm, UsageLedger } from './unified-core/orchestrator.mjs';
const r = await callAI('hi', { transports: { gemini: myGeminiFn } });
```

```js
// CJS consumer (ai-chat-websites)
const { callAI } = require('./Userscripts/tools/unified-bridge.cjs');
const r = await callAI('hi', { transports: { gemini: myGeminiFn } });
```

```python
# Python (singularity-operator)
from unified_bridge import call, swarm
r = call("hi", transports={"gemini": my_gemini_fn})
```

## Selftest

```
node unified-core/test-orchestrator.mjs
python unified-core/unified_orchestrator.py --selftest
```

## Policy

Every repo consumes the same ladder + result contract through additive,
dependency-free bridges (see `manifest.json → cross_training.bridges`).
Changing rotation policy happens **here only**; bridges and twins follow.
