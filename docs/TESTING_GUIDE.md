# Testing Guide

> **Complete reference for all testing strategies, tools, and workflows in the AI Collaboration Hub workspace.**
> 
> **Last updated:** 2026-09-19 · **Gate status:** PASS (22/22) · **Completed rounds:** 11

---

## Overview

The workspace employs a multi-layered testing strategy:

1. **Unit Tests** — Per-project test suites (vitest, pytest, Jest)
2. **Integration Tests** — Cross-project validation
3. **E2E Tests** — Full browser testing (Playwright)
4. **Visual Regression** — Screenshot diffing
5. **Load Testing** — Performance benchmarks
6. **Smoke Tests** — HTTP endpoint validation
7. **Security Tests** — Secret scanning, vulnerability detection
8. **Workflow Tests** — Actionlint, workflow audit

---

## Unit Testing

### Node/TypeScript Projects

#### nexus-infinity-hub & self-evolve-dash

**Test Framework:** vitest

**Configuration:** `vitest.config.ts` in each project

**Running tests:**
```powershell
cd nexus-infinity-hub
npm run test          # Run all tests
npm run test:coverage # Run with coverage (enforces ≥70%)
```

**Coverage requirement:** ≥70% enforced in CI via `quality-checks.yml`

**Key test files:**
- `src/**/*.test.ts` — Unit tests
- `src/lib/telemetry.test.ts` — Telemetry hook tests (13 tests)

---

#### ai-chat-websites

**Test Framework:** Jest

**Running tests:**
```powershell
cd ai-chat-websites
npm test              # Run all tests
```

**Test suite includes:**
- Core functionality tests (8 tests)
- Userscript DOM tests (10 tests)
- Total: 18 checks

---

#### collabhub-modules

**Test Framework:** Custom (vm.Script pre-commit gate)

**Running tests:**
```powershell
cd collabhub-modules
npm test              # 18 checks: 8 core + 10 userscript DOM
```

---

### Python Projects

#### singularity-operator

**Test Framework:** pytest

**Running tests:**
```powershell
cd singularity-operator
pytest                   # Run all tests
pytest --cov            # Run with coverage
```

**CI:** Multi-version matrix (3.10, 3.11, 3.12)

---

#### autonomous-github-agent

**Test Framework:** pytest

**Running tests:**
```powershell
cd autonomous-github-agent
pytest                   # Run all tests
```

---

#### Other Python Projects

**Projects with tests:**
- AI-Collaboration-Hub
- nexus-core
- solutions-dynamics

**Running tests:**
```powershell
cd <project>
pytest                   # Run all tests
```

---

## E2E Testing (Playwright)

### Setup

**Dependencies:** `@playwright/test` ^1.63

**Installation:**
```powershell
npm install -D @playwright/test
npx playwright install chromium
```

### Configuration

**Files:**
- `playwright.config.js` — Main config (serves production build via `vite preview`)
- `e2e/app.spec.js` — Core E2E tests
- `e2e/visual.spec.js` — Visual regression tests

### Running E2E Tests

```powershell
# Run all E2E tests
npm run test:e2e

# Run with UI mode
npm run test:e2e -- --ui

# Run specific test
npm run test:e2e -- app.spec.js

# Run visual regression tests
npm run test:visual
```

### Test Structure

**`e2e/app.spec.js` (3 tests per app):**
1. Page title check
2. `#root` renders correctly
3. Zero console/page errors

**`e2e/visual.spec.js`:**
- Full-page screenshot comparison
- Animations disabled
- 2% diff tolerance
- Baselines seeded on Linux CI via `playwright-e2e.yml` dispatch `mode=seed`

---

#### ai-chat-websites

**Test Framework:** Jest

**Running tests:**
```powershell
cd ai-chat-websites
npm test              # Run all tests
```

**Test suite includes:**
- Core functionality tests (8 tests)
- Userscript DOM tests (10 tests)
- Total: 18 checks
---

## VS Code Setup for Testing

### Recommended Extensions

For the best testing experience in this workspace, install these VS Code extensions:

**Testing Extensions:**
- `vitest.explorer` — Vitest test explorer (for nexus-infinity-hub, self-evolve-dash)
- `ms-jest.jest` — Jest test explorer (for ai-chat-websites)
- `ms-python.pytest` — pytest support (for Python projects)
- `ms-playwright.playwright` — Playwright test runner & viewer

**Full recommendation list:** See `.vscode/extensions.json` for the complete list of 15 recommended extensions covering testing, linting, formatting, Git, and productivity.

### VS Code Tasks

Run tests via VS Code tasks:
- **Ctrl+Shift+B** — Default build task (runs `npm run gate`)
- **Command Palette** → "Tasks: Run Task" → select test task

**Available tasks:**
- `npm run test` — Run unit tests in current project
- `npm run test:coverage` — Run tests with coverage
- `npm run test:e2e` — Run Playwright E2E tests
- `npm run test:visual` — Run visual regression tests

### Debugging Tests

**Unit Tests:**
1. Open test file
2. Set breakpoints
3. Press F5 (debug) or use test explorer

**E2E Tests:**
1. Use Playwright extension
2. Run `npm run test:e2e -- --ui` for interactive mode
3. Use trace viewer for debugging

---

*Last updated: 2026-09-19 · Gate: PASS (22/22) · Rounds: 10 complete*