# Workspace: AI Collaboration & Automation Hub

Multi-project workspace containing AI agents, dashboards, userscript modules, and infrastructure tools.

## Planning & Status

- **`docs/ROADMAP.md`** — single source of truth for all plans, to-dos, and improvement rounds (10 rounds complete, Round 11+ open)
- **`docs/STATUS.md`** — verified live state (workflows, tooling, caveats) — 2026-09-19: PASS 22/22
- **`docs/ARCHIVE-improvement-rounds-2026-08.md`** — condensed history of improvement rounds 1–3
- **`docs/TESTING_GUIDE.md`** — comprehensive testing reference (unit, E2E, visual, load, security tests)
- **`docs/DEPENDENCY_WORKFLOWS.md`** — dependency workflow details + security features
- **`docs/ROOT_CAUSE_RUNTIME_FAILURES.md`** — runtime failure classes, incidents, current status
- **`COMMUNITY.md`** — community guide, contribution process, support channels
- **`tools/TOOLING_GUIDE.md`** — complete reference for all 18 workspace tools

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

GitHub Actions workflows automate quality checks (24 workflows total, all actionlint-clean):

- **`all-projects-sanity.yml`** — Weekly validation of all Node and Python projects
- **`quality-checks.yml`** — Per-project quality gates (coverage ≥70%, lint, typecheck)
- **`security-scanning.yml`** — Dependency vulnerability scanning (Sun 02:00)
- **`secret-scan.yml`** — Secret detection in commits/PRs
- **`workflow-lint.yml`** — Actionlint + workflow hygiene checks
- **`dependency-review.yml`** — Dependency review on PRs
- **`playwright-e2e.yml`** — Full browser E2E tests (both Vite apps)
- **`e2e-smoke.yml`** — HTTP smoke tests + load testing (PRs + main)
- **`performance-monitoring.yml`** — Bundle-size regression gates (Sat 03:00 + PR gate)
- **`node-matrix.yml`** — Multi-version Node CI (Sat 03:30 + PRs)
- **`multi-os-gate.yml`** — Windows hard gate + Linux informational (syntax, tools, extension check)
- **`autonomous-agent.yml`** — 6h autonomous improvement cycle
- **`generate-docs.yml`** — API docs generation (TypeDoc + pdoc)
- **`ci-self-heal.yml`** — Self-healing workflow for automated fixes
- **Plus 10 more workflows** for specialized tasks (lockfile validation, branch cleanup, nexus enforcement, etc.)

**All 24 root workflows carry:**
- Least-privilege top-level `permissions:`
- Job `timeout-minutes: 30`
- Top-level `concurrency:` groups (cancel-in-progress on PR flows only)

Workflow audit: 1 accepted finding (documented WF004 review-flag on `ci-self-heal.yml`).s.yml`** (per repo) — Lint, test, build on PR/push
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

To run the workspace quality gate:

```powershell
npm run gate      # workspace-gate v3: configs, workflows (+ live actionlint), lockfiles, engines, hook integrity
npm run verify    # alias of gate
npm run health    # alias of gate
npm run ci        # alias of gate
```

## Tooling & Automation

The workspace ships with PowerShell tooling under `tools/`:

| Script                | Purpose                                                                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run-quality.ps1`     | **Catalyst series**: bootstrap → npm check/lint → Python install → health → verify → npm audit → eslint fix → vitest coverage → build → lockfile commit → fleet audit (Step 11), then a colour‑coded summary + exit code. |
| `review-repos.ps1`    | Inventories the monorepo + project subfolders (git info, key files, file counts) and writes `LocalRepoReview.txt`.                                                                                                        |
| `analyze-freedom.ps1` | Scores each project against freedom goals (Financial / Biological / Chores) and writes `FreedomReport.txt`.                                                                                                                       |
| `bundle-trend.cjs`    | **Node tool** — bundle-size ledger: `collect` snapshots every project's build output into `docs/metrics/bundle-history.json`; `check` fails on >10% growth; `report` prints history.                                             |
| `e2e-smoke.mjs`       | **Node tool** — serves a built Vite app with `vite preview` and asserts HTTP 200 (E2E smoke slice; wired into `e2e-smoke.yml`).                                                                                                  |

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
