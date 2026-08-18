# Contributing

First off — thanks for taking the time to contribute! 🎉

This guide explains how to set up the workspace, run the FreeAI rotator test
gate, and add a new free AI provider. For general issues or larger ideas, open
a GitHub Issue first to discuss.

## Prerequisites

- **Node ≥ 26** (see `.nvmrc` / `engines`). Use `nvm use 26`.
- PowerShell 7+ on Windows, or `bash` on macOS/Linux.
- Optional for live results: `ollama`, `lm-studio`, `localai`, or any free API key.
- Follow the formatting rules in `.editorconfig`.

## Quick Start

```powershell
# 1. Bootstrap all workspace dependencies (from the root):
.\tools\bootstrap.ps1

# 2. Run the FreeAI rotator test gate locally:
cd collabhub-modules
npm test                 # 18 checks: 8 core + 10 userscript DOM

# 3. Try the CLI:
cd ..
npm run ai -- "summarize this"
```

All tests are **offline** and require no API keys or network.

## Workspace Scripts

From the **workspace root**:

| Script | Description |
| --- | --- |
| `npm run ai` | FreeAI permanent-free rotator CLI (`collabhub-modules/run-ai.js`). |
| `npm run health` | Validate lockfiles and CI config across every project. |
| `npm run verify` | Check shared configs, project folders, and workflows. |
| `npm run ci` | Run `verify` + `health`. |
| `tools\run-quality.ps1` | Full quality pipeline (lint → test → audit → build → summary). |

## Project Layout

```text
AI-Collaboration-Hub/            ← registry + docs + CI
├── collabhub-modules/
│   ├── src/rotator.js           ← transport-agnostic core (Node + userscript)
│   ├── src/rotator.mjs          ← ESM façade (FreeAirRotator, delay, …)
│   ├── FreeAIRotator.module.user.js
│   ├── run-ai.js                ← CLI entry point
│   ├── examples/local-proof.js  ← offline failover demo
│   └── test/                    ← 18 offline checks
├── nexus-infinity-hub/          ← pulls in `npm run ai`
├── self-evolve-dash/
├── singularity-operator/
└── …
```

## Running Tests

```powershell
cd collabhub-modules
npm test                       # 8 core + 10 userscript DOM  ⇒ 18/18
npm run test:local             # offline failover demo (~19 ms)
```

## Adding a New Free Provider

The rotator reads its pool from `src/rotator.js` (`defaultProviders`). To add a
lane, fork/clone, then:

1. Add an entry to `defaultProviders` in `src/rotator.js`:
   ```json
   {
     "name": "ExampleModel",
     "endpoint": "https://api.example.com/v1/chat/completions",
     "headers": { "Authorization": "Bearer ${EXAMPLE_API_KEY}" },
     "body": { ...provider-specific... },
     "extract": "choices.0.message.content"
   }
   ```
2. Update the provider table in `collabhub-modules/README.md`.
3. Run `npm test` (and `npm run test:local`) to confirm.
4. Commit with `feat(rotator): add ExampleModel lane` and open a PR.

> Keys are never hardcoded — resolved from `GM_getValue` (userscript) or env
> vars (CLI). Set `FREE_AI_PROVIDERS_JSON` to a JSON array of provider objects
> to replace the whole pool.

## Running with a Local LLM

For completely free, quota-less results, run a local server. The rotator
detects it automatically and skips local lanes cleanly when the server is off.

```powershell
# Option A — Ollama:
ollama serve
ollama pull phi3:mini

# Option B — LM Studio:
lm-studio --port 1234   # default phi-3-mini model

# Then, from the root:
npm run ai -- "explain transformers"
#   → local lane responds; no key, no quota, no pauses.
```

## Pull Request Checklist

- [ ] Tests pass: `cd collabhub-modules && npm test`
- [ ] Offline proof passes: `npm run test:local`
- [ ] `npm run ai -- "hi"` exits gracefully (rotates pool, no hang)
- [ ] Pre-commit hooks pass: `npx lint-staged`
- [ ] README / provider table updated (if you added a lane)
- [ ] No secrets committed — keys come from env / `GM_getValue`
