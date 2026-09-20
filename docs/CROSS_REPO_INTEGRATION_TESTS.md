# Cross-Repo Integration Tests

> **End-to-end validation of fleet mirror parity across standalone repos and nested mirrors.**
> 
> **Last updated:** 2026-09-19 · **Gate status:** PASS (22/22) · **Completed rounds:** 11

---

## Overview

This document describes integration tests that verify fleet mirror parity end-to-end, beyond the existing `sync-parity.mjs` check. These tests validate that standalone repos and their nested mirrors stay synchronized after catalyst updates.

---

## Current State

### Existing Tooling

- **`tools/sync-parity.mjs`** — Checks parity between standalone repos and nested mirrors
  - `check` command: Reports parity/DIFF/MISSING status per file
  - `sync` command: Applies sync (overwrite or missing-only mode)
  - Configured via `tools/parity-map.json`
  - Exit codes: 0 (pass), 1 (strict mode violation)

**Current parity status (2026-09-19):**
- 41 files / 4 pairs
- All at parity
- `--strict` exits 0

### Parity Map Configuration

The `tools/parity-map.json` defines 4 fleet pairs:

| Pair Name | Standalone Root | Nested Root | Mode | Items |
|-----------|-----------------|-------------|------|-------|
| autonomous-github-agent catalysts | `C:/Users/Eric/Documents/Cline/Repos/autonomous-github-agent` | `autonomous-github-agent` | overwrite | 11 files |
| singularity_operator subtree | `C:/Users/Eric/Documents/Cline/Repos/singularity-operator` | `singularity-operator` | overwrite | 13 files |
| collabhub-modules mirror | `C:/Users/Eric/Documents/Cline/Repos/collabhub-modules` | `collabhub-modules` | missing-only | excludes package.json + README.md |
| modular-hub-modernization mirror | `C:/Users/Eric/Documents/Cline/Repos/modular-hub-modernization` | `modular-hub-modernization` | missing-only | excludes README.md |

### Integration Test Framework

#### 1. SHA256 Hash Verification

**Purpose:** Verify byte-for-byte parity between standalone and nested files.

**Command:**
```bash
node tools/sync-parity.mjs check --strict
```

**Expected result:**
- Exit code 0
- All 41 files reported as `parity`

#### 2. Content Validation

**Purpose:** Verify that critical catalyst modules have correct content.

**Method:**
- Compare file hashes from both standalone and nested paths
- Verify module names match expected versions
- Check for drift after catalyst cycles

**Test files to verify:**
- `.github/agent.py` — Autonomous GitHub Agent v3.6
- `.github/security.py` — Security catalyst
- `.github/roi_catalyst.py` — ROI Catalyst v4.1.2
- `.github/failure_solver.py` — FailureSolver v3.5
- `singularity_operator/singularity_operator.py` — Launcher v0.5.10

#### 3. Functional Integration Tests

**Purpose:** Verify that catalyst modules work when executed in the nested environment.

**Test scenarios:**
1. **ROI Catalyst test:** Run `roi_catalyst.py` with `--self-test` flag
2. **FailureSolver test:** Run `failure_solver.py` with `--validate` flag
3. **Cross-repo coordinator test:** Run `cross_repo_coordinator.py` with `--dry-run`
4. **Fleet maintenance test:** Run `fleet_maintenance.py` with `--status` flag

#### 4. Workflow Integration Tests

**Purpose:** Verify GitHub Actions workflows function correctly.

**Test scenarios:**
1. **Fleet maintenance workflow:** `fleet-maintenance.yml` should be present in both repos
2. **Workflow file hash:** SHA256 must match between standalone and nested
3. **Workflow content:** Must contain expected triggers and permissions

---

## Integration Test Cases

### TC-001: Parity Check (Automated)

**Description:** Verify all fleet mirror pairs are at byte-level parity.

**Preconditions:**
- All standalone repos cloned locally
- `tools/parity-map.json` up to date

**Steps:**
1. Run `node tools/sync-parity.mjs check --strict`
2. Verify exit code is 0
3. Verify no DIFF or MISSING files reported

**Expected results:**
- Exit code: 0
- All 41 files at parity
- No violations reported

**Frequency:** Run before any sync commit; included in pre-push hook

---

### TC-002: SHA256 Hash Verification (Automated)

**Description:** Verify SHA256 hash parity for critical catalyst modules.

**Preconditions:**
- Standalone repos accessible
- Nested mirrors in monorepo

**Steps:**
1. For each critical module in `tools/parity-map.json`:
   - Read SHA256 of standalone file
   - Read SHA256 of nested file
   - Compare hashes
2. Log any mismatches

**Expected results:**
- All critical module hashes match
- No mismatches logged

**Critical modules:**
- 11 files from autonomous-github-agent
- 13 files from singularity_operator

**Frequency:** Run during CI on every push; run manually before sync commits

---

### TC-003: Functional Test — ROI Catalyst (Manual)

**Description:** Verify ROI Catalyst v4.1.2 functions correctly in nested environment.

**Preconditions:**
- `autonomous-github-agent/.github/roi_catalyst.py` exists
- Python 3.8+ available

**Steps:**
1. Navigate to standalone repo
2. Run: `python .github/roi_catalyst.py --self-test`
3. Navigate to nested mirror
4. Run: `python autonomous-github-agent/.github/roi_catalyst.py --self-test`
5. Compare outputs

**Expected results:**
- Both executions succeed
- Outputs match (same ROI calculations)
- Exit code 0 from both

**Frequency:** Run quarterly or before major releases

---

### TC-004: Functional Test — FailureSolver (Manual)

**Description:** Verify FailureSolver v3.5 works in nested environment.

**Preconditions:**
- `.github/failure_solver.py` exists in both paths

**Steps:**
1. Run `python failure_solver.py --validate` in standalone
2. Run identical command in nested mirror
3. Verify no syntax errors or import failures
4. Verify both produce same validation results

**Expected results:**
- Exit code 0
- Same validation results in both environments
- No import errors

**Frequency:** Run after any FailureSolver update

---

### TC-005: Workflow Validation (Semi-Automated)

**Description:** Verify GitHub Actions workflow files are valid and synchronized.

**Preconditions:**
- `fleet-maintenance.yml` present in both repos

**Steps:**
1. Verify file exists in both locations
2. Run actionlint on both files
3. Compare content hashes
4. Verify workflow triggers match expected patterns

**Expected results:**
- Both files pass actionlint
- Hashes match
- Triggers include `schedule` and `workflow_dispatch`

**Frequency:** Run during CI; automated

---

## Integration Test Execution

### Local Development

```bash
# 1. Check parity
node tools/sync-parity.mjs check --strict

# 2. Run functional tests (manual)
python .github/roi_catalyst.py --self-test
python .github/failure_solver.py --validate

# 3. Validate workflows
actionlint .github/workflows/fleet-maintenance.yml

# 4. Verify documentation parity
node tools/check-doc-links.mjs
```

### CI Pipeline Integration

The integration tests are embedded in CI workflows:

1. **multi-os-gate.yml** — Runs parity check, actionlint, workflow audit
2. **tools-verify.yml** — Runs verify-tools.mjs (syntax + smoke tests)
3. **ci.yml** — Runs gate + quality checks

### Pre-Push Validation

```bash
# Full pre-push validation
npm run gate         # 22 checks
node tools/sync-parity.mjs check --strict    # Parity check
node tools/workflow-audit.mjs --strict       # Workflow audit
```

---

## Integration Test Schedule

| Test Case | Type | Frequency | Automation |
|-----------|------|-----------|------------|
| TC-001: Parity Check | Automated | Every push, pre-commit, pre-push | ✅ Fully automated |
| TC-002: SHA256 Verification | Automated | Every push (CI), before sync commits | ✅ Fully automated |
| TC-003: ROI Catalyst | Manual | Quarterly, before releases | ⬜ Manual execution |
| TC-004: FailureSolver | Manual | After updates | ⬜ Manual execution |
| TC-005: Workflow Validation | Semi-Automated | Every push (CI) | ✅ actionlint in CI |

---

## Related Documentation

- **`docs/SYNC_CATALYST.md`** — Fleet component sync catalyst details
- **`tools/sync_fleet_catalysts.md`** — Fleet catalyst sync contract
- **`tools/TOOLING_GUIDE.md`** — Complete tooling reference
- **`docs/TESTING_GUIDE.md`** — Testing methodology and frameworks
- **`docs/TROUBLESHOOTING.md`** — Common issues and solutions

---

## Verification Log

| Date | Tested By | Parity Check | SHA256 Verification | Functional Tests | Status |
|------|-----------|--------------|-------------------|------------------|--------|
| 2026-09-19 | CI Pipeline | ✅ 41/41 files | ✅ All critical modules | ✅ Workflow audit PASS | PASS 22/22 |
| 2026-09-15 | CI Pipeline | ✅ 41/41 files | ✅ All critical modules | ✅ Workflow audit PASS | PASS 22/22 |
| 2026-09-14 | Manual | ✅ 41/41 files | ✅ Hash-backed verification | — | PASS |

---

> **Note:** This document is part of the Round 11+ development initiative. It complements the existing `sync-parity.mjs` tooling with structured integration tests that go beyond simple file hash comparison to verify functional parity of catalyst modules between standalone repositories and nested monorepo mirrors.