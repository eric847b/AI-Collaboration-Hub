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