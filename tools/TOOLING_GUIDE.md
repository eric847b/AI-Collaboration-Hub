# Workspace Tooling Guide

> **Complete reference for all tools, scripts, and automation in the AI Collaboration Hub workspace.**
> 
> **Last updated:** 2026-09-26 · **Gate status:** PASS (24/24) · **Completed rounds:** 11

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

**Project scoping (Round 12 re-scope):**

Every subcommand (`collect`, `check`, `report`, `markdown`, `checksum`, `verify`) accepts `--project <app>` and is limited to that one auto-discovered project. Explicit flag only — no bare second positional (it collided with flag values like `--limit 1`), no stdin prompts:

```powershell
node tools/bundle-trend.cjs report --project nexus-infinity-hub --limit 5
node tools/bundle-trend.cjs check --project self-evolve-dash --threshold 15
```

Unknown project → exit 2 with the known list; a valid project with no build
output → exit 2 telling you to build it first. There is **no interactive mode**
(the stdin-prompt prototype was rejected in Round 11 and re-scoped to flags).

```powershell
node tools/bundle-trend.cjs checksum --project self-evolve-dash
node tools/bundle-trend.cjs markdown --project self-evolve-dash --out docs/metrics/bundle-report.md
node tools/bundle-trend.cjs --help          # full per-command flag contract
```

**Explicit-flag contract (Round 12 D):** both `--flag value` and `--flag=value`
work; flag values are tokenized separately from subcommands so `--limit 1` can
never be read as a command. An unknown command, an unknown flag, a flag used on
a command that does not accept it (e.g. `--out` on `collect`), a flag with no
value, or a stray bare positional all exit **2** pointing at `--help`. Nothing
is silently ignored, and nothing ever reads stdin.

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
npm run metrics:report                     # npm alias
```

**Wired into:** `performance-monitoring.yml` (Sat 03:00 + PR gate)

---

### `tools/new-project.mjs` — Project Template Generator

**Purpose:** Executable form of `docs/WORKSPACE_TEMPLATES.md` — stamps a
workspace-standard Vite/React app (strict TS, ESLint, Prettier, Playwright,
telemetry hook copied verbatim from the canonical source). Explicit flags only;
no stdin prompts (interactive prompts were tried and rejected in Round 11).

**Usage:**
```powershell
node tools/new-project.mjs --name my-app --dry-run  # preview 18 files
node tools/new-project.mjs --name my-app            # scaffold ./my-app
node tools/new-project.mjs --self-test              # temp-dir contract check
npm run scaffold                                    # help
```

**Wired into:** `verify-tools.mjs` smoke matrix (`--self-test`), `npm run scaffold`

---

### `tools/sync-parity.mjs` — Fleet Mirror Parity

**Purpose:** Mapping-driven byte-level parity between standalone repos and
their nested monorepo mirrors (`tools/parity-map.json`).

**Scope flag (Round 12 re-scope):** both subcommands accept
`--mode=overwrite|missing-only` (also `--mode <value>`) to restrict the run to
pairs of that mode — no stdin prompts; an unknown value exits 2.

```powershell
node tools/sync-parity.mjs check                       # all pairs (41 files / 4 pairs)
node tools/sync-parity.mjs check --strict              # exit 1 on any overwrite-mode DIFF
node tools/sync-parity.mjs check --mode=missing-only   # only missing-only pairs
node tools/sync-parity.mjs sync --mode=overwrite       # reconcile overwrite pairs only
```

**Exit codes:** `0` clean · `1` `--strict` drift · `2` bad flag/map.

**Wired into:** `multi-os-gate.yml` (Windows, strict), `npm run parity`

---

### `tools/sync-parity.mjs` — Explicit-flag Contract & Mode Scoping

**Purpose:** mapping-driven SHA-256 parity check + reconcile between standalone
repos (source of truth) and their nested monorepo mirrors (`tools/parity-map.json`).

**Usage:**
```powershell
node tools/sync-parity.mjs check --strict                  # CI gate (overwrite-mode drift fails)
node tools/sync-parity.mjs check --mode missing-only       # inspect only missing-only pairs
node tools/sync-parity.mjs sync  --mode=overwrite          # reconcile one mode
node tools/sync-parity.mjs --help                          # flag contract
```

**Explicit-flag contract (Round 12 D):** `check` (default) and `sync` are the only
commands; `--map`, `--mode=overwrite|missing-only` take values, `--strict` is a
boolean valid on `check` only. Unknown commands/flags/modes, extra positionals,
and `--strict` on `sync` all exit **2** with usage — previously a value like
`--mode overwrite` was mistaken for the subcommand and silently degraded to
`check`. `missing-only` runs never overwrite existing nested files (durable rule 12).

**Wired into:** `multi-os-gate.yml` (Windows, `check --strict`), `verify-tools.mjs` smoke

---

### `tools/telemetry-collector.mjs` — Self-Hosted Runtime Telemetry Sink

**Purpose:** zero-dependency receiver + reporter for the runtime error-telemetry hook
shipped in the Vite apps (`<app>/src/lib/telemetry.ts`). The hook is **inert until an
endpoint is configured**, so pointing it at this collector is an opt-in, no-network,
no-third-party step:

```ts
window.TELEMETRY_ENDPOINT = 'http://127.0.0.1:8787/v1/telemetry';
```

**Usage:**
```powershell
node tools/telemetry-collector.mjs serve                  # receive batches (127.0.0.1:8787/v1/telemetry)
node tools/telemetry-collector.mjs serve --port 9000 --out .\tmp\t.jsonl
node tools/telemetry-collector.mjs report --limit 20      # aggregate the sink
node tools/telemetry-collector.mjs report --json          # machine-readable
node tools/telemetry-collector.mjs prune --keep 5000      # trim to newest 5000 events
node tools/telemetry-collector.mjs prune --keep 5000 --dry-run
node tools/telemetry-collector.mjs --self-test            # offline contract tests
node tools/telemetry-collector.mjs --help                 # flag contract
```

**Flags:** `serve` — `--port` (8787) `--host` (127.0.0.1) `--path` (/v1/telemetry)
`--out` (tools/.tmp/telemetry/events.jsonl) `--max-body` (262144) `--max-entries` (200)
`--max-events-per-min` (600) `--dedupe-window` (5 s) `--allow-origin` (repeatable; defaults
to local Vite ports). `report` — `--out` `--limit` `--json`. `prune` — `--keep <n>`
(required) `--out` `--dry-run` `--json`.

**Safety contract:** validates/normalizes every batch (`{ appId, version, sentAt, entries[] }`),
drops entries the hook could never emit instead of poisoning a batch, de-dupes identical
events inside the window, and enforces a per-`appId` budget. The sink is written **only** by
`serve` (append) and `prune` (temp-file + rename, atomic) — every other command is read-only,
and no command reads stdin or prompts. `--self-test` must stand alone (exit 2 if combined
with a command); a silently ignored flag is a usage error, matching the sync-parity contract.

**Exit codes:** `0` ok · `1` self-test failure · `2` usage/setup error · `3` serve error.

**Wired into:** `verify-tools.mjs` (`report --limit 1` smoke), `npm run tools:selftest`,
`npm run telemetry:serve|report|prune|selftest`

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

**Mode scoping (Round 12 re-scope):** `check`/`sync` accept
`--mode=overwrite|missing-only` (also `--mode overwrite`) to limit the run to
pairs of that mode — `--mode=overwrite` is the strict parity slice CI cares
about. An unknown mode exits 2. No stdin prompts anywhere.

**See also:** `tools/sync-parity.mjs`, `docs/SYNC_CATALYST.md`, `tools/sync_fleet_catalysts.md`, `docs/TESTING_GUIDE.md`, `docs/TROUBLESHOOTING.md`