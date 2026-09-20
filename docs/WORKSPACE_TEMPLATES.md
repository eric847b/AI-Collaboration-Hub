# Workspace Templates

> **Project scaffolding templates for creating new Vite/React apps with standardized configurations.**
> 
> **Last updated:** 2026-09-19 · **Gate status:** PASS (22/22) · **Completed rounds:** 11

---

## Creating a New Project

### Step-by-Step

1. **Create directory and initialize:**
   ```powershell
   mkdir new-project && cd new-project
   npm init -y
   ```

2. **Install dependencies:**
   ```powershell
   npm install react react-dom
   npm install -D typescript vite @vitejs/plugin-react eslint prettier vitest @playwright/test
   ```

3. **Create config files** (copy from templates above)

4. **Create source files:**
   - `src/main.tsx`, `src/App.tsx`, `src/index.css`
   - `index.html`

5. **Install Playwright browsers:**
   ```powershell
   npx playwright install chromium
   ```

6. **Install and verify:**
   ```powershell
   npm install
   npm run check
   ```

---

## Integration Checklist

When adding a new project to the workspace, ensure:

- [ ] `package.json` with standard scripts
- [ ] `package-lock.json` committed
- [ ] TypeScript strict mode enabled
- [ ] ESLint + Prettier configured
- [ ] Vitest tests (coverage ≥70% if required)
- [ ] Playwright E2E tests (optional but recommended)
- [ ] Telemetry hook installed (optional)
- [ ] Added to relevant CI workflows
- [ ] Gate passes: `npm run gate`

---

## Related Documentation

- [`../tools/TOOLING_GUIDE.md`](../tools/TOOLING_GUIDE.md) — All workspace tools
- [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) — Testing strategies
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — Contribution guidelines

---

*Last updated: 2026-09-19 · Gate: PASS (22/22) · Rounds: 10 complete*