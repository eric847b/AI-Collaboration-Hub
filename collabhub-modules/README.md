# collabhub-modules — Userscript Suite

## Suite analysis (2026-10-14)

| Component | Role | Status |
|-----------|------|--------|
| **FreeAIRotator.module.user.js** (v1.2) | Production free-AI engine | **Canonical** — real API calls, failover, Pollinations no-key, fleet context |
| `src/rotator.js` + `run-ai.js` | Node core of the same engine | Shared with CLI / continuous loops |
| 22 / 23 / 25 / 99 Nexus modules | Experimental UI panels (minified) | Legacy / experimental — mostly simulated responses; not wired to free pool |
| Standalone `eric847b/collabhub-modules` | Thin mirror of Nexus scripts | Prefer monorepo copy under AI-Collaboration-Hub |

**Recommendation:** Use **FreeAIRotator** for all free-AI continuous work. Nexus modules are historical experiments; do not treat them as the live free-AI path.

---

## Free-AI Seamless Rotator (v1.2)

- `src/rotator.js` — transport-agnostic core (Node + userscripts).
- `FreeAIRotator.module.user.js` — Tampermonkey script:
  - Floating **💬 FreeAI** on every page
  - Menu **🚀 Your choice (fleet context)** — one-click continuous-development prompt with full fleet awareness
  - Local → Pollinations no-key → free cloud tiers, never pauses
- `run-ai.js` — Node CLI (`npm run ai -- "task..."`)

### Free providers

| Provider | Key? | Notes |
|----------|------|-------|
| Ollama / LM Studio / LocalAI | No | Permanent free, local |
| **Pollinations** | **No** | Zero-key cloud |
| Groq / Gemini / Together / OpenRouter / HF | Optional free keys | Failover lanes |

### Menu commands
- 🚀 **Your choice (fleet context)** — highest-leverage continuous prompt
- 🤖 Run prompt (seamless rotation)
- ⚙ Set free API keys (Groq, Gemini, Together, OpenRouter, HF)

**Scale to 25+:** set `FREE_AI_PROVIDERS_JSON` (Node) to replace the pool.

Ready: `npm test` then `npm run ai -- "your choice"` or install the userscript and use **🚀 Your choice**.
