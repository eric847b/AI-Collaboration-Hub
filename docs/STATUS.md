# Workspace Status — AI Collaboration Hub

> Verified live state. Regenerated 2026-09-14 (replaces `QUALITY_STATUS.md`, `DELIVERY_SUMMARY.md`,
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
| nexus-infinity-hub | Node/React (Vite) | engines ≥26, coverage ≥70% CI gate, typedoc, Playwright E2E (4 tests incl. visual) |
| self-evolve-dash | Node/React (Vite) | strict TS, lint/typecheck/check/ci scripts, Playwright E2E (4 tests incl. visual) |
| collabhub-modules | Node | userscript modules; hosts free-AI CLI (`npm run ai`) |
| third-door-blink-controller | Node (Expo RN) | lockfile present, typecheck script, strict TS, ESLint + Prettier configs |
| ai-chat-websites | Node (Jest+ESLint) | own roadmap: `next_year_roadmap.md` (99% complete) |
| singularity-operator | Python 3.12 | multi-version CI (3.10–3.12), pytest+coverage |
| autonomous-github-agent | Python | standalone repo is source of truth (see SYNC_CATALYST) |
| nexus-core / solutions-dynamics / VectorFS / third-door-system | mixed | tooling/systems |

Auto-discovery: `bootstrap.ps1`, `workspace-gate.ps1`, `run-quality.ps1` enroll any root folder with
`package.json` (Node) or `requirements.txt` (Python) — no hardcoded lists.

### CI — 24 root workflows in `.github/workflows/`
`ai-guardian-suite-ci` · `all-projects-sanity` · `autonomous-agent` · `branch-cleanup` ·
`ci-self-heal` · `collabhub-modules-test` · `dependency-review` · `generate-docs` ·
`lint-autofix` · `lockfile-validation` · `nexus-agent-cron` · `nexus-enforce` · `python-checks` ·
`regression` · `secret-scan` · `security-scanning` · `solutions-dynamics` · `vulnerability-gate` ·
`workflow-lint` — plus `performance-monitoring`, `node-matrix`, `e2e-smoke` (+ load-test step),
`multi-os-gate` (Windows hard gate / Linux informational), `playwright-e2e` (full-browser E2E;
all added 2026-09-14).

### Local tooling
| Tool | Purpose |
|------|---------|
| `tools/workspace-gate.ps1` (v3) | THE quality gate — live actionlint, lockfiles, engines, hooks, Python reqs |
| `tools/run-quality.ps1` | 11-step catalyst series |
| `tools/bootstrap.ps1` | install all Node + Python deps |
| `tools/bundle-trend.cjs` | bundle-size ledger + regression gate (`collect`/`check`/`report`/`markdown`) — 2026-09-14 |
| `tools/sync-parity.mjs` + `tools/parity-map.json` | mapping-driven fleet mirror parity (`check`/`sync`, strict mode) — 41 files / 4 pairs at parity (2026-09-14) |
| `tools/check-doc-links.mjs` | relative-link health for all Markdown — 152 files / 0 broken (2026-09-14) |
| `tools/ops-dashboard.mjs` | OPS Dashboard → `docs/metrics/OPS-DASHBOARD.md` (workflows, tooling, bundle ledger, parity, links, machine telemetry) — `npm run dashboard` (2026-09-14) |
| `tools/verify-tools.mjs` | one-command health check for all `tools/*.mjs\|*.cjs`: `node --check` + read-only smoke runs (`npm run tools:verify`, `--strict` also fails on parity DIFFs) — 2026-09-15 |
| `tools/extension-check.mjs` | read-only health check for the ai-chat-websites Unified AI Assistant Suite extension: manifest MV3 shape, background.js routing-ladder plumbing, options.html ladder UI, LADDER_PROVIDERS parity, no hardcoded secrets (34 checks; wired into `multi-os-gate.yml`) — 2026-09-15 |
| `tools/secret-scan.mjs` | offline read-only twin of `.github/workflows/secret-scan.yml`: 20 detectors, redacted evidence, `--staged`/`--all`/`--strict`/`--self-test`/`--check-ci`/`--list-rules`; wired into `.husky/pre-commit` (staged) + `multi-os-gate.yml` (`--quiet` + CI-parity) — 2026-09-15 |
| `tools/handoff-check.mjs` | validates `.renitor/handoff-result.json` schema + freshness (durable rule 10); strips the PS 5.1 UTF-8 BOM trap before parsing; `skipped (machine-local)` when `.renitor/` is absent (gitignored) — 2026-09-15 |
| `tools/workflow-audit.mjs` | offline GitHub Actions security/hygiene audit — 12 rules (WF001–WF012), ratchet ledger `docs/metrics/workflow-audit-baseline.json` (`workflow-audit-baseline/v1`, deterministic, growth-only failures); flags `--strict`/`--check-baseline`/`--update-baseline`/`--baseline`/`--json`/`--quiet`/`--verbose`/`--self-test`/`--list-rules`; live tree 24 workflows / 119 findings (high 0 after the WF003 `curl\|bash` fix in `workflow-lint.yml`); wired into `workspace-gate` + `verify-tools` (12 tools green) — 2026-09-15 |
| `tools/e2e-smoke.mjs` | serve a built Vite app and assert HTTP 200 + marker — 2026-09-14 |
| `tools/load-test.mjs` | dependency-free load test: RPS + p50/p95/p99, error-rate & p95 gates — wired into e2e-smoke.yml (2026-09-14) |
| `tools/fix-security-alerts.cjs` | Dependabot-alert lockfile patching pipeline (moved from root 2026-09-14) |
| `tools/review-repos.ps1`, `tools/analyze-freedom.ps1` | inventory + freedom-goal reports |
| `.husky/pre-commit` | `secret-scan.mjs --staged` unconditionally FIRST (index-only, instant on empty staged set), then dependency-free `.husky/js-gate.mjs` on staged js/mjs/cjs; lintable-file fast path + empty-set guard (no npx) — 2026-09-15 |
| `.vscode/tasks.json` | gate / quality / bootstrap / bundle-trend / tools:verify tasks (rebuilt 2026-09-14) |
| `.vscode/launch.json` | Node + Vite debug configs (added 2026-09-14) |
| `.devcontainer/` | Node 26 + Python 3.12 universal image, `setup.sh` post-create |

### Known caveats
- `engines` wants **Node ≥26**; local runtime may be v24.x → gate emits an informational warning only.
- API-docs Pages deploy soft-fails when the `github-pages` environment is not enabled (artifacts still ship).
- `SECURITY_DASHBOARD.md` is machine-generated (autonomous agent telemetry); all-zero means no runs yet — not an error.
- Other agent sessions edit this monorepo concurrently — never stage their unstaged files.

## Last gate run

```
2026-09-15 — tools/workspace-gate.ps1 v3 (now includes the Workflow Audit step)
Passed=22  Failed=0  Warnings=1
  warn: node v24.14.0 < engines requirement >= 26 (npm not engine-strict; informational)
Status: PASS
```

