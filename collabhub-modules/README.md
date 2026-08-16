# collabhub-modules

CollabHub Userscript Modules and Tools

## Free-AI Seamless Rotator

- `src/rotator.js` — **transport-agnostic core**: rotates across a pool of free
  AI endpoints and fails over instantly on `429`/`5xx`/exhaustion (no pause),
  so work never stops. Reusable in Node and userscripts (one core everywhere).
- `FreeAIRotator.module.user.js` — Tampermonkey userscript that injects a
  floating `💬 FreeAI` button into any page; rotates across free endpoints and
  docks the result card. Keys in `GM_getValue`, transport via `GM_xmlhttpRequest`.
- `run-ai.js` — Node CLI runner using global `fetch` (`npm run ai -- "task..."`).
- `test/rotator.test.js` — off-line failover test (no network).
  Run with: `npm test` (asserts `429 → 500 → 200` rotation in <1 ms).

### Free providers in the default pool (keys via env / GM, never hardcoded)

| Provider          | Env / GM key         | Model                                         |
| ----------------- | -------------------- | --------------------------------------------- |
| Ollama (local)    | `OLLAMA_MODEL`       | `phi3:mini`                                   |
| LM Studio (local) | `LMSTUDIO_MODEL`     | `phi-3-mini-4k`                               |
| LocalAI (local)   | `LOCALAI_MODEL`      | `phi-3-mini-4k`                               |
| Hugging Face      | `HF_API_KEY`         | `mistralai/Mistral-7B-Instruct-v0.2`          |
| Groq (free)       | `GROQ_API_KEY`       | `llama-3.3-70b-versatile`                     |
| Google Gemini     | `GOOGLE_API_KEY`     | `gemini-1.5-flash`                            |
| Together          | `TOGETHER_API_KEY`   | `meta-llama/Meta-Llama-3.1-8b-instruct-turbo` |
| OpenRouter (free) | `OPENROUTER_API_KEY` | `meta-llama/llama-3-8b:free`                  |

> **Permanent-free first:** local providers (Ollama/LM Studio/LocalAI) run on
> your own hardware — no key, quota that never expires. If a local server is
> off, the rotator skips it instantly and moves to the next lane. Cloud free
> tiers rotate behind them so a rate-limited key never pauses work.

**Scale to 25+:** export a JSON array of provider objects in
`FREE_AI_PROVIDERS_JSON` (shape `{name, endpoint, headers, body, extract}`) to
replace the built-in pool entirely.

Ready to use: `npm test` — then start a local server or set any free key, e.g.
`export GROQ_API_KEY=...`, and run `npm run ai`. The rotator round-robins
across all configured providers and skips any that 429/5xx/throw, so work
keeps moving indefinitely.
