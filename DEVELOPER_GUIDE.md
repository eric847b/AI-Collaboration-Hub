# Developer Quick Start Guide

**For developers joining the workspace or starting fresh.**

---

## 1. First Time Setup (10 minutes)

### Clone and Bootstrap

```powershell
# Navigate to workspace root
cd c:\Users\Eric\OneDrive\Documents\GitHub

# Install all dependencies (Node + Python)
npm run bootstrap

# Verify everything is healthy
npm run health
```

Expected output: `Status: HEALTHY` with 0 warnings.

---

## 2. Before You Code

### Understand the Structure

```
GitHub/
  .editorconfig          # Formatting rules (auto-applied by editors)
  .github/               # GitHub workflows and configuration
  .eslintrc.json         # Base ESLint rules
  .prettierrc            # Code formatter settings

  nexus-infinity-hub/    # Main React hub (Vite, TypeScript strict)
  self-evolve-dash/      # Dashboard (Vite, TypeScript strict)
  singularity-operator/  # Python AI orchestrator (PyTest, MyPy)
  autonomous-github-agent/ # GitHub automation (Python)

  tools/
    bootstrap.ps1        # Install all deps
    health-check.ps1     # Verify workspace health
    verify-workspace.ps1 # Validate configs
```

---

## 3. Daily Development Workflow

### Making Changes

```powershell
# 1. Navigate to your project
cd nexus-infinity-hub

# 2. Start development (auto-reload)
npm run dev

# 3. Make code changes in your editor
# (VSCode with EditorConfig extension auto-formats as you type)

# 4. Before committing, lint-staged will auto-fix issues
# (Husky pre-commit hook runs lint-staged automatically)

git add .
git commit -m "feat: add new feature"
# Pre-commit hook runs here, auto-fixes any issues
```

### What Happens Automatically

When you commit:
1. **Pre-commit hook** (`.husky/pre-commit`) runs
2. **lint-staged** runs ESLint --fix on your staged files
3. **Bad commits are prevented** — hook fails if serious issues remain
4. Commit succeeds only after code passes checks

---

## 4. Running Quality Checks

### Local Quality Checks

```powershell
cd nexus-infinity-hub

# Run all checks (lint + test + build)
npm run check

# Just lint
npm run lint

# Just lint with auto-fix
npm run lint:fix

# Just tests
npm run test

# Just build
npm run build
```

### For Python Projects

```powershell
cd singularity-operator

# Install dev dependencies
pip install -r requirements-dev.txt

# Run tests
pytest --cov=.

# Format check
black --check .

# Type check
mypy . --ignore-missing-imports

# Fix formatting
black .
```

---

## 5. Workspace Health & Verification

```powershell
# Check dependency health (lockfiles, Python requirements, CI)
npm run health

# Verify all workspace configs are in place
npm run verify

# Full CI suite locally
npm run ci
```

---

## 6. Pushing Code to GitHub

### Before Push

1. **Ensure your branch is clean:**
   ```powershell
   git status  # Should show nothing except untracked files
   ```

2. **Run local quality checks:**
   ```powershell
   npm run check      # Node project
   pytest --cov=.    # Python project
   ```

3. **Pull latest main:**
   ```powershell
   git pull origin main
   ```

### After Push

- GitHub Actions workflows run automatically
- Results show in your PR
- **Green checkmark** ✅ = all quality gates passed
- **Red X** ❌ = fix issues and push again

---

## 7. Handling Pre-commit Failures

### If a commit fails

```powershell
# Error message shows what failed
# Usually it's just formatting

# Auto-fix and retry
npm run lint:fix
git add .
git commit -m "same message"  # Will work now
```

### If you really need to bypass (don't do this often)

```powershell
git commit --no-verify  # Skips pre-commit hook
# But CI will catch issues anyway, so pre-commit is better!
```

---

## 8. Updating Dependencies

### Automated (Weekly via Dependabot)

```powershell
# GitHub opens PRs automatically for updates
# Just review and merge them when green ✅
```

### Manual Update

```powershell
cd nexus-infinity-hub

# Update all npm packages
npm update

# Or install specific version
npm install package@latest

# Commit lockfile changes
git add package-lock.json
git commit -m "deps: update dependencies"
```

---

## 9. Creating a New Feature Branch

```powershell
# Update main first
git checkout main
git pull origin main

# Create feature branch
git checkout -b feat/my-feature

# Make changes, commit, push
git push origin feat/my-feature

# Open PR on GitHub
# CI runs automatically, checks appear on PR
```

---

## 10. Common Issues & Solutions

### Issue: Pre-commit hook fails with eslint errors

**Solution:** Run `npm run lint:fix`, then commit again.

### Issue: TypeScript errors after strict mode

**Solution:** The errors are real! Fix them:
```powershell
npm run check  # See which files have errors
# Fix each error in the editor, or use type guards
```

### Issue: Test failure in CI but passes locally

**Solution:**
- Different Node version? Check `.node-version` or package.json `engines`
- Different environment? Run full CI locally with `npm run ci`
- Commit hash difference? Pull latest and retry

### Issue: Dependabot PR fails CI

**Solution:**
- Check CI logs to see what failed
- Usually compatibility issues between dep versions
- Comment `@dependabot rebase` to resolve conflicts

### Issue: Health check shows warnings

**Solution:**
```powershell
npm run health  # See what's warning
npm run bootstrap  # Regenerate lockfiles
git add package-lock.json requirements.txt
git commit -m "deps: fix lockfiles"
```

---

## 11. Useful VSCode Extensions

Add to your VSCode:
- **EditorConfig** (maintains formatting)
- **ESLint** (linting feedback)
- **Prettier** (code formatting)
- **Thunder Client** or **REST Client** (API testing)
- **Python** (Microsoft official)

Settings auto-apply from `.editorconfig` and `.eslintrc.json`.

---

## 12. Getting Help

1. **Check CONTRIBUTING.md** — Guidelines for the workspace
2. **Read README.md** — Architecture and setup
3. **Review QUALITY_STATUS.md** — Current state and metrics
4. **Run health check** — `npm run health` catches most issues
5. **Check CI logs** — GitHub Actions shows exact errors

---

## Key Takeaways

✅ **Pre-commit hooks prevent bad commits** — trust them
✅ **Lockfiles keep builds reproducible** — always commit them
✅ **TypeScript strict catches bugs early** — respect type errors
✅ **Tests run in CI automatically** — green checkmarks matter
✅ **Dependencies auto-update** — review and merge Dependabot PRs

**Happy coding!** 🚀
