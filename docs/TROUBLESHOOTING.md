# Troubleshooting Guide

> **Common issues and their solutions for the AI Collaboration Hub workspace.**
> 
> **Last updated:** 2026-09-19 · **Gate status:** PASS (22/22) · **Completed rounds:** 11

---

## Table of Contents

1. [Node.js Issues](#nodejs-issues)
2. [Dependency & Lockfile Issues](#dependency--lockfile-issues)
3. [Playwright & E2E Issues](#playwright--e2e-issues)
4. [CI/CD & Workflow Issues](#cicd--workflow-issues)
5. [Python Issues](#python-issues)
6. [VS Code & Editor Issues](#vs-code--editor-issues)
7. [Tooling Issues](#tooling-issues)
8. [General Issues](#general-issues)

---

## Node.js Issues

### Node Version Mismatch

**Symptom:** 
```
WARN: node v24.14.0 < engines requirement >= 26 (npm not engine-strict; informational)
```

**Cause:** Local Node version is below the required version (≥26).

**Solutions:**

1. **Use Node 26 (recommended):**
   ```powershell
   # Using nvm (Node Version Manager)
   nvm use 26
   # or
   nvm install 26
   nvm use 26
   ```

2. **Verify version:**
   ```powershell
   node --version  # Should show v26.x.x
   ```

3. **If nvm is not available:**
   - Download from https://nodejs.org/ (LTS version)
   - Or use fnm (Fast Node Manager): https://github.com/Schniz/fnm

---

## CI/CD & Workflow Issues

### Workflow Fails on Push

**Symptom:** GitHub Actions workflow fails.

**Troubleshooting steps:**

1. **Check workflow logs:**
   - Go to Actions tab on GitHub
   - Click the failed workflow run
   - Expand failed steps for error details

2. **Common causes:**
   - **Lockfile issues:** Run `npm run gate` locally
   - **Test failures:** Run tests locally: `npm run test`
   - **Build failures:** Run build locally: `npm run build`

3. **Reproduce locally:**
   ```powershell
   npm run gate
   npm run test
   npm run build
   ```

---

## Python Issues

### Module Not Found

**Symptom:** `ModuleNotFoundError: No module named 'xxx'`

**Solution:**
```powershell
cd <python-project>
pip install -r requirements.txt
```

---

### pytest Not Found

**Symptom:** `pytest : The term 'pytest' is not recognized`

**Solution:**
```powershell
pip install pytest
```

---

## VS Code & Editor Issues

### ESLint/Prettier Not Working

**Symptom:** No linting/formatting in editor.

**Solutions:**

1. **Install extensions:**
   - ESLint: `dbaeumer.vscode-eslint`
   - Prettier: `esbenp.prettier-vscode`

2. **Restart VS Code** after installing extensions

3. **Verify extensions.json:**
   - See `.vscode/extensions.json` for recommended extensions

---

### Git Hooks Not Running

**Symptom:** Pre-commit hooks not executing.

**Solutions:**

1. **Verify husky is installed:**
   ```powershell
   npm install
   ```

2. **Test hook manually:**
   ```powershell
   npm run gate
   ```

---

## Tooling Issues

### workspace-gate.ps1 Fails

**Symptom:** Gate fails with specific error.

**Troubleshooting:**

1. **Read the error message** — Gate provides specific failure reasons

2. **Common failures:**
   - Missing configs → Add required files
   - Lockfile missing → Run `npm install`
   - Python reqs missing → Add `requirements.txt`

3. **Run specific checks:**
   ```powershell
   node tools/verify-tools.mjs          # Tool health
   node tools/workflow-audit.mjs        # Workflow audit
   ```

### verify-tools reports a `warn` (a stale dashboard no longer fails the run)

**Symptom:** `node tools/verify-tools.mjs` prints
`WARN  ops-dashboard.mjs --check (dashboard-stale)` with a summary of
`1 warn`, exit code 0. Verify-tools v1 exited 1 in this situation.

**Why:** the OPS dashboard stamps every section with a marker
(`<!-- ops-section:<name> ts:<iso8601> -->`) and its own `--check` mode fails
once any stamp is older than 24h. That is an *ops signal* (the refresh cron has
not run), not a tool defect - regenerating the dashboard preserves the stamps of
sections whose content did not change, so a fresh-but-unchanged dashboard keeps
reporting `STALE` until the cron's `--refresh` pass bumps them. `verify-tools` v2
therefore classifies it as `warn` (advisory) instead of `fail`.

**Fix / pick your strictness:**

| Situation | Command |
|-----------|---------|
| Refresh the stamps (also clears `--check`) | `node tools/ops-dashboard.mjs` then `node tools/ops-dashboard.mjs --refresh` |
| You want staleness to block | `node tools/verify-tools.mjs --strict` (or `npm run tools:verify:strict`) |
| Triage which failure you actually have | `node tools/verify-tools.mjs --json` - inspect `rows[].reason` and `summary.warn` |
| Confirm it is structural, not staleness | `node tools/ops-dashboard.mjs --check` - `dashboard-output-missing` and `dashboard-markers-missing` are hard failures, the `STALE` lines are not |

**Guard rails already in place:** `--self-test` (47 checks) unit-tests exactly this
classification (stale warns; missing artifact/markers fail; exit-code algebra
under `--strict`; the summary tally), asserts the smoke matrix free of mutating
probes (no probe can sync, collect, or rewrite state), and drives four
*zero-probe end-to-end CLI paths* — including this `--only typo` guard — so the
runner's print/exit tail is covered too, not just the pure helpers.

### verify-tools prints `no-tools-matched` (or exits 2)

**Symptom:** `node tools/verify-tools.mjs --only verfy-tools.mjs` (typo) prints
`FAIL  no-tools-matched: --only 'verfy-tools.mjs' matched no tools/*.{mjs,cjs}`,
then `0 tools, 0 green, 0 warn, 1 failed`, and exits 1. Or the run stops before
any probe with `--max-age-hours expects a non-negative number` and exits 2.

**Why (v2.1 no-silent-green guards):** a selector that matched nothing used to run
zero probes and exit 0 — a green run that verified nothing, the same class of
false verdict the tiered `warn` fix removed. An empty `tools/` directory is
reported as `no-tools-discovered` (same exit). A non-numeric `--max-age-hours`
would be forwarded to the dashboard probe as garbage, so it is rejected as a
runner setup error (exit 2) *before* any probe runs.

**Fix:**

| Situation | Command |
|-----------|---------|
| Confirm the basename | `node tools/verify-tools.mjs --list` |
| Probe several tools at once | `node tools/verify-tools.mjs --only a.mjs,b.mjs` |
| Force staleness on purpose | `node tools/verify-tools.mjs --only ops-dashboard.mjs --max-age-hours 0` (`0` is valid; negative or non-numeric is not) |
| Read the machine report | `node tools/verify-tools.mjs --json` — `guard`, `selector`, `summary.tools`/`summary.failed`/`summary.exitCode` |

---

### handoff-check `--strict` fails on a handoff that records a guard probe

**Symptom:** `node tools/handoff-check.mjs --strict` exits 1 with
`validation[N] recorded a FAILING command (exit 1): node tools/verify-tools.mjs --only typo.mjs --quiet`
even though that non-zero exit is exactly what the probe is *supposed* to prove.

**Why (v2.2 `expectedExitCode`):** every recorded non-zero `exitCode` used to be a
warning under any mode, so the only way to keep `--strict` green was to delete the
negative-path evidence — the check was quietly rewarding a less honest handoff.

**Fix:** declare the exit you intend to observe on the entry —

```json
{
  "command": "node tools/verify-tools.mjs --only typo.mjs --quiet (guard: FAIL no-tools-matched, exit 1)",
  "exitCode": 1,
  "expectedExitCode": 1
}
```

| recorded `exitCode` | declared `expectedExitCode` | verdict |
|---|---|---|
| `0` | — | silent (green) |
| non-zero | equal | accepted — `--verbose` prints it as an INTENTIONAL failure |
| non-zero | different | warning: `expected exit X but recorded exit Y` |
| non-zero | absent | warning, exactly as before |
| any | non-integer (e.g. `"1"`) | error: `validation[N].expectedExitCode must be an integer` |

**Do not "fix" this by deleting the row.** A mismatch is the point of the feature:
it means the guard's behaviour drifted (a probe that used to exit 1 now exits 2),
which is real information. Run `node tools/handoff-check.mjs --verbose` to see the
accepted intentional failures alongside the green ones.

---

## General Issues

### Git Push Rejected

**Symptom:** `git push` fails.

**Solutions:**

1. **Sync first:**
   ```powershell
   # Use resilient-git.ps1, not bare push/pull
   powershell -ExecutionPolicy Bypass -File .\tools\resilient-git.ps1 sync -Repo .
   ```

---

## Getting Help

If you can't resolve an issue:

1. **Check documentation:**
   - `README.md` — Project overview
   - `DEVELOPER_GUIDE.md` — Development workflow
   - `docs/TESTING_GUIDE.md` — Testing issues

2. **Search issues:**
   - https://github.com/eric847b/AI-Collaboration-Hub/issues

3. **Run diagnostic commands:**
   ```powershell
   npm run gate
   node tools/verify-tools.mjs
   ```

---

*Last updated: 2026-09-19 · Gate: PASS (22/22) · Rounds: 10 complete*
---

### Actionlint Errors

**Symptom:** Workflow fails validation with actionlint errors.

**Solution:**
```powershell
# Run actionlint locally
C:\Users\Eric\Documents\Cline\Tools\actionlint.exe .github/workflows/

# Or via gate
npm run gate
```

**Common actionlint issues:**
- Missing `permissions:`
- Missing `timeout-minutes:`
- Missing `concurrency:`
- Non-SHA action versions

---


**Note:** This is an informational warning only. The gate will still pass, but some features may require Node 26+.

---

### npm install Failures

**Symptom:** `npm install` fails with resolution errors.

**Common causes & solutions:**

1. **Corrupted lockfile:**
   ```powershell
   # Delete lockfile and node_modules
   Remove-Item -Recurse -Force node_modules
   Remove-Item package-lock.json
   # Reinstall
   npm install
   ```

2. **Legacy peer dependencies:**
   ```powershell
   npm install --legacy-peer-deps
   ```

3. **Cache issues:**
   ```powershell
   npm cache clean --force
   npm install
   ```