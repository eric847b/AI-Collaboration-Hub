# Workspace: AI Collaboration & Automation Hub

Multi-project workspace containing AI agents, dashboards, userscript modules, and infrastructure tools.

## Projects

### Node/React Projects
- **nexus-infinity-hub** — Self-evolving AI collaboration hub with UI components
- **self-evolve-dash** — Dashboard for self-evolution workflows
- **collabhub-modules** — Userscript modules for enhanced collaboration
- **third-door-blink-controller** — Expo React Native app

### Python Projects
- **singularity-operator** — Multi-AI orchestrator (Groq-based)
- **autonomous-github-agent** — AI-driven GitHub automation
- **AI-Collaboration-Hub** — AI collaboration registry and workflows

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

## Support

For issues or suggestions, open a GitHub Issue or PR. See `CONTRIBUTING.md` for guidelines.
