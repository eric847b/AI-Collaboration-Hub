# Workspace Roadmap & Plan — AI Collaboration Hub

> **Single source of truth** for every plan, to-do list, and improvement round in this workspace.
> Supersedes (removed 2026-09-14): `CLINE_CONTINUOUS_IMPROVEMENT.md`, `DELIVERY_SUMMARY.md`,
> `IMPROVEMENTS_SUMMARY.md`, `IMPROVEMENTS_SUMMARY_NEW.md`, `QUALITY_STATUS.md`,
> `ROUND_3_COMPLETION.md`, `ROUND_3_STATUS.md`.
> History: `docs/ARCHIVE-improvement-rounds-2026-08.md` · Live state: `docs/STATUS.md`

**Last revised:** 2026-09-19 · **Quality gate:** `npm run gate` · **Full catalyst series:** `npm run quality`

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
| 5 | Full E2E suite (Playwright), visual regression, load-testing framework, multi-OS spot-check | ✅ 2026-09-14 |
| 6 | Fleet sync tools (sync-parity, check-doc-links), AGENTS.md, documentation index, PR template, CHANGELOG | ✅ 2026-09-14 |
| 7 | Extension health check (34 checks), OPS Dashboard extension section | ✅ 2026-09-15 |
| 8 | Secret-scan tool (offline twin of CI), pre-commit integration | ✅ 2026-09-15 |
| 9 | Workflow audit tool (12 rules WF001–WF012), action SHA pinning ratchet (119 → 51 findings) | ✅ 2026-09-15 |
| 10 | Accepted-debt zeroing (WF008/WF009/WF006), timeout/concurrency/permissions on 22 workflows, ledger 51 → 1 | ✅ 2026-09-15 |
| 11 | Docs/DX expansion: 7 new guides + TOOLING_GUIDE + COMMUNITY, cross-repo-tests.mjs (5/5), ops-dashboard-refresh.yml (daily dashboard cron), extensions.json, parity reconcile | ✅ 2026-09-19 |

### Round 3 verification checklist (was left unchecked; verified 2026-09-14)

- [x] Coverage threshold (70%) enforced in CI — `nexus-infinity-hub/.github/workflows/quality-checks.yml` (lines 69–80)
- [x] Security scanning workflow runs — `.github/workflows/security-scanning.yml` (+ `vulnerability-gate.yml`, `secret-scan.yml`)
- [x] API docs generate & deploy — `.github/workflows/generate-docs.yml` (artifacts 90d; Pages deploy soft-fails if env unset)
- [x] VS Code workspace opens all 6 projects — `AI-Collaboration-Hub.code-workspace`
- [x] DevContainer configured — `.devcontainer/` (Node 26 + Python 3.12 + setup.sh)
- [x] Pre-commit hooks working — `.husky/pre-commit` (direct `prettier`/`eslint`, empty-staged-set guard)
- [x] Tests / gate pass — `npm run gate` (see `docs/STATUS.md` for the latest run record)

---

## 2. Open Work — Round 12+ (prioritized)

> Round 11 (2026-09-19) completed the previous open-work list — the full completion record is
> subsection K below. Everything in A–D is the fresh plan.

### A. External / Community 🌐 (carried forward)

These items require external services, accounts, or coordination with other repositories:

- [ ] **GitHub Pages enablement for API docs** — repo Settings → Pages → GitHub Actions. Workflow already deploys best-effort; enabling the `github-pages` environment will make deployment succeed instead of soft-failing.
- [ ] **Third-party security audit** — owned by `ai-chat-websites/next_year_roadmap.md`; coordinate with that repo's roadmap.
- [ ] **ai-chat-websites community items** — Discord, video tutorials, store publishing, 80/90% coverage gates — tracked in that repo's `next_year_roadmap.md`.
- [ ] **External uptime dashboards** — synthetic monitoring tool (`tools/e2e-smoke.mjs` with `--route` probes) is self-hosted and ready; the external-service piece (real uptime dashboards) remains 🌐.

### B. Quality & CI (Round 12)

Building on the now-complete CI foundation (Round 11 delivered cross-repo integration tests — see subsection K):

- [x] **Dependency update automation** — delivered 2026-09-19: the shared config (`.github/dependabot.yml`) audited against the real tracked-manifest map; gap closed (root npm tooling entry added so eslint/husky/lint-staged/prettier get update PRs), AGA-generated placeholder pip manifests (`AI-Collaboration-Hub/`, `nexus-core/`) consciously excluded to avoid fighting the generator; coverage table documented in `docs/DEPENDENCY_WORKFLOWS.md`
- [ ] **Coverage trend visualization** — turn the ledger data behind `docs/COVERAGE_PERFORMANCE_TRENDS.md` into per-project charts surfaced in the OPS Dashboard.
- [ ] **Machine telemetry aggregation** — summarize `agent-report.json` / `auto-ops-report.json` / `auto-fix-ledger.json` trends (auto-fix success rate, agent run frequency) in the OPS Dashboard.

### C. Observability & Runtime (Round 12)

- [ ] **Telemetry endpoint configuration** — the runtime error-telemetry hook (`src/lib/telemetry.ts`) is built and inert without an endpoint. Configure `window.TELEMETRY_ENDPOINT` or `installTelemetry({ endpoint })` for production error reporting (needs an owner decision on the receiving backend).
- [x] **Dashboard freshness guard** — delivered 2026-09-19: per-section `ts:` markers, idempotent regen (unchanged sections keep their timestamps), `--check` staleness mode; gate + verify-tools + cron workflow all consume it (see subsection L)
- [ ] **Flaky-test tracker** — record Playwright/vitest retry occurrences across CI runs and surface a flake-rate trend in the OPS Dashboard.

### D. Developer Experience (Round 12)

- [ ] **Project template generator** — turn `docs/WORKSPACE_TEMPLATES.md` into an actual scaffolding script (`tools/new-project.mjs`) that stamps a new Vite/React app with the standard configs (ESLint, Prettier, Playwright, telemetry hook).
- [ ] **Interactive CLI tools (re-scoped)** — the naive interactive-prompt approach was tried and rejected in Round 11 (see subsection K); re-scope as explicit subcommands/flags (e.g., `bundle-trend.cjs <app>`, `sync-parity.mjs sync --mode=overwrite`) instead of stdin prompts.
- [ ] **Node 26 local runtime alignment** — CI enforces `engines >= 26` while the local default runtime is v24 (informational gate warning only); either upgrade the local toolchain or document the accepted delta permanently.

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
- [x] **Supply-chain hardening (WF005 debt zeroed):** all **68** tag-pinned `uses:` across the 24 root workflows rewritten to full commit-SHA pins (`owner/repo@<40-hex> # <ref>` — the original ref kept as a trailing comment for human diffing and future upgrade bumps). The 8 unique refs were resolved via `git ls-remote` (annotated tags peeled to their commit); two of the eight turned out to be **mutable branch refs, not tags** — `actions/dependency-review-action@v5` (a branch named v5) and `dependency-check/Dependency-Check_Action@main` — exactly the class of silent supply-chain risk WF005 exists to flag. The ratchet contract was exercised live for the first time: ledger trimmed in the same change (**119 → 51 accepted findings**, WF005 68 → 0); actionlint 0 failures across all 24 files; gate PASS 22/22. Nested standalone-repo workflows are deliberately out of scope (durable rule 12 — mirror-owned; their repos run their own campaigns)

### J. Round 10 — new items (added AND completed 2026-09-15)

- [x] **Accepted-debt zeroing (WF008/WF009/WF006):** the 22 root workflows that lacked them gained job `timeout-minutes: 30` (20 jobs), top-level `concurrency: group: ${{ github.workflow }}-${{ github.ref }}` (21 files — `cancel-in-progress: true` only on the 6 PR-only flows, deliberately `false` on the 15 scheduled/agent crons so mid-run self-heal/fix work is never killed) and least-privilege top-level `permissions:` (10 files: 9 × `contents: read`, `lint-autofix` × `contents: write` because it commits fixes; `nexus-agent-cron` gained a read-only top-level guard as defense-in-depth atop its existing job-level scopes). `generate-docs` already had compliant permissions (untouched). actionlint 22/22 clean
- [x] Ledger pruned in the same change per the ratchet contract (**51 → 1 accepted findings**: medium 10 → 1, low 41 → 0; WF008/WF009/WF006 all zero). Sole survivor: the **WF004 review-flag on `ci-self-heal.yml:25`** — an inherently privileged, legitimate `workflow_run` self-healer that needs `contents: write` to push fixes; every step was reviewed this session (default checkout of the default branch, repo-owned scripts, dispatch-only inputs, zero event-payload shell interpolation), so it stays as documented, justified acceptance instead of weakening the rule
- [x] Validation evidence: gate PASS 22/22; `workflow-audit --check-baseline` green (1 accepted); `--self-test` 12/12 fixtures + ledger boundary + exit-code contract; pre-commit secret-scan clean on the staged index

### K. Round 11 — new items (added AND completed 2026-09-19)

- [x] **Cross-repo integration tests** — `tools/cross-repo-tests.mjs`: TC-001 SHA256 parity across the 4 fleet pairs (autonomous-github-agent catalysts, singularity_operator subtree, collabhub-modules mirror, modular-hub-modernization mirror), TC-002 per-file hash verification of the 8 standalone catalysts, TC-003 ROI Catalyst self-test entry, TC-004 FailureSolver validate entry, TC-005 catalyst-workflow hash + actionlint. Supersedes and deletes the broken `tools/cross-repo-int.test.mjs` duplicate (could not resolve standalone roots living outside the workspace). Evidence: 5/5 PASS, exit 0
- [x] **OPS Dashboard auto-refresh** — `.github/workflows/ops-dashboard-refresh.yml`: daily cron `0 4 * * *` + `workflow_dispatch` + path triggers (docs/tools/workflows/package manifests); runs the gate, regenerates the dashboard, commits only on change; SHA-pinned actions (checkout@v7, setup-node@v7), node 26 to match `engines`, timeout/concurrency/least-privilege compliant. Evidence: actionlint clean; `workflow-audit --check-baseline` green; audit ledger re-seeded 24 → 25 workflows (1 accepted finding unchanged)
- [x] **VS Code extension recommendations** — `.vscode/extensions.json` populated (ESLint, Prettier, TS Nightly, Vitest/Jest/pytest/Python, Playwright, GitHub Actions + PR, GitLens, spell-checker, Error Lens, Mermaid) and made shareable via a root-anchored `.gitignore` exception (`/.vscode/*` + `!/.vscode/extensions.json` — a dir-level `.vscode/` pattern cannot be negated; nested project `.vscode/` dirs keep their own per-project rules)
- [x] **Documentation expansion** — 7 new docs (`TESTING_GUIDE`, `TROUBLESHOOTING`, `WORKSPACE_TEMPLATES`, `COVERAGE_PERFORMANCE_TRENDS`, `CROSS_REPO_INTEGRATION_TESTS`, `API_DOCUMENTATION_COVERAGE`, `OPS_DASHBOARD_AUTOMATION`) + `tools/TOOLING_GUIDE.md` + `COMMUNITY.md`; README/AGENTS/CONTRIBUTING/CHANGELOG/SECURITY/DEVELOPER_GUIDE refreshed to match. Evidence: `check-doc-links` 165 files / 47 links / 0 broken
- [x] **Interactive CLI item consciously rejected** — the no-arg interactive path prototyped into `bundle-trend.cjs` fell through synchronously past its prompt (stdin callbacks don't block the script, and CI/smoke requires non-interactive tools); reverted to the canonical non-interactive CLI and re-scoped the roadmap item to explicit subcommands/flags (section D)
- [x] **Parity reconciliation** — the session's one real DIFF (`singularity_operator/advanced_userscript.py`, standalone ahead under overwrite mode) reconciled via the sanctioned `node tools/sync-parity.mjs sync`; `check` re-run green
- [x] **OPS Dashboard regenerated** — `node tools/ops-dashboard.mjs` → `docs/metrics/OPS-DASHBOARD.md` now reflects 25 workflows

**Validation evidence:** gate PASS 22/22 (2026-09-19); `cross-repo-tests.mjs` 5/5; actionlint clean on the new workflow; `workflow-audit --check-baseline` green (exit 0, 1 accepted); `check-doc-links.mjs` 165 files / 47 links / 0 broken; `sync-parity.mjs check` green after reconcile.

---

### L. Round 12 — items (started 2026-09-19)

- [x] **Performance regression alerts (B1)** — `bundle-trend.cjs` `check` now emits one GitHub `::error::` annotation per regressed bundle when running under Actions (`GITHUB_ACTIONS=true`; title = bundle name, body = base→now bytes, threshold) and posts an optional best-effort JSON webhook (`--webhook-url` flag or `BUNDLE_ALERT_WEBHOOK` env, https/http with 5 s timeout — **always non-fatal**: alert delivery never changes the gate outcome). Wired into `performance-monitoring.yml` via a **step-scoped** `BUNDLE_ALERT_WEBHOOK: ${{ secrets.BUNDLE_ALERT_WEBHOOK }}` on the gate step — unset/empty secret → annotations only; step scope is deliberate since workflow-level secret env trips WF012.
- [x] **Dashboard freshness guard (C2)** — `ops-dashboard.mjs` now stamps every section with a machine-parseable marker (`<!-- ops-section:<name> ts:<ISO8601> -->`), preserves unchanged sections' timestamps on regen (idempotent output — a run on a current dashboard writes nothing, which the cron workflow's existing nothing-to-commit guard already handles) and gained a `--check` staleness mode (per-section age vs 24 h max, exit 1 on stale, per-section ok/stale table). Consumed in three places: `workspace-gate.ps1` v3 gained a **warn-only** freshness step (gate count 22 → 23; staleness warns but never gates, matching the engines-warning convention), `verify-tools.mjs` runs `--check` as its read-only probe for the tool, and `ops-dashboard-refresh.yml` verifies markers post-regen before committing.

**Validation evidence (2026-09-19):** temp-ledger regression run exits 1 with the `::error::` annotation emitted under `GITHUB_ACTIONS=true`; webhook-unreachable path stays exit 1 (non-fatal); clean path exits 0; `node --check` 0; actionlint 0 on `performance-monitoring.yml`; `workflow-audit --check-baseline` green (1 accepted finding unchanged); gate PASS 22/22.

**C2 validation evidence (2026-09-19):** `node tools/ops-dashboard.mjs --check` → all 7 sections fresh, exit 0; idempotence proven (second regen run exits 0 writing nothing); `verify-tools.mjs` probe green (`ops-dashboard.mjs --check: ok`); actionlint 0 on `ops-dashboard-refresh.yml`; `sync-parity.mjs check` green (13/13 subtree, standalone reconciled); **gate PASS 23/23** with the new warn-only freshness step.

---

## 3. Continuous Improvement Loop (updated 2026-09-19)

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
- New items added to this roadmap MUST be verified via `npm run gate` before marking complete.
- All completed rounds MUST include verification evidence (test results, command output, or audit logs).

---

## 5. Round Completion Template

When completing a round, add a section like this:

### Round N — new items (added AND completed YYYY-MM-DD)

- [x] **Item description** — details of what was done, tools/files changed, verification evidence
- [x] **Item description** — more items as needed

**Validation evidence:** gate PASS X/X; specific test results or audit output; any relevant metrics.

---

*Last gate run: 2026-09-19 — PASS (22/22, 1 informational warning: Node v24.14.0 < engines ≥26)*
