# Contributing to Unified AI Assistant Suite

Thank you for your interest in contributing! This guide will help you get started.

## ┌─ Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Code Coverage](#code-coverage)
- [Submitting Changes](#submitting-changes)
- [Style Guide](#style-guide)

---

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect differing viewpoints and experiences

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Git
- Code editor (VS Code recommended)
- Tampermonkey or Violentmonkey for manual user-script testing

### Fork and Clone
`ash
git clone https://github.com/YOUR_USERNAME/ai-chat-websites.git
cd ai-chat-websites
git remote add upstream https://github.com/eric847b/ai-chat-websites.git
`

---

## Development Setup

### 1. Install Dependencies
`ash
npm install
`

### 2. Create Your Branch
`ash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
`

### 3. Available Scripts
`ash
# Run all tests (Userscript Suite test runner)
npm test

# Run tests with coverage report
npm run test:coverage

# Run Jest tests directly
npm run test:modules

# Validate project structure
npm run validate:root

# Validate modules
npm run validate:modules

# Check module dependencies
npm run check:deps

# Lint code
npm run lint

# Format code
npm run format

# TypeScript type check
npm run typecheck

# Security audit
npm run security:audit
`

---

## Project Structure

`
ai-chat-websites/
├── .github/workflows/ci.yml      # CI/CD: validate → test → security → release
├── docs/                         # Project-wide documentation
│   └── API.md                   # API reference (36 core modules)
├── Userscripts/
│   └── AI Chat Userscript Studio/
│       └── Userscript Suite/
│           ├── Modules/          # 374 modules across 30 domain folders
│           │   ├── 00-Core/      # 36 modules: orchestrator, registry, dashboard
│           │   ├── 01-Chat-Enhancement/   # 26 modules
│           │   ├── 02-AI-Agents/          # 8 modules
│           │   ├── 05-Security/          # 23 modules
│           │   ├── 06-Performance/       # 33 modules
│           │   └── ... (30 folders total)
│           ├── 12-Testing/        # Test suites (.cjs)
│           ├── docs/              # Suite documentation
│           └── scripts/           # Build, validate, test scripts
├── tests/                         # Root-level Jest tests
├── next_year_roadmap.md           # Strategic roadmap
├── PLAN_MAP.md                    # Master index
├── package.json                   # Dependencies, scripts, Jest config
└── CHANGELOG.md                   # Version history
```

---

## Making Changes

### Module Conventions
- Each module lives in its domain folder: `Modules/00-Core/`, `Modules/01-Chat-Enhancement/`, etc.
- File naming: `{NNN}-{slug}.module.user.js` (zero-padded 3-digit number)
- Each module exports functions via `window.ModuleName` or `window.__NEXUS_*__` globals
- Use `node --check` to validate syntax before committing

### Adding a New Module
1. Pick the correct domain folder (see Project Structure)
2. Use the next available 3-digit number in that folder
3. Include the userscript header (`// ==UserScript==`) with `@name`, `@namespace`, `@version`, `@description`, `@match`, `@grant`
4. Wrap code in an IIFE or use `(() => { ... })();`
5. Add to `Modules/INDEX.md` if one exists in that folder
6. Add corresponding test in `12-Testing/{NNN}-{slug}-test.cjs`

### Git Workflow
```bash
git checkout -b feature/descriptive-name
# make changes, run tests, validate
git add <files>
git commit -m "feat(scope): descriptive message"
git push -u origin feature/descriptive-name
# open Pull Request
```

---

## Testing

### Running Tests
```bash
# Full Userscript Suite test runner (validates + tests all modules)
npm test

# Jest unit tests (root-level tests/ folder)
npm run test:modules

# Coverage report (Jest, 80% threshold)
npm run test:coverage
```

### Test Structure
- **Suite tests** (`12-Testing/*.cjs`): Each module has a co-located test file using Node's `assert`
- **Jest tests** (`tests/**/*.test.js`): Modern test framework for root-level integrations
- **Smoke tests**: `node --check` validates syntax across all modules

### Writing Tests
```javascript
// Example: 12-Testing/001-my-feature-test.cjs
const assert = require('assert');
const vm = require('vm');
const fs = require('fs');

const code = fs.readFileSync(
  '../Modules/00-Core/001-my-feature.module.user.js', 'utf8'
);
const sandbox = { window: {}, assert, console, Array, Object, JSON, Math, Date };
const ctx = vm.createContext(sandbox);
vm.runInContext(code, ctx, { filename: '001-my-feature.module.user.js' });

// Test exported functions
assert.strictEqual(typeof sandbox.MyFeature, 'function', 'exports MyFeature');
```

### Requirements
- All tests must pass before merging: `npm test && npm run test:modules`
- New modules must include a test file in `12-Testing/`
- Coverage must stay at or above 80% (configured in `package.json` → `jest.coverageThreshold`)

---

## Code Coverage

Coverage is enforced via Jest's `coverageThreshold` in `package.json`:

```json
"coverageThreshold": {
  "global": {
    "branches": 80,
    "functions": 80,
    "lines": 80,
    "statements": 80
  }
}
```

### Viewing Coverage
```bash
npm run test:coverage
# Terminal summary printed automatically
# HTML report: coverage/lcov-report/index.html
```

### What's Covered
- `Userscripts/modules/**/*.js` — all module source files
- Excludes test files (`*.test.js`, `*.spec.js`)

### If Coverage Drops Below 80%
- Add tests for uncovered branches/functions
- Run `npm run test:coverage` locally to see gaps before pushing
- The CI pipeline will reject PRs that don't meet the threshold

---

## Submitting Changes

### Pull Request Process
1. Fork the repository (external contributors) or create a branch (maintainers)
2. Make focused, logical commits with descriptive messages
3. Ensure all tests pass: `npm test`
4. Ensure validation passes: `npm run validate:root && npm run validate:modules`
5. Push to your fork/branch and open a PR against `main`
6. Fill out the PR template with:
   - What changed and why
   - Test results (screenshots or output)
   - Any breaking changes or migration steps

### Commit Message Format
```
feat(scope): add new feature
fix(scope): resolve a bug
docs(scope): update documentation
test(scope): add or fix tests
chore(scope): tooling, config, or housekeeping
refactor(scope): code restructuring without behavior change
```

### Review Requirements
- At least one approving review from a maintainer
- All CI checks green (validate, test, lint, security audit)
- No merge conflicts with `base` branch

---

## Style Guide

### JavaScript
- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings (`'hello'`), double quotes only in userscript headers
- **Semicolons**: Required
- **Line endings**: LF (enforced by `.husky/pre-commit` and `.editorconfig`)
- **Variable declarations**: `const` by default, `let` when reassignment needed, no `var`
- **Functions**: Arrow functions for callbacks; regular functions for module exports
- **Strict mode**: `'use strict';` at top of every module

### Userscript Header
Every `.module.user.js` must include:
```javascript
// ==UserScript==
// @name         Module Name
// @namespace    https://github.com/eric847b/ai-chat-websites
// @version      1.0.0
// @description  Brief description of what this module does
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==
```

### Naming Conventions
- Module files: `036-infra-devops.module.user.js`
- Test files: `025-infra-devops-test.cjs`
- Functions: camelCase (`runCatalyst`, `healUnhealthy`)
- Constants: UPPER_SNAKE_CASE (`MAX_RETRIES`, `DEFAULT_TIMEOUT`)
- Global exports: PascalCase or `__NAMESPACE_*__` for cross-module APIs

### Documentation
- Update `docs/API.md` when adding or changing module exports
- Update `CHANGELOG.md` for any user-facing changes
- Comment complex logic with inline `//` comments
- JSDoc for public API functions is encouraged but not required

---

## Resources

- **API Reference**: `docs/API.md` — complete exports for all 36 core modules
- **Developer Guide**: `DEVELOPER_GUIDE.md` — in-depth architecture documentation
- **Quality Dashboard**: `QUALITY_STATUS.md` — current test/coverage metrics
- **Strategic Roadmap**: `next_year_roadmap.md` — v2.2.0+ milestones
- **Master Index**: `PLAN_MAP.md` — every plan file in the repo
- **Changelog**: `CHANGELOG.md` — version history and release notes
`
