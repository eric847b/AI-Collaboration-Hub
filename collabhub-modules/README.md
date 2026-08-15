# collabhub-modules

CollabHub Userscript Modules and Tools

## Free-AI Seamless Rotator

- `src/rotator.js` — **transport-agnostic core**: rotates across a pool of free
  AI endpoints and fails over instantly on `429`/`5xx`/exhaustion (no pause),
  so work never stops. Reusable in Node and userscripts (one core everywhere).
- `FreeAIRotator.module.user.js` — Tampermonkey userscript wrapper (keys in
  `GM_getValue`, transport via `GM_xmlhttpRequest`).
- `run-ai.js` — Node CLI runner using global `fetch` (`npm run ai -- "task..."`).
- `test/rotator.test.js` — off-line failover test (no network).
  Run with: `npm test` (asserts `429 → 500 → 200` rotation in <1 ms).

### Free providers in the default pool (keys via env, never hardcoded)

| Provider          | Env var              | Model                                         |
| ----------------- | -------------------- | --------------------------------------------- |
| Groq (free)       | `GROQ_API_KEY`       | `llama-3.3-70b-versatile`                     |
| Google Gemini     | `GOOGLE_API_KEY`     | `gemini-1.5-flash`                            |
| Together          | `TOGETHER_API_KEY`   | `meta-llama/Meta-Llama-3.1-8b-instruct-turbo` |
| OpenRouter (free) | `OPENROUTER_API_KEY` | `meta-llama/llama-3-8b:free`                  |

Ready to use: `npm test` — then set at least one free key, e.g. `export GROQ_API_KEY=...`, and run `npm run ai`. The rotator round‑robins across all configured providers and skips any that 429/5xx/throw, so work keeps moving.
