# Workspace Status — AI Collaboration Hub

> Verified live state. Regenerated 2026-09-19 (replaces `QUALITY_STATUS.md`, `DELIVERY_SUMMARY.md`,
> `IMPROVEMENTS_SUMMARY*.md`, `ROUND_3_*.md`). Plan/open items live in `docs/ROADMAP.md`.

## How to check health right now

```powershell
npm run gate     # workspace-gate v3 — the ONE entrypoint (verify/health/ci all alias it)
npm run quality  # full catalyst series (run-quality.ps1): bootstrap → checks → audit → coverage → build → fleet audit
```

## Verified inventory (2026-09-14)

### Projects
| Project | Type | Notes |
|---------|------|-------|
| nexus-infinity-hub | Node/React (Vite) | engines ≥26, coverage ≥70% CI gate, typedoc, Playwright E2E (4 tests incl. visual), runtime error-telemetry hook (13 vitest tests) |
| self-evolve-dash | Node/React (Vite) | strict TS, lint/typecheck/check/ci scripts, Playwright E2E (4 tests incl. visual), runtime error-telemetry hook (ErrorBoundary wired) |
| collabhub-modules | Node | userscript modules; hosts free-AI CLI (`npm run ai`) |
| third-door-blink-controller | Node (Expo RN) | lockfile present, typecheck script, strict TS, ESLint + Prettier configs |
| ai-chat-websites | Node (Jest+ESLint) | own roadmap: `next_year_roadmap.md` (99% complete) |
| singularity-operator | Python 3.12 | multi-version CI (3.10–3.12), pytest+coverage |
| autonomous-github-agent | Python | standalone repo is source of truth (see SYNC_CATALYST) |
| nexus-core / solutions-dynamics / VectorFS / third-door-system | mixed | tooling/systems |

Auto-discovery: `bootstrap.ps1`, `workspace-gate.ps1`, `run-quality.ps1` enroll any root folder with
`package.json` (Node) or `requirements.txt` (Python) — no hardcoded lists.

### CI — 25 root workflows in `.github/workflows/`
`ai-guardian-suite-ci` · `all-projects-sanity` · `autonomous-agent` · `branch-cleanup` ·
`ci-self-heal` · `collabhub-modules-test` · `dependency-review` · `generate-docs` ·
`lint-autofix` · `lockfile-validation` · `nexus-agent-cron` · `nexus-enforce` · `python-checks` ·
`regression` · `secret-scan` · `security-scanning` · `solutions-dynamics` · `vulnerability-gate` ·
`workflow-lint` — plus `performance-monitoring`, `node-matrix`, `e2e-smoke` (+ load-test step),
`multi-os-gate` (Windows hard gate / Linux informational), `playwright-e2e` (full-browser E2E;
all added 2026-09-14), `ops-dashboard-refresh` (daily dashboard cron + manual dispatch, gate +
regen + freshness check + change-only commit; added 2026-09-19).

All 70 `uses:` action pins are full commit SHAs with the original ref as a trailing comment
(`owner/repo@<sha> # <ref>`) — WF005 supply-chain debt zeroed 2026-09-15 by the `workflow-audit`
ratchet (ledger 119 → 51 accepted findings; nested standalone-repo workflows remain mirror-owned;
`ops-dashboard-refresh` added 2026-09-19 SHA-pinned from day one).
All 25 root workflows also carry least-privilege top-level `permissions:`, job `timeout-minutes`
(30) and top-level `concurrency:` groups — WF008/WF009/WF006 debt zeroed 2026-09-15, ratchet
ledger 51 → 1 accepted finding (the documented WF004 review-flag on the legitimate privileged
`ci-self-heal` trigger; `cancel-in-progress: true` only on the 6 PR-only flows, `false` on the
15 scheduled/agent crons so mid-run work is never killed).


### Local tooling
| Tool | Purpose |
|------|---------|
| `tools/workspace-gate.ps1` (v3) | THE quality gate — live actionlint, lockfiles, engines, hooks, Python reqs |
| `tools/run-quality.ps1` | 11-step catalyst series |
| `tools/bootstrap.ps1` | install all Node + Python deps |
| `tools/bundle-trend.cjs` | bundle-size ledger + regression gate (`collect`/`check`/`report`/`markdown`); B1 alerting: `::error::` annotations on regression + optional webhook (`BUNDLE_ALERT_WEBHOOK`, step-scoped in `performance-monitoring.yml`); `--project <app>` scopes any subcommand to one auto-discovered project (unknown → exit 2) — 2026-09-14, scoping 2026-09-26 |
| `tools/sync-parity.mjs` + `tools/parity-map.json` | mapping-driven fleet mirror parity (`check`/`sync`, strict mode); `--mode=overwrite\|missing-only` scopes a run to one pair mode (unknown → exit 2) — 41 files / 4 pairs at parity (2026-09-14, mode scoping 2026-09-26) |
| `tools/cross-repo-tests.mjs` | end-to-end fleet integration tests: SHA256 parity + hash verification of the standalone catalysts, module self-test entries, workflow validation (TC-001–TC-005) — 5/5 (2026-09-19) |
| `tools/check-doc-links.mjs` | relative-link health for all Markdown — 165 files / 47 links / 0 broken (2026-09-19) |
| `tools/ops-dashboard.mjs` | OPS Dashboard → `docs/metrics/OPS-DASHBOARD.md` (workflows, tooling, bundle ledger, coverage trends, parity, links, machine telemetry) — `npm run dashboard`; C2 freshness guard: per-section `ts:` markers, idempotent regen, `--refresh` (force-bump timestamps for stale-but-unchanged dashboards, used by cron), `--check` staleness mode (consumed by gate, verify-tools + cron); warn-only PS 5.1-safe gate step — 2026-09-14, freshness 2026-09-19; machine telemetry aggregation 2026-09-26 (agent success rate + ops actions/error budget + auto-fix resolved rate with by_type/by_status) |
| `tools/verify-tools.mjs` | one-command health check for all `tools/*.mjs\|*.cjs`: `node --check` + read-only smoke runs (`npm run tools:verify`, `--strict` also fails on parity DIFFs). **v2 tiered verdicts (2026-10-01):** `ok`/`warn`/`fail` — a stale OPS-dashboard stamp is `warn` (`dashboard-stale`, exit 0) while structural faults (`dashboard-output-missing`, `dashboard-markers-missing`) and every other tool defect stay `fail`; `--strict` promotes warns, `--json` emits a schema-1 report, `--quiet`/`--list`/`--self-test` (47 checks; **v2.1 no-silent-green guards** reject an unmatched `--only` selector (`no-tools-matched`, exit 1) and a non-numeric `--max-age-hours` (exit 2) instead of printing "0 tools, 0 failed") added, `--only <tool[,tool]>` narrows the matrix for triage, `--max-age-hours <h>` forwarded to the dashboard probe; `tools:verify:strict`/`tools:verify:json` aliases. **`--check-cli` (2026-10-01, Round 12 D):** asserts every tool in `tools/` answers `--help` with exit 0 and REJECTS an unknown flag with a non-zero exit — the anti-silent-ignore contract (`npm run tools:verify:cli`). 19/19 tools conform; proven to fail in both directions (a guard-less probe tool → 19/20 exit 1 and `npm run gate` → `Status: FAIL`). Probes run 6-wide concurrently with a 10 s per-probe timeout (~6.4 s total; 38 serial cold-starts exceeded 30 s). Wired into `workspace-gate.ps1` (a **failing** step, gate 23 → 24), `multi-os-gate.yml`, and the `tools:selftest` chain — a check nothing runs would rot. Isolation evidence 2026-10-01: same stale dashboard → `1 warn / 0 failed / exit 0`, plus `--strict` → exit 1, `--only check-doc-links.mjs` → exit 0. Smoke covers doc-links, extension, secret-scan, workflow-audit, dependabot, handoff, parity, new-project self-test, bundle/coverage/flake report --limit 1, dashboard --check, telemetry collector/export — 2026-09-15, flake smoke 2026-09-26, telemetry smoke 2026-09-26, tiering 2026-10-01, CLI contract 2026-10-01 |
| `tools/telemetry-collector.mjs` | self-hosted zero-dependency receiver + reporter for the runtime error-telemetry hook: `serve` (batches validated/normalized/de-duped + per-`appId` budget → machine-local JSONL sink `tools/.tmp/telemetry/events.jsonl`), `report` (aggregate by app/kind/path, `--json`), `prune --keep <n>` (atomic rewrite, `--dry-run`), `--self-test` (113 checks), `--help` contract; read-only unless `serve`/`prune`, never reads stdin — 2026-09-26 |
| `tools/telemetry-export.mjs` | loopback bridge browser→collector: `snippet`/`serve` (127.0.0.1 only)/`push --dump`/`dump --into` (JSONL→batch dump, re-ingestible via `push --file`)/`sync-fleet` (git-inbox batch channel for the ephemeral GH Actions fleet; `--into` outside this repo, push left to resilient-git), reuses collector validation + sink; OPS dashboard `telemetry` section aggregates the sink; fleet side closed by `autonomous-github-agent` `.github/agent_telemetry_intake.mjs` + `telemetry-intake.yml` (self-test 7/7, parity 15/15; live E2E 2026-10-01 x2 rounds -> sink 2 events, runs `36808189074`+`36812019188` green) — 2026-09-28, dump fix + fleet intake 2026-09-30, self-test 35/35 |
| `tools/extension-check.mjs` | read-only health check for the ai-chat-websites Unified AI Assistant Suite extension: manifest MV3 shape, background.js routing-ladder plumbing, options.html ladder UI, LADDER_PROVIDERS parity, no hardcoded secrets (34 checks; wired into `multi-os-gate.yml`) — 2026-09-15 |
| `tools/secret-scan.mjs` | offline read-only twin of `.github/workflows/secret-scan.yml`: 20 detectors, redacted evidence, `--staged`/`--all`/`--strict`/`--self-test`/`--check-ci`/`--list-rules`; wired into `.husky/pre-commit` (staged) + `multi-os-gate.yml` (`--quiet` + CI-parity) — 2026-09-15 |
| `tools/handoff-check.mjs` | validates `.renitor/handoff-result.json` schema + freshness (durable rule 10); strips the PS 5.1 UTF-8 BOM trap before parsing; `skipped (machine-local)` when `.renitor/` is absent (gitignored); v2.2 adds optional integer `expectedExitCode` on `validation[]` entries so intentional non-zero guard probes are accepted instead of warned (mismatch warns, non-integer errors) — 2026-10-01 |
| `tools/workflow-audit.mjs` | offline GitHub Actions security/hygiene audit — 12 rules (WF001–WF012), ratchet ledger `docs/metrics/workflow-audit-baseline.json` (`workflow-audit-baseline/v1`, deterministic, growth-only failures); flags `--strict`/`--check-baseline`/`--update-baseline`/`--baseline`/`--json`/`--quiet`/`--verbose`/`--self-test`/`--list-rules`; live tree 24 workflows / 119 findings (high 0 after the WF003 `curl\|bash` fix in `workflow-lint.yml`); wired into `workspace-gate` + `verify-tools` (12 tools green) — 2026-09-15 |
| `tools/e2e-smoke.mjs` | serve a built Vite app and assert HTTP 200 + marker on every `--route` (repeatable; multi-route synthetic probing) — 2026-09-14, routes added 2026-09-16 |
| `tools/load-test.mjs` | dependency-free load test: RPS + p50/p95/p99, error-rate & p95 gates — wired into e2e-smoke.yml (2026-09-14) |
| `tools/fix-security-alerts.cjs` | Dependabot-alert lockfile patching pipeline (moved from root 2026-09-14) |
| `tools/review-repos.ps1`, `tools/analyze-freedom.ps1` | inventory + freedom-goal reports |
| `.husky/pre-commit` | `secret-scan.mjs --staged` unconditionally FIRST (index-only, instant on empty staged set), then dependency-free `.husky/js-gate.mjs` on staged js/mjs/cjs; lintable-file fast path + empty-set guard (no npx) — 2026-09-15 |
| `.github/workflows/multi-os-gate.yml` | both-OS (ubuntu + windows) spot-check on PRs touching `tools/**` + weekly: doc-link health, extension, secret scan + `--check-ci`, handoff schema, fleet parity (Windows), **`--check-cli` 19/19 CLI contract**, **`verify-tools --self-test` 47 checks**, and the **full tool self-test suite** (secret-scan, handoff-check, workflow-audit, telemetry-collector, telemetry-export — ~13 s, read-only, tree byte-identical after a run), then `npm run gate` (hard on Windows, informational on Linux) — self-tests in CI since 2026-10-01 |
| `.vscode/tasks.json` | gate / quality / bootstrap / bundle-trend / tools:verify tasks (rebuilt 2026-09-14) |
| `.vscode/launch.json` | Node + Vite debug configs (added 2026-09-14) |
| `.devcontainer/` | Node 26 + Python 3.12 universal image, `setup.sh` post-create |

### Known caveats
- **Node runtime delta (accepted, permanent until the machine is upgraded):** `engines`
  and CI require **Node ≥26** (pinned by `.nvmrc` and `.node-version`, both `26`), while this
  machine's default runtime is **v24.14.0** with no version manager (nvm/fnm/volta) installed.
  The gate emits an informational warning only — it is documented accepted debt, **not** an
  error to "fix" by editing `engines` (CI would then regress to the older runtime). Revisit by
  installing Node 26 (or a version manager that honours the two pin files), after which the
  warning disappears on its own.
- API-docs Pages deploy soft-fails when the `github-pages` environment is not enabled (artifacts still ship).
- `SECURITY_DASHBOARD.md` is machine-generated (autonomous agent telemetry); all-zero means no runs yet — not an error.
- Other agent sessions edit this monorepo concurrently — never stage their unstaged files.

## Last gate run

```
| 2026-10-01 — tools/workspace-gate.ps1 v3 (Tool CLI Contract step added; gate 23 -> 24)
Passed=24  Failed=0  Warnings=2
  warn: ops dashboard stale or missing timestamps (warn-only freshness step, by design)
  warn: node v24.14.0 < engines requirement >= 26 (accepted local delta - see docs/STATUS.md 'Node runtime delta'; npm is not engine-strict)
Status: PASS
```

**Completed rounds:** 11 (Rounds 1-11 all ✅ as of 2026-09-19)
**Current focus:** Round 12+ — see `docs/ROADMAP.md` section 2 for prioritized open work
**Round 12 progress (2026-09-26):** B1 alerts ✅ · C2 freshness ✅ · coverage trend ✅ · telemetry aggregation ✅ · flake tracker ✅ · template generator ✅ · CLI re-scope (bundle-trend `--project`, sync-parity `--mode`) ✅. Open: production telemetry endpoint owner item CLOSED 2026-10-01 (`sync-fleet` loop — see ROADMAP §2; the self-hosted collector continues to cover local dev/diagnostic capture). GitHub Pages for API docs ENABLED 2026-09-27 (workflow build type + root `index.html` fix, see ROADMAP section A). Node-26 local alignment DECIDED: accepted v24/26 delta documented permanently (ROADMAP section 2, revisit triggers listed; pinned machine-readably via `.nvmrc` + new `.node-version`, and the gate warning now names the accepted delta + links this page). `extension-check` now 34/34 green on working-tree sources (routing-ladder validation + `LADDER_PROVIDERS` parity landed in `background.js`/`options.html` 2026-09-26); verify-tools 18/18 green. Telemetry collector ✅: `tools/telemetry-collector.mjs` — zero-dependency self-hosted `serve`/`report`/`prune` sink for the runtime error-telemetry hook (self-test 113/113; smoke-wired into verify-tools; `npm run telemetry:serve|report|prune|selftest`). **CLI flag contract ✅ (2026-10-01):** all 19 `tools/*.mjs|*.cjs` use an explicit flag inventory — `--help` exits 0, unknown flags / missing values / bad boolean values / stray positionals exit non-zero, in `--flag`, `--flag=value` and `--flag value` forms; six concrete silent-ignore bugs fixed (notably `--stric` running secret-scan leniently and `--dryrun` scaffolding real files). Enforced by `verify-tools.mjs --check-cli` (19/19, proven to fail when a tool regresses) and wired into the gate (23 → 24, failing), `multi-os-gate.yml`, and `tools:selftest`.

