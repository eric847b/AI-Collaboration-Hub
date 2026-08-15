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

Ready to use: `npm test` — then set a free key (e.g. `GROQ_API_KEY`) and run `npm run ai`.
