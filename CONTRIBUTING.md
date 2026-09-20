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

**What it does:**
- Installs Node dependencies for all projects with `package.json`
- Installs Python dependencies for all projects with `requirements.txt`
- No hardcoded project lists — auto-discovers all projects

### Step 4: Verify Setup with Quality Gate

```powershell
# Run the quality gate (THE primary check)
npm run gate
```

**Expected output:**
```
Status: PASS
Passed=22 Failed=0 Warnings=1
  warn: node v24.14.0 < engines requirement >= 26 (npm not engine-strict; informational)
```

**If gate fails:**
- Read the error messages — they tell you exactly what's wrong
- Common issues: missing lockfiles, missing requirements.txt, workflow issues
- See `docs/TROUBLESHOOTING.md` for detailed solutions

### Step 5: Run Tests

Test different projects to ensure everything works:

```powershell
# collabhub-modules (18 checks)
cd collabhub-modules
npm test

# nexus-infinity-hub (Node/React)
cd ../nexus-infinity-hub
npm run test

# self-evolve-dash (Node/React)
cd ../self-evolve-dash
npm run test

# Python projects
cd ../singularity-operator
pytest
```

### Step 6: Try the Free AI CLI

```powershell
# From workspace root
npm run ai -- "explain quantum computing"
```

This rotates through free AI providers. No API keys required for basic functionality.

**Optional:** For live results, configure providers in `collabhub-modules/src/rotator.js` or set `FREE_AI_PROVIDERS_JSON` environment variable.

### Step 7: Set Up VS Code (Recommended)

1. **Open the workspace in VS Code**
2. **Install recommended extensions:**
   - VS Code will prompt you to install extensions from `.vscode/extensions.json`
   - Or manually install: ESLint, Prettier, Playwright, etc.

3. **Key shortcuts:**
   - **Ctrl+Shift+B** — Run build task (runs `npm run gate`)
   - **F5** — Debug (with breakpoints)
   - **Ctrl+` ** — Integrated terminal

### Step 8: Understand the Project Structure

```text
AI-Collaboration-Hub/
├── docs/                    # Documentation (ROADMAP.md, STATUS.md, etc.)
├── tools/                   # Workspace tools (workspace-gate.ps1, etc.)
├── .vscode/                 # VS Code configuration (extensions.json, tasks.json)
├── .github/workflows/       # CI/CD workflows (24 workflows)
├── nexus-infinity-hub/      # Main React hub (Vite, TypeScript)
├── self-evolve-dash/        # Dashboard (Vite, TypeScript)
├── collabhub-modules/       # Userscript modules + free-AI CLI
├── ai-chat-websites/        # Userscript suite (Jest + ESLint)
├── singularity-operator/    # Python AI orchestrator
├── autonomous-github-agent/ # GitHub automation (Python)
├── VectorFS/                # C++ vector file system
├── third-door-system/       # Smart home/IoT framework
└── ...                      # Other projects
```

### Step 9: Run the Full Quality Series (Optional)

For a comprehensive check:

```powershell
npm run quality
```

This runs the 11-step catalyst series:
1. Bootstrap
2. npm check/lint
3. Python install
4. Health check
5. Verify
6. npm audit
7. ESLint fix
8. Vitest coverage
9. Build
10. Lockfile commit
11. Fleet audit

### Step 10: Make Your First Contribution

1. **Pick an issue:**
   - Check open issues: https://github.com/eric847b/AI-Collaboration-Hub/issues
   - Look at `docs/ROADMAP.md` for Round 11+ items
   - Start with documentation, tests, or small bug fixes

2. **Create a branch:**
   ```powershell
   git checkout -b feat/your-feature-name
   ```

3. **Make changes:**
   - Write code
   - Add/update tests
   - Update documentation

4. **Verify:**
   ```powershell
   npm run gate
   ```

5. **Commit:**
   ```powershell
   git add .
   git commit -m "feat: description"
   ```

6. **Push and create PR:**
   ```powershell
   git push origin feat/your-feature-name
   ```
   - Create PR on GitHub
   - Fill out PR template
   - Wait for CI to pass

---

## Common First-Time Issues

See `docs/TROUBLESHOOTING.md` for detailed solutions to:

- Node version mismatches
- npm install failures
- Missing lockfiles
- Playwright not installed
- VS Code extension issues
- Git hook problems
- CI workflow failures

---

## Next Steps After Setup

1. **Read the documentation:**
   - `README.md` — Project overview
   - `docs/ROADMAP.md` — Current plans & priorities
   - `docs/TESTING_GUIDE.md` — Testing strategies
   - `docs/TOOLGING_GUIDE.md` — All workspace tools

2. **Explore the codebase:**
   - Start with `nexus-infinity-hub/` or `collabhub-modules/`
   - Review CI workflows in `.github/workflows/`
   - Check out tools in `tools/`

3. **Join the community:**
   - Discussions: https://github.com/eric847b/AI-Collaboration-Hub/discussions
   - Read `COMMUNITY.md` for contribution guidelines

---

*Last updated: 2026-09-19 · Gate: PASS (22/22) · Rounds: 10 complete*
