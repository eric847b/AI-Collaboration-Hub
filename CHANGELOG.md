# Changelog

All notable workspace-level changes are documented here.

### Added
- `tools/secret-scan.mjs` — offline, read-only twin of `.github/workflows/secret-scan.yml`: 20 detectors (OpenAI legacy/project, Anthropic, OpenRouter, Groq, GitHub PAT classic/fine-grained/OAuth/App/refresh, Google API key, AWS access key id, Slack, Stripe live, HuggingFace, npm, PEM private-key block, JWT, generic high-entropy/long-hex), redacted evidence, placeholder/env suppression. Flags `--staged` (git index), `--all`, `--strict`, `--json`, `--quiet`, `--verbose`, `--list-rules`, `--self-test`, `--check-ci`. Self-test asserts every detector fires, clean lines stay clean, all 12 CI alternations are exercised locally, and the scanner's own source cannot trip the CI grep. Live tree: 1551 files / 0 findings
- `tools/handoff-check.mjs` — validates `.renitor/handoff-result.json` against the schema in `.renitor/current-handoff.md` §14 (required keys, schema version, status vocabulary, summary length, `changedPaths`, proof + lifecycle coherence, unknown keys) plus handoff freshness (durable rule 10); `--file`, `--strict`, `--json`, `--quiet`, `--verbose`, `--self-test`; degrades to `skipped (machine-local)` when `.renitor/` is absent
- CI/local wiring: `multi-os-gate.yml` gains both `node --check` lines, a **Secret scan** step (`--quiet` + `--check-ci` on both OS) and a **Handoff schema check** step; `.husky/pre-commit` runs `secret-scan.mjs --staged` **before** the lintable-file fast path; `verify-tools.mjs` smoke matrix now 11 tools; new npm scripts `scan:secrets`, `scan:staged`, `check:handoff`, `tools:selftest`

### Fixed
- `.husky/pre-commit` fast path skipped non-lintable staged files, so a secret staged in a `.txt`/`.py`/`.env`/`.ps1` would have been committed unscanned — the staged secret scan now runs unconditionally first (index-only, instant on an empty staged set)
- `handoff-check.mjs` strips the PowerShell 5.1 `Set-Content -Encoding utf8` **BOM** before `JSON.parse` — without this, every PowerShell-written `.renitor/handoff-result.json` failed validation permanently (durable rule 11 trap, now executable rather than advisory)
- `tools/secret-scan.mjs --help`/`-h` previously ran a full repository scan instead of printing usage; both tools now have real `--help`

## [Unreleased] — 2026-09-15

### Added
- `tools/verify-tools.mjs` — one-command health check for all `tools/*.mjs|*.cjs` (`node --check` syntax + read-only smoke runs; `--strict` also fails on parity DIFFs; `npm run tools:verify`; VS Code task `tools: verify all workspace tools`); 8 tools, all green

## [Unreleased] — 2026-09-14

### Added
- `docs/ROADMAP.md` + `docs/STATUS.md` + `docs/ARCHIVE-improvement-rounds-2026-08.md` — consolidated planning canon (7 stale root docs removed); `AGENTS.md` agent onboarding; `docs/README.md` index; `.github/PULL_REQUEST_TEMPLATE.md`
- `tools/bundle-trend.cjs` — bundle-size ledger + 10% regression gate (`performance-monitoring.yml`: Saturdays 03:00 + PRs; ledger auto-committed on main)
- `tools/load-test.mjs` — dependency-free load tester (RPS + latency percentiles, error-rate/p95 gates; wired into `e2e-smoke.yml`)
- `tools/sync-parity.mjs` + `tools/parity-map.json` — mapping-driven fleet mirror parity tool (41 files / 4 pairs, all at parity)
- `tools/check-doc-links.mjs` — relative-link health checker for all Markdown (149 files, 0 broken)
- Playwright E2E for `nexus-infinity-hub` + `self-evolve-dash` (3 tests each; `playwright-e2e.yml` with chromium + report artifact)
- Workflows: `multi-os-gate.yml` (Windows hard gate / Linux informational), `playwright-e2e.yml`
- `.vscode/tasks.json` rebuilt + `launch.json` added (machine-local)
- Visual regression for both Vite apps (`e2e/visual.spec.js`; CI `mode=seed` dispatch commits Linux baselines, checks skip gracefully until seeded; `npm run test:visual`)
- `tools/ops-dashboard.mjs` — OPS Dashboard aggregating workflows/tooling/bundle ledger/fleet parity/link health/machine telemetry into `docs/metrics/OPS-DASHBOARD.md` (`npm run dashboard`; smoke + artifact in `multi-os-gate.yml`)
- `third-door-blink-controller`: `.prettierignore`, `.env.example`, `typecheck` script (`tsc --noEmit`); enables `--if-present` type-checking in `node-matrix.yml`

### Fixed
- Fleet sync parity restored (SHA256-verified): nested `autonomous-github-agent` was missing `agent.py`/`security.py`/`stale_branches.py`; 11/11 catalyst modules + 13/13 `singularity_operator` subtree byte-for-byte
- Orphaned gitlink removed: `modular-hub-modernization` (mode 160000 without `.gitmodules`); dir now a gitignored local working mirror
- 6 broken Markdown links fixed (ai-chat-websites Docs/ depth + pre-existing stale paths)
- Corrupted `.vscode/tasks.json` rebuilt; stale `QUALITY_STATUS` references updated in `DEVELOPER_GUIDE.md`, `ai-chat-websites/CONTRIBUTING.md`, `ai-chat-websites/Docs/API.md`; stale `npm run health/verify` docs updated to `npm run gate`
- `third-door-blink-controller`: `.gitignore` expanded with security-critical patterns (`.env*`, `.expo/`, `web-build/`, native build outputs, logs); previously only `node_modules` + `expo-env.d.ts` were ignored, risking accidental `.env.local` commits
- `third-door-blink-controller`: removed unused imports (`Text`, `Platform`, `Layout`) and dead `lastBlinkTime` state from `app/index.tsx`
- `third-door-blink-controller`: status indicator dot now shows amber (`#ffaa00`) for `mutating` state (was identical to `active`/green)
- `third-door-blink-controller`: `app.json` EAS `projectId` placeholder made self-documenting (`REPLACE_WITH_YOUR_EAS_PROJECT_ID`)

### Removed
- `_sg.py` (tracked scratch script), `tmp-alerts.json`, `tmp-reg-meta.json`, stale `FreedomReport.txt` / `LocalRepoReview.txt` (regenerable)
- `fix-security-alerts.cjs` moved from root into `tools/`

## [Unreleased] — 2026-08-25

### Security

- **.github/workflows/secret-scan.yml** — hardcoded-secret detection widened
  from 5 to 12 token families: adds OpenRouter (`sk-or-v1-…`), Groq (`gsk_…`),
  GitHub fine-grained PATs (`github_pat_…`), AWS access keys (`AKIA…`),
  Slack tokens (`xox[baprs]-…`) and PEM private-key blocks; the scan now also
  triggers on `*.key` / `*.pem` changes for push and PR alike. Zero false
  positives verified against the full tracked tree before shipping (f6f2ee3).

### Added

- **tools/workspace-gate.ps1** (v3) replaces and removes
  `verify-workspace.ps1` + `health-check.ps1`: one gate covering shared
  configs, workflow presence **plus live actionlint**, Node lockfiles,
  engines-vs-runtime comparison, Python requirements, and pre-commit hook
  LF integrity. `npm run gate` is canonical (`verify`/`health` alias it;
  `ci` runs just the gate); run-quality steps 4–5 consolidated.
- **.husky/pre-commit is now tracked** so fresh clones actually get a
  pre-commit gate — `package.json`'s `"prepare": "husky"` was creating shims
  with no hook behind them. Root ignore narrowed from `.husky/` to the
  generated `.husky/_/` internals only, and the hook is pinned to LF via
  `.gitattributes` so sh can always run it (5d053f2, 0843a5e).

### Fixed

- Husky pre-commit stall (>30 s): root cause was lint-staged hanging when
  invoked with an EMPTY staged set (not npx resolution). The hook now exits
  fast unless staged files match `*.js/jsx/ts/tsx/json/md/css`, and uses
  `npx --no-install`; the previously-hanging empty-commit path was verified
  end-to-end at ~5 s.
- **tools/run-quality.ps1 made machine-independent** — all hardcoded
  `C:\Users\Eric\…` paths replaced by a `$PSScriptRoot`-derived
  `$WorkspaceRoot`, repairing a gate-call line broken during the gate merge;
  last user-profile paths also purged from `analyze-freedom.ps1` /
  `review-repos.ps1` (d7a2137, e5d56ca).
- Secret-scan triggers extended again: `.husky/**` added so extensionless
  hook files are scanned too (d7a2137).

### Changed

- **.gitignore** — local AI-agent state dirs (`.claude/`, `.clinerules/`,
  `.renitor/`) are never tracked (f6f2ee3).

## [Unreleased] — 2026-08-24

### Changed

- **tools/verify-workspace.ps1** — replaced stale hardcoded Node project list
  (`nexus-infinity-hub`, `self-evolve-dash`, `collabhub-modules`) and Python list
  with auto-discovery: any root-level folder containing `package.json` (Node) or
  `requirements.txt` (Python) is now verified. Coverage went from 3 Node / 2
  Python to 5 Node (adds `ai-chat-websites`, `third-door-blink-controller`) /
  5 Python (adds `nexus-core`, `solutions-dynamics`, nested `AI-Collaboration-Hub`).
  Missing projects now fail the check instead of being silently skipped.
- **tools/health-check.ps1** — same auto-discovery for lockfile checks
  (`package-lock.json`) and `requirements.txt` presence; errors when zero
  projects are discovered.
- **tools/run-quality.ps1** — the catalyst series (`npm run quality`) now runs
  npm check/lint, audit, lint:fix, vitest coverage, builds, lockfile commits,
  and pip installs against auto-discovered projects instead of a frozen list,
  so `ai-chat-websites` and future projects join every gate automatically.
- **third-door-blink-controller** — added `overrides: { "nanoid": "^3.3.18" }`
  to eliminate the high-severity `nanoid` ID advisory
  (GHSA-2v37-7h3g-55p8) in the transitive metro/vite tree. Patched dependency
  confirmed in `package-lock.json` and `node_modules` (`3.3.18`); project audit
  dropped 18 → 17 findings with the high-severity `nanoid` gone. Remaining
  `image-size` (metro 0.8x) and `uuid` (expo/ngrok/xcode) advisories require
  breaking Expo SDK major upgrades and are flagged as follow-up work.

### Docs

- README.md: added missing `ai-chat-websites` / `nexus-core` /
  `solutions-dynamics` project entries and documented the auto-discovery rule.

## Earlier

See git history for prior workspace changes; per-project notes live in each
project's own CHANGELOG (e.g. `AI-Collaboration-Hub/CHANGELOG.md` tracks the
FreeAI permanent-free rotator releases).
