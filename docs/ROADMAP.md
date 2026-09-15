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

- [ ] Full E2E suite: Playwright/Cypress + visual regression for `nexus-infinity-hub` & `self-evolve-dash` (smoke baseline shipped 2026-09-14: `tools/e2e-smoke.mjs` + `e2e-smoke.yml`)
- [ ] Load-testing framework (k6/autocannon) against preview builds
- [ ] Multi-OS spot-check (ubuntu/windows matrix) for the gate-critical workflows

### B. Observability

- [x] Bundle/perf trend ledger + CI regression gate → `tools/bundle-trend.cjs` + `performance-monitoring.yml` (2026-09-14)
- [ ] Error-tracking dashboard (product feature; needs runtime telemetry hook)
- [ ] Synthetic/uptime monitoring 🌐 (external service)

### C. Fleet sync (from `docs/SYNC_CATALYST.md` + `tools/sync_fleet_catalysts.md`)

- [ ] Byte-for-byte parity: `agent.py`, `security.py`, `stale_branches.py` (standalone `autonomous-github-agent` → nested mirror)
- [ ] Deep parity: `singularity_operator/` package subtree
- [ ] Mirrors: `collabhub-modules` / `modular-hub-modernization` / `zero-cost-wealth-playbook-tool`

### D. External / community 🌐

- [ ] Third-party security audit (owned by `ai-chat-websites/next_year_roadmap.md`)
- [ ] GitHub Pages enablement for API docs (repo Settings → Pages → GitHub Actions) — workflow already deploys best-effort
- [ ] ai-chat-websites community items (Discord, video tutorials, store publishing, 80/90% coverage gates) — tracked in that repo's roadmap

### E. Housekeeping

- [x] Consolidate 7 stale planning docs → this file + `STATUS.md` + `ARCHIVE-improvement-rounds-2026-08.md` (2026-09-14)
- [x] Fix corrupted `.vscode/tasks.json` (broken JSON line); add real tasks + `.vscode/launch.json` (2026-09-14)
- [ ] Root junk review: `tmp-alerts.json`, `tmp-reg-meta.json`, `_sg.py`, `fix-security-alerts.cjs`, `FreedomReport.txt`, `LocalRepoReview.txt` — other sessions' generated artifacts; delete when confirmed orphaned ⏸

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
