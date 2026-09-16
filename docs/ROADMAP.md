# Workspace Roadmap & Plan — AI Collaboration Hub

> **Single source of truth** for every plan, to-do list, and improvement round in this workspace.
> Supersedes (removed 2026-09-14): `CLINE_CONTINUOUS_IMPROVEMENT.md`, `DELIVERY_SUMMARY.md`,
> `IMPROVEMENTS_SUMMARY.md`, `IMPROVEMENTS_SUMMARY_NEW.md`, `QUALITY_STATUS.md`,
> `ROUND_3_COMPLETION.md`, `ROUND_3_STATUS.md`.
> History: `docs/ARCHIVE-improvement-rounds-2026-08.md` · Live state: `docs/STATUS.md`

**Last revised:** 2026-09-14 · **Quality gate:** `npm run gate` · **Full catalyst series:** `npm run quality`

## Legend

`[x]` done & verified · `[ ]` open · `🌐` external/community (needs accounts, services, or another repo) · `⏸` blocked / needs owner decision

---

## 1. Completed Rounds (summary)

| Round | Focus | Status |
|-------|-------|--------|
| 1 | Shared configs, CI scaffolding, bootstrap/verify tools, README | ✅ 2026-07-10 |
| 2 | Lockfiles 4/4, TypeScript strict, husky + lint-staged, Python CI, coverage tracking | ✅ 2026-08-14 |
| 3 | Coverage ≥70% gate, security scanning, API docs generation, VS Code workspace, DevContainer | ✅ 2026-08-14 (re-verified 2026-09-14) |
| 4 | Bundle/perf monitoring, multi-version Node CI, E2E smoke tests, debug launch configs, doc consolidation | ✅ 2026-09-14 |

### Round 3 verification checklist (was left unchecked; verified 2026-09-14)

- [x] Coverage threshold (70%) enforced in CI — `nexus-infinity-hub/.github/workflows/quality-checks.yml` (lines 69–80)
- [x] Security scanning workflow runs — `.github/workflows/security-scanning.yml` (+ `vulnerability-gate.yml`, `secret-scan.yml`)
- [x] API docs generate & deploy — `.github/workflows/generate-docs.yml` (artifacts 90d; Pages deploy soft-fails if env unset)
- [x] VS Code workspace opens all 6 projects — `AI-Collaboration-Hub.code-workspace`
- [x] DevContainer configured — `.devcontainer/` (Node 26 + Python 3.12 + setup.sh)
- [x] Pre-commit hooks working — `.husky/pre-commit` (direct `prettier`/`eslint`, empty-staged-set guard)
- [x] Tests / gate pass — `npm run gate` (see `docs/STATUS.md` for the latest run record)

---

## 2. Open Work — Round 5+ (prioritized)

### A. Quality & CI

- [x] Full E2E suite: Playwright for `nexus-infinity-hub` & `self-evolve-dash` — `@playwright/test` ^1.63 devDependency (lockfiles updated), `playwright.config.js` (serves the production build via `vite preview`), `e2e/app.spec.js` (3 tests: title, `#root` renders, zero console/page errors), `.github/workflows/playwright-e2e.yml` (chromium + HTML report artifact; validated via `test --list`) (2026-09-14)
- [x] Visual regression: Playwright screenshot diffing shipped — `e2e/visual.spec.js` (full-page `toHaveScreenshot`, animations disabled, 2% diff tolerance) in both apps; **baselines are seeded on Linux CI** via `playwright-e2e.yml` dispatch `mode=seed` (auto-commits `*-snapshots/`), checks skip gracefully until seeded; `npm run test:visual` (2026-09-14)
- [x] Load-testing framework — dependency-free `tools/load-test.mjs` (RPS + p50/p95/p99 latency, error-rate & p95 gates), wired into `e2e-smoke.yml` (2026-09-14)
- [x] Multi-OS spot-check — `.github/workflows/multi-os-gate.yml`: Windows hard gate + Linux informational pwsh gate + cross-platform `node --check` (2026-09-14)

### B. Observability

- [x] Bundle/perf trend ledger + CI regression gate → `tools/bundle-trend.cjs` + `performance-monitoring.yml` (2026-09-14)
- [x] Repo-level observability dashboard — `tools/ops-dashboard.mjs` → `docs/metrics/OPS-DASHBOARD.md`: aggregates CI workflow inventory (from disk), tooling inventory, bundle ledger + deltas, fleet mirror parity (live), Markdown link health (live), machine telemetry (`agent-report.json`, `auto-ops-report.json`, `auto-fix-ledger.json`). `npm run dashboard`; CI smoke + artifact in `multi-os-gate.yml` (2026-09-14)
- [ ] Runtime error-telemetry hook (product decision needed — which errors, where to report; the repo-level view is done via OPS-DASHBOARD)
- [ ] Synthetic/uptime monitoring 🌐 (external service)

### C. Fleet sync (from `docs/SYNC_CATALYST.md` + `tools/sync_fleet_catalysts.md`)

- [x] Byte-for-byte parity, all 11 critical catalyst modules — `agent.py`, `security.py`, `stale_branches.py`, `roi_catalyst.py`, `failure_solver.py`, `failure_solver_draft_ext.py`, `profile_io.py`, `cross_repo_coordinator.py`, `fleet_maintenance.py`, `fleet-maintenance.yml`, `completed_catalyst_dataset.md` (SHA256-verified 2026-09-14; several had drifted despite earlier ✅ claims — the nested mirror was even missing agent/security/stale_branches entirely)
- [x] Deep parity: `singularity_operator/` package subtree — 13/13 files, zero SHA256 diffs (2026-09-14)
- [x] Mirrors: modular-hub-modernization backfilled (9 files incl. FailureSolver trio); collabhub-modules partial (`VERSION`, `release.yml`); `zero-cost-wealth-playbook-tool` stays reference-only. 3 divergences (collabhub `package.json`/`README.md`, modular `README.md`) deliberately kept nested — the nested trees are actively developed here; flagged for manual review, never auto-overwritten. `modular-hub-modernization` turned out to be an **orphaned gitlink** (mode 160000, no `.gitmodules` mapping — unusable by fresh clones): gitlink removed and the dir is now a gitignored local working mirror of the standalone repo.

### D. External / community 🌐

- [ ] Third-party security audit (owned by `ai-chat-websites/next_year_roadmap.md`)
- [ ] GitHub Pages enablement for API docs (repo Settings → Pages → GitHub Actions) — workflow already deploys best-effort
- [ ] ai-chat-websites community items (Discord, video tutorials, store publishing, 80/90% coverage gates) — tracked in that repo's roadmap

### E. Housekeeping

- [x] Consolidate 7 stale planning docs → this file + `STATUS.md` + `ARCHIVE-improvement-rounds-2026-08.md` (2026-09-14)
- [x] Fix corrupted `.vscode/tasks.json` (broken JSON line); add real tasks + `.vscode/launch.json` (2026-09-14)
- [x] Root junk review (2026-09-14): deleted `_sg.py` (tracked scratch debug script), `tmp-alerts.json` + `tmp-reg-meta.json` (pipeline outputs), stale `FreedomReport.txt` / `LocalRepoReview.txt` (regenerable via `tools/review-repos.ps1` / `analyze-freedom.ps1`); moved the one-off `fix-security-alerts.cjs` pipeline into `tools/`; KEPT machine-state `agent-report.json`, `auto-fix-ledger.json`, `auto-ops-report.json` (actively written by `autonomous-agent.yml` / `ci-self-heal.yml`)

---

### F. Round 6 — new items (added AND completed 2026-09-14, session 2)

- [x] `tools/sync-parity.mjs` + `tools/parity-map.json` — the manual fleet sweep turned into a reusable, mapping-driven tool (`check`/`sync`, overwrite vs missing-only modes, standalone-clone-missing → auto-skip). Live-verified: **41 files / 4 pairs, all at parity, `--strict` exit 0**. Wired into `multi-os-gate.yml` (Windows, strict)
- [x] `tools/check-doc-links.mjs` — relative-link health checker for all Markdown; found and **fixed 6 real broken links** (incl. one introduced by this session's consolidation + pre-existing stale paths). Now **152 files / 38 links / 0 broken**. Wired into `multi-os-gate.yml` (both OS) + `npm run docs:check`
- [x] `AGENTS.md` at repo root — durable agent-onboarding rules (workspace map, commands, 12 durable rules incl. the PS 5.1 traps hit this session); closes the "no AGENTS.md" gap flagged by renitor
- [x] `docs/README.md` — documentation index (canonical entry points + machine-generated list)
- [x] `.github/PULL_REQUEST_TEMPLATE.md` — PR checklist wired to the gate, actionlint, parity check and repo rules (none existed at root)
- [x] `CHANGELOG.md` — full 2026-09-14 [Unreleased] section (Added/Fixed/Removed) covering all three commit batches
- [x] `.renitor/project-memory.md` — durable decisions file (was referenced by handoff §13 but never existed)
- [x] `bundle-trend.cjs markdown` — emits `docs/metrics/bundle-report.md` (latest + trend table) from the ledger; `npm run metrics:report`. New npm scripts: `docs:check`, `parity`, `metrics:report`

---

### G. Round 7 — new items (added AND completed 2026-09-15)

- [x] `tools/extension-check.mjs` — read-only health check for the ai-chat-websites Unified AI Assistant Suite extension (34 checks, all green): manifest.json MV3 shape (service worker, options page, permissions, provider host_permissions), `background.js` routing-ladder plumbing (`MODEL_LADDER`, user-ladder `validateLadder`/`getRoutingLadder`, ladder-aware `routedTier`/`runLadder`, Gemini + Ollama response parsing), `options.html` ladder UI (enable checkbox, JSON textarea, status feedback, storage keys), client↔background `LADDER_PROVIDERS` parity (the two duplicated validators cannot drift), no hardcoded secrets. Wired into `verify-tools.mjs` smoke matrix (now 9 tools, 9 green) + `multi-os-gate.yml` (syntax + `--quiet` step on both OS)
- [x] `multi-os-gate.yml` — extension health gate: `node --check tools/extension-check.mjs` in the both-OS syntax block + `extension-check.mjs --quiet` step; sibling browser-extension work (routing-ladder UI in `options.html` + ladder plumbing in `background.js`, observed in the working tree but belonging to another session — never staged or reverted) is now covered by CI instead of ad-hoc review
- [x] OPS Dashboard gained a `Browser Extension (Unified AI Assistant Suite)` section 2026-09-15 (`tools/ops-dashboard.mjs extensionSection()` inlines the full 34-check `extension-check.mjs` report) — the dashboard now surfaces per-check extension findings, not just pass/fail; regenerated `docs/metrics/OPS-DASHBOARD.md` (79 lines); `AGENTS.md` documents the new `node tools/extension-check.mjs [--quiet]` command row

---

### H. Round 8 — new items (added AND completed 2026-09-15)

- [x] `tools/secret-scan.mjs` — **offline, read-only twin of `.github/workflows/secret-scan.yml`** (20 detectors: OpenAI legacy/project, Anthropic, OpenRouter, Groq, GitHub PAT classic/fine-grained/OAuth/App/refresh, Google API key, AWS access key id, Slack, Stripe live, HuggingFace, npm, PEM private-key block, JWT, generic high-entropy + long-hex assignments). Every reported finding carries a **redacted** evidence string (last-12 leak is asserted absent), placeholder/env-expansion lines are suppressed (`--verbose` keeps them). Flags: `--staged` (git index — the pre-commit path), `--all` (tracked + untracked-unignored), `--strict` (warnings fail), `--json`, `--quiet`, `--verbose`, `--list-rules`, `--self-test`, `--check-ci`, `-h/--help`. Self-test proves detectors fire, clean lines stay clean, **every CI alternation is exercised locally**, and **this file's own source cannot trip the CI grep** (a latent workflow-breaking bug found and permanently guarded this round)
- [x] `tools/handoff-check.mjs` — validates `.renitor/handoff-result.json` against the schema documented in `.renitor/current-handoff.md` §14 (required keys, `schema` version, `status` vocabulary, `summary` length, non-empty absolute-ish `changedPaths`, validation-proof coherence, lifecycle coherence, unknown-key rejection) plus **handoff freshness** — the unknown-key/freshness classes that durable rule 10 depends on but nothing enforced. Flags: `--file <path>`, `--strict`, `--json`, `--quiet`, `--verbose`, `--self-test`, `-h/--help`. Degrades to `skipped (machine-local)` when `.renitor/` is absent (it is gitignored), so it is safe in CI
- [x] **Bug found and fixed by the new tooling:** PowerShell 5.1's `Set-Content -Encoding utf8` writes a UTF-8 **BOM**, and `JSON.parse` rejects it — any session writing the handoff from PowerShell would have failed validation forever. `handoff-check.mjs` now strips the BOM before parsing (negative control: a BOM'd handoff validates clean). This is exactly the trap in durable rule 11, now covered by an executable check instead of a warning comment
- [x] Wiring: `verify-tools.mjs` smoke matrix gained `secret-scan.mjs --quiet` + `handoff-check.mjs --quiet` (now 11 tools, all green); `multi-os-gate.yml` gained both `node --check` lines, a **Secret scan** step (`--quiet` + `--check-ci` on both OS so CI asserts its own twin has not drifted), and a **Handoff schema check** step; `.husky/pre-commit` now runs `secret-scan.mjs --staged` **before** the lintable-file fast path (a secret can hide in a `.txt`/`.py`/`.env` the js/md fast path ignores, and an index-only scan is instant on an empty staged set); `package.json` gained `scan:secrets`, `scan:staged`, `check:handoff`, `tools:selftest`
- [x] Validation evidence: `secret-scan.mjs --self-test` 20/20 detectors + 6 clean lines + 12 CI patterns, zero failures; `secret-scan.mjs --check-ci` 12/12; real tree scan 1551 files / 0 findings (zero false positives on the live repo); `handoff-check.mjs --self-test` 20/20 malformed-input defects caught; live `.renitor/handoff-result.json` clean; `-h`/`--help` on both tools now print usage instead of silently scanning (v1's `--help` ran a full scan — fixed)

---
### I. Round 9 — new items (added AND completed 2026-09-15)

- [x] `tools/workflow-audit.mjs` — offline, read-only **GitHub Actions security/hygiene audit** with 12 rules (WF001 untrusted `${{ }}` context into a shell, WF002 secret into a shell, WF003 `curl … \| bash`, WF004 privileged trigger `pull_request_target`/`workflow_run`, WF005 action not pinned to a commit SHA, WF006 no `permissions:` block, WF007 `write-all`, WF008 no job `timeout-minutes`, WF009 no `concurrency:` group, WF010 dispatch input into a shell, WF011 privileged trigger + untrusted checkout, WF012 secret in workflow-level `env:`). Flags: `--json`, `--quiet`, `--verbose`, `--strict`, `--check-baseline`, `--update-baseline`, `--baseline <path>`, `--self-test`, `--list-rules`, `-h/--help`. Exit codes: 0 clean-or-accepted, 1 growth/strict hit, 2 setup error. Read-only apart from `--update-baseline`, never touches the network, shells out to nothing
- [x] **Ratchet ledger** `docs/metrics/workflow-audit-baseline.json` (`workflow-audit-baseline/v1`, deterministic — no timestamps): per-workflow/per-rule accepted finding counts; **only growth fails**, so existing debt never blocks a commit, and fixing debt turns the entry stale — `--check-baseline` then asks for it to be trimmed in the same change. Severity never gates beside the ledger (an accepted `high` is reported under ATTENTION and still exits 0); `--strict` promotes high/medium to unconditional failures for when the repo drives debt to zero. The exit-code contract is pinned by a self-test regression section
- [x] **Real finding fixed:** `workflow-lint.yml` installed actionlint by piping a remote script into bash (`curl … \| bash` — WF003, the canonical CI RCE). Replaced with a checksum-verified release-asset fetch (`sha256sum --check --strict` against a hash pinned in the workflow, actionlint 1.7.7 linux/amd64); the workflow also gained `permissions: contents: read`, a `concurrency:` group and `timeout-minutes`, clearing its own WF006/WF008/WF009
- [x] Wiring: `npm run workflow:audit` + `workflow:audit:strict`; `tools:selftest` chains the third self-test; `verify-tools.mjs` smoke matrix now **12 tools, 12 green**; `workspace-gate.ps1` gained a Workflow Audit step (gate now 22 checks); `AGENTS.md` documents the command row; ledger seeded at **24 workflows / 119 findings (high 0, medium 78, low 41 — WF005 68, WF006 9, WF004 1, WF008 20, WF009 21)**
- [x] Self-test evidence: `--self-test` fires 12/12 fixtures exactly once on the right line, plus the ledger-read boundary (BOM/shape/malformed rejected — the same PS 5.1 BOM trap as handoff-check) and the exit-code contract (ledger-only default, `--strict` opt-in, low always advisory); `--check-baseline` green on the live tree

---

## 3. Continuous Improvement Loop (updated 2026-09-14)

Replaces `CLINE_CONTINUOUS_IMPROVEMENT.md` (deleted; its stale `npm run health/verify` commands pointed at scripts that no longer exist):

```
Run the autonomous continuous improvement cycle:
1. npm run gate                     # workspace-gate v3: configs, workflows + live actionlint,
2. Fix any gate failures            #   lockfiles, engines compare, Python reqs, hook LF integrity
3. node tools/bundle-trend.cjs collect   # refresh the perf ledger (after builds)
4. npm audit in Node projects; pip-audit where available
5. Commit (husky gate runs automatically) and sync via resilient-git.ps1
6. Repeat every ~30 min while iterating
```

**Automation already wired:** `autonomous-agent.yml` (6h) · `performance-monitoring.yml` (Sat 03:00 + PR gate) · `security-scanning.yml` (Sun 02:00) · `node-matrix.yml` (Sat 03:30 + PRs) · `e2e-smoke.yml` (PRs + main) · VS Code tasks (Ctrl+Shift+B): gate / quality / bootstrap / bundle-trend.

---

## 4. Rules of engagement (durable)

- Workflows MUST pass `actionlint` (`C:\Users\Eric\Documents\Cline\Tools\actionlint.exe`) before commit.
- Sync exclusively via `C:\Users\Eric\Documents\Cline\Hooks\resilient-git.ps1 sync -Repo <root>`; never bare push/pull.
- Never stage or revert other agent sessions' unstaged work.
- No secrets in the repo — provider keys live only in `~/.cline/data/settings/…` or encrypted Actions secrets.
- `tools/*.ps1` must derive all paths from `$PSScriptRoot`; absolute user profiles are forbidden.
- Never use `npx` inside `.husky/pre-commit` (stalls); the hook calls `node_modules/.bin/*` directly.
