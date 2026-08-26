# Workspace: AI Collaboration & Automation Hub

Multi-project workspace containing AI agents, dashboards, userscript modules, and infrastructure tools.

## Projects

### Node/React Projects

- **nexus-infinity-hub** — Self-evolving AI collaboration hub with UI components
- **self-evolve-dash** — Dashboard for self-evolution workflows
- **collabhub-modules** — Userscript modules for enhanced collaboration
- **third-door-blink-controller** — Expo React Native app
- **ai-chat-websites** — Sovereign Singularity autonomous userscript suite (Jest + ESLint toolchain)

### Python Projects

- **singularity-operator** — Multi-AI orchestrator (Groq-based)
- **autonomous-github-agent** — AI-driven GitHub automation
- **AI-Collaboration-Hub** — AI collaboration registry and workflows
- **nexus-core** — Python orchestration core
- **solutions-dynamics** — Dynamics solutions tooling

> **Auto-discovery:** `bootstrap.ps1`, `workspace-gate.ps1`, `run-quality.ps1`
> no longer keep hardcoded project lists — they detect any
> root-level folder containing a `package.json` (Node) or `requirements.txt`
> (Python). Adding a new project directory automatically enrolls it in every
> health/quality gate.

### Systems

- **VectorFS** — C++ vector file system implementation
- **third-door-system** — Smart home/IoT framework

## Setup & Workflow

### 1. Bootstrap All Projects

```powershell
.\tools\bootstrap.ps1
```

This installs Node and Python dependencies for all subprojects in one pass.

### 2. Install Specific Project

```powershell
cd nexus-infinity-hub
npm install  # or use package manager of choice
```

### 3. Development

Each project has standard npm/pip scripts:

```powershell
cd nexus-infinity-hub
npm run dev      # Start dev server
npm run lint     # Check code
npm run lint:fix # Auto-fix issues
npm run test     # Run tests
npm run build    # Production build
```

### 4. Free AI CLI — runs anywhere, never pauses

From the **workspace root**:

```powershell
npm run ai -- "summarize this"
npm run ai -- "step one" "step two"   # multi-step rotation, results accumulate
```

Delegates to `collabhub-modules/run-ai.js`: rotates through the permanent‑free
pool (local Ollama/LM Studio/LocalAI → cloud free tiers). Missing keys or a down
endpoint are skipped instantly, so work keeps moving. Set any free key or start a
local server (e.g. `ollama serve`) to get live results; with none configured it
fails over the whole pool and exits gracefully instead of hanging.

## Workspace Conventions

- **`.editorconfig`** — Standardizes indentation, line endings, and formatting
- **`.gitattributes`** — Normalizes line endings and binary handling
- **`.eslintrc.json`** & **`.prettierrc`** — Base linting/formatting rules (project-specific configs override)
- **`CONTRIBUTING.md`** — Collaboration guidelines
- **`CODE_OF_CONDUCT.md`** — Community standards

## CI/Automation

GitHub Actions workflows automate quality checks:

- **`all-projects-sanity.yml`** — Weekly validation of all Node and Python projects
- **`quality-checks.yml`** (per repo) — Lint, test, build on PR/push
- **`python-checks.yml`** — Python syntax validation and optional flake8
- **`lint-autofix.yml`** — Scheduled ESLint fixes with auto-commit
- **`dependabot.yml`** — Automated dependency updates

## Common Tasks

### Run All Quality Checks Locally

```powershell
.\tools\bootstrap.ps1
cd nexus-infinity-hub && npm run check
cd ..\self-evolve-dash && npm run check
cd ..\singularity-operator && python -m pip install -r requirements.txt
```

### Update Dependencies

Dependabot opens PRs automatically. To manually update:

```powershell
cd <project>
npm update          # Node projects
pip install --upgrade -r requirements.txt  # Python projects
```

### Format Code

```powershell
cd <project>
npm run lint:fix    # Auto-fix ESLint issues (Node)
black .             # Format Python
```

## Dependency Management & Health Checks

### Lockfiles

All Node projects should maintain `package-lock.json` (or `pnpm-lock.yaml`/`yarn.lock`):

```powershell
# After running npm install, commit the lockfile
git add <project>/package-lock.json
git commit -m "deps: update lockfile"
```

**Why?** Lockfiles ensure reproducible, deterministic builds across environments. Always commit them to version control.

### Health Checks

Run the workspace health check to verify all projects are in good shape:

```powershell
npm run health
```

This validates:

- ✓ All Node projects have lockfiles
- ✓ All Python projects have `requirements.txt`
- ✓ CI workflows are configured
- ⚠ Reports warnings for missing optional files

### Verification

To run all verification scripts:

```powershell
npm run verify    # Checks shared configs, projects, workflows
npm run health    # Checks lockfiles and dependencies
npm run ci        # Runs both verify and health
```

## Tooling & Automation

The workspace ships with PowerShell tooling under `tools/`:

| Script                | Purpose                                                                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run-quality.ps1`     | **Catalyst series**: bootstrap → npm check/lint → Python install → health → verify → npm audit → eslint fix → vitest coverage → build → lockfile commit → fleet audit (Step 11), then a colour‑coded summary + exit code. |
| `review-repos.ps1`    | Inventories the monorepo + project subfolders (git info, key files, file counts) and writes `LocalRepoReview.txt`.                                                                                                        |
| `analyze-freedom.ps1` | Scores each project against freedom goals (Financial / Biological / Chores) and writes `FreedomReport.txt`.                                                                                                               |

Run the full catalyst series in one command via `npm run quality`, or launch scripts individually from the root:

```powershell
npm run quality                          # full catalyst series (run-quality.ps1)
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\run-quality.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\review-repos.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\analyze-freedom.ps1
```

> **Node version:** the projects require **Node ≥ 26** (see `engines` and `.nvmrc`). Install via `nvm use 26` (or `nvm install 26`).
> **Pre‑commit:** the Husky hook runs `lint-staged` (eslint + prettier). Ensure dev dependencies are installed (`npm install`) before committing.

## Support

For issues or suggestions, open a GitHub Issue or PR. See `CONTRIBUTING.md` for guidelines.
