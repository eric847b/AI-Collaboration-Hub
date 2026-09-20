# Workspace Tooling Guide

> **Complete reference for all tools, scripts, and automation in the AI Collaboration Hub workspace.**
> 
> **Last updated:** 2026-09-19 · **Gate status:** PASS (22/22) · **Completed rounds:** 10

---

## Quick Start

```powershell
# Install all dependencies
npm run bootstrap

# Run the quality gate (THE primary check)
npm run gate

# Run full quality catalyst series
npm run quality

# Generate OPS dashboard
npm run dashboard
```

**All commands are run from the workspace root.**

---

### `tools/run-quality.ps1` — Full Catalyst Series

**Purpose:** 11-step comprehensive quality pipeline.

**Steps:**
1. Bootstrap
2. npm check/lint
3. Python install
4. Health check
5. Verify
6. npm audit
7. ESLint fix
8. Vitest coverage
9. Build
10. Lockfile commit
11. Fleet audit

**Usage:**
```powershell
npm run quality
# or
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\run-quality.ps1
```

---

### `tools/verify-tools.mjs` — Tool Health Check

**Purpose:** One-command health check for all `tools/*.mjs|*.cjs` — syntax + read-only smoke runs.

**Features:**
- `node --check` syntax validation for all tools
- Read-only smoke runs (safe, no side effects)
- `--strict` mode also fails on parity DIFFs
- 12 tools verified green

**Usage:**
```powershell
node tools/verify-tools.mjs          # basic check
node tools/verify-tools.mjs --strict # strict mode (fails on parity diffs)
npm run tools:verify                 # npm alias
```

**Wired into:** `workspace-gate`, `multi-os-gate.yml`, `verify-tools` VS Code task

---

## CI/CD & Workflow Tools

### `tools/workflow-audit.mjs` — GitHub Actions Security Audit

**Purpose:** Offline GitHub Actions security/hygiene audit — 12 rules (WF001–WF012).

**Rules checked:**
- WF001: Untrusted context in shell
- WF002: Secret in workflow-level env
- WF003: `curl | bash` in shell
- WF004: Privileged trigger with untrusted checkout
- WF005: Non-SHA action pins (supply-chain risk)
- WF006: Missing job timeout
- WF007: Missing concurrency group
- WF008: Missing top-level permissions
- WF009: Overbroad write permissions
- WF010: dispatch/PR inputs in shell
- WF011: Untrusted checkout on privileged trigger
- WF012: Secret in workflow-level env (duplicate check)

**Features:**
- Ratchet ledger `docs/metrics/workflow-audit-baseline.json` (growth-only failures)
- Accepted debt exits 0
- `--strict` also fails on medium findings
- Self-test: 12/12 fixtures + ledger boundary + exit-code contract

**Usage:**
```powershell
node tools/workflow-audit.mjs                           # basic audit
node tools/workflow-audit.mjs --strict                 # strict mode
node tools/workflow-audit.mjs --check-baseline         # compare to baseline
node tools/workflow-audit.mjs --update-baseline        # update baseline
node tools/workflow-audit.mjs --self-test              # run self-test
node tools/workflow-audit.mjs --list-rules             # list all rules
npm run workflow:audit                                 # npm alias
```

**Status:** 1 accepted finding (WF004 review-flag on `ci-self-heal.yml`)

**Wired into:** `workspace-gate`, `verify-tools`

---

### `tools/secret-scan.mjs` — Secret Detection

**Purpose:** Offline, read-only twin of `.github/workflows/secret-scan.yml` — 20 detectors with redacted evidence.

**Detectors (20):**
- OpenAI legacy/project keys, Anthropic, OpenRouter, Groq keys
- GitHub PAT (classic/fine-grained/OAuth/App/refresh)
- Google API key, AWS access key ID
- Slack, Stripe live, HuggingFace tokens
- npm tokens, PEM private-key blocks, JWT
- Generic high-entropy/long-hex patterns

**Features:**
- `--staged`: Scan git index only (wired into `.husky/pre-commit`)
- `--all`: Scan all files, `--strict`: Strict mode
- `--json`: JSON output, `--quiet`: Quiet mode
- `--verbose`: Verbose output
- `--self-test`: Assert every detector fires, clean lines stay clean
- `--check-ci`: Prove every CI pattern is exercised locally
- `--list-rules`: List all detectors

**Usage:**
```powershell
node tools/secret-scan.mjs --staged          # scan staged files
node tools/secret-scan.mjs --all             # scan all files
node tools/secret-scan.mjs --quiet          # quiet mode
node tools/secret-scan.mjs --self-test      # run self-test
npm run scan:secrets                         # npm alias
npm run scan:staged                          # scan staged only
```

**Status:** Live tree: 1551 files / 0 findings

**Wired into:** `.husky/pre-commit` (FIRST, unconditional), `multi-os-gate.yml`

---

### `tools/bundle-trend.cjs` — Bundle Size Ledger

**Purpose:** Bundle-size tracking + regression gate.

**Interactive Mode:**

Run without arguments to enter interactive mode:

```powershell
node tools/bundle-trend.cjs
```

This will prompt you to select a command and show examples. Helpful for new users!

**Commands:**
- `collect`: Snapshot every project's build output into `docs/metrics/bundle-history.json`
- `check`: Fail on >10% growth (regression gate)
- `report`: Print history
- `markdown`: Emit `docs/metrics/bundle-report.md` (latest + trend table)
- `checksum`: SHA-256 manifest of build outputs (pre-build integrity gate)
- `verify`: Verify build outputs match manifest (fail on drift)

**Features:**
- Pre-build integrity gate: `checksum` (SHA-256 manifest) + `verify` (re-hash + diff)
- Idempotent checksums
- Live-validated: clean exit 0, injected drift detected & reported

**Usage:**
```powershell
node tools/bundle-trend.cjs collect        # collect snapshots
node tools/bundle-trend.cjs check         # check for regressions
node tools/bundle-trend.cjs report        # print history
node tools/bundle-trend.cjs markdown      # generate markdown report
node tools/bundle-trend.cjs checksum      # create manifest
node tools/bundle-trend.cjs verify        # verify against manifest
node tools/bundle-trend.cjs               # interactive mode (prompts for command)
npm run metrics:report                     # npm alias
```

**Wired into:** `performance-monitoring.yml` (Sat 03:00 + PR gate)

---

### Integration Testing Reference

**Cross-Repo Integration Tests:** `docs/CROSS_REPO_INTEGRATION_TESTS.md` provides structured integration tests that go beyond `sync-parity.mjs` to verify functional parity of catalyst modules between standalone repositories and nested monorepo mirrors.

**Test cases documented:**
- **TC-001:** Parity Check (Automated) — Verify all fleet mirror pairs at byte-level parity
- **TC-002:** SHA256 Verification (Automated) — Hash parity for critical catalyst modules
- **TC-003:** ROI Catalyst (Manual) — Functional test of ROI Catalyst v4.1.2
- **TC-004:** FailureSolver (Manual) — Functional test of FailureSolver v3.5
- **TC-005:** Workflow Validation (Semi-Automated) — GitHub Actions workflow validation

**Run all integration tests locally:**
```bash
node tools/sync-parity.mjs check --strict  # TC-001 + TC-002
python .github/roi_catalyst.py --self-test  # TC-003 (standalone)
python autonomous-github-agent/.github/roi_catalyst.py --self-test  # TC-003 (nested)
actionlint .github/workflows/fleet-maintenance.yml  # TC-005
```

**See also:** `tools/sync-parity.mjs`, `docs/SYNC_CATALYST.md`, `tools/sync_fleet_catalysts.md`, `docs/TESTING_GUIDE.md`, `docs/TROUBLESHOOTING.md`