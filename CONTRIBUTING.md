<!-- npm-scripts: ignore-file -->
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

## Merge policy (fleet rule)

**Every PR must be mergeable into `main` without breaking the live path.**

Incomplete work is allowed; incomplete *execution* is not. If multiple files are required and only one lands, the landed code must be inert (feature flag, optional import, or safe stub). At runtime, dead ends remember intended input, take a safe path, and resume when the missing piece arrives. See `docs/MERGE_POLICY.md` and `eric847b/singularity-operator` `MERGE_POLICY.md` + `incomplete_path`.

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
| `npm run gate` | THE quality gate (workspace-gate v3): configs, workflows + live actionlint, lockfiles, engines, Python reqs, hook integrity. `verify`/`health`/`ci` are aliases. |
| `npm run quality` | Full 11-step catalyst series (`tools/run-quality.ps1`). |
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
- [ ] Doc health passes: `npm run docs:links:check && npm run docs:json:check && npm run docs:scripts:check`
- [ ] **Merge policy:** incomplete code is inert; main stays shippable; no force-merge
- [ ] Multi-file features: partial landing is safe (flag/stub) or registers recovery

---

## Step-by-Step Setup Guide for New Contributors

This expanded guide walks you through setting up the entire AI Collaboration Hub workspace from scratch.

### Step 1: Clone and Navigate

```powershell
# Clone the repository (if you haven't already)
git clone https://github.com/eric847b/AI-Collaboration-Hub.git
cd AI-Collaboration-Hub
```

### Step 2: Install Node.js (if needed)

The workspace requires **Node ≥ 26**. Check your version:

```powershell
node --version
```

If you need to install or switch versions:

```powershell
# Using nvm (recommended)
nvm install 26
nvm use 26

# Verify
node --version  # Should show v26.x.x
```

**Note:** Node v24.x will work but shows an informational warning in the gate.

### Step 3: Bootstrap All Dependencies

```powershell
# From the workspace root
npm run bootstrap
```

This installs all Node and Python dependencies for all projects automatically.

### Step 4: Verify Setup with Quality Gate

```powershell
npm run gate
```

### Step 5: Run Tests

```powershell
cd collabhub-modules
npm test
```

### Step 6: Try the Free AI CLI

```powershell
npm run ai -- "explain quantum computing"
```

### Step 7: Set Up VS Code (Recommended)

1. Open the workspace in VS Code
2. Install recommended extensions from `.vscode/extensions.json`
3. Policy reminder lives in `.vscode/settings.json` (always-mergeable PRs)

### Step 8–10

See full layout, quality series, and first contribution steps in the repo history / `docs/`. Prefer short-lived branches and early merge under the merge policy.

---

*Last updated: 2026-10-31 · Merge policy + incomplete-path recovery*
