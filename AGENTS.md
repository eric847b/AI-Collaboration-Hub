# AGENTS.md — AI Agent Onboarding (AI Collaboration Hub)

> Read this first. Canonical plan: `docs/ROADMAP.md` · Live state: `docs/STATUS.md` · History: `docs/ARCHIVE-improvement-rounds-2026-08.md`

## Workspace

Multi-project monorepo (`github.com/eric847b/AI-Collaboration-Hub`). Projects **auto-enroll**: any root folder with `package.json` (Node) or `requirements.txt` (Python) is picked up by the bootstrap/gate/quality tools — no hardcoded project lists.

- **nexus-infinity-hub**, **self-evolve-dash** — Vite/React apps; strict TS, coverage ≥70% CI gate, Playwright E2E, load-tested builds (Node ≥26)
- **collabhub-modules** — userscript modules + free-AI CLI (`npm run ai`)
- **ai-chat-websites** — userscript suite with its own roadmap (`next_year_roadmap.md`)
- **singularity-operator**, **autonomous-github-agent** — Python; **standalone repos are the source of truth, nested dirs are mirrors** (see Fleet mirrors below)
- **VectorFS**, **third-door-system** — systems/tooling

## Commands

| Command | Purpose |
|---------|---------|
| `npm run gate` | THE quality gate (workspace-gate v3): configs, workflows + live actionlint, lockfiles, engines, Python reqs, hook integrity. `verify`/`health`/`ci` are aliases |
| `npm run quality` | Full 11-step catalyst series (`tools/run-quality.ps1`) |
| `npm run bootstrap` | Install all Node + Python deps |
| `node tools/bundle-trend.cjs collect\|check\|report` | Bundle-size ledger + regression gate (`docs/metrics/bundle-history.json`) |
| `node tools/sync-parity.mjs check\|sync` | Fleet mirror parity (map: `tools/parity-map.json`) |
| `node tools/check-doc-links.mjs` | Markdown relative-link health (all `*.md`) |
| `node tools/ops-dashboard.mjs` | OPS Dashboard → `docs/metrics/OPS-DASHBOARD.md` (workflows, tooling, bundle ledger, parity, link health, machine telemetry) |
| `node tools/verify-tools.mjs [--strict]` | One-command health check for all `tools/*.mjs\|*.cjs` — syntax + read-only smoke runs (`npm run tools:verify`) |
| `node tools/extension-check.mjs [--quiet]` | Read-only health check for the ai-chat-websites Unified AI Assistant Suite extension (manifest MV3, ladder plumbing + UI, provider parity, no secrets) — also in `multi-os-gate.yml` |
| `node tools/secret-scan.mjs [--staged\|--self-test\|--check-ci\|--list-rules]` | Offline, read-only twin of `.github/workflows/secret-scan.yml` — 20 detectors with redacted evidence, plus `--check-ci` proving every CI pattern is exercised locally and that the scanner's own source cannot trip the CI grep. `--staged` scans the git index (wired into `.husky/pre-commit`); `npm run scan:secrets` |
| `node tools/handoff-check.mjs [--file <path>\|--strict]` | Validates `.renitor/handoff-result.json` against the documented schema + freshness (durable rule 10); tolerates UTF-8 BOMs from PowerShell writers and degrades to `skipped (machine-local)` when the file is absent; `npm run check:handoff` |
| `node tools/e2e-smoke.mjs --project <app>` | Serve a built Vite app and assert HTTP 200 |
| `node tools/load-test.mjs --project <app>` | Load test with error-rate + p95 gates |

## Durable rules

1. Workflows MUST pass `actionlint` (`C:\Users\Eric\Documents\Cline\Tools\actionlint.exe`) before commit. Avoid bare `:` in step names (YAML).
2. Sync ONLY via `C:\Users\Eric\Documents\Cline\Hooks\resilient-git.ps1 sync -Repo <root>`; never bare push/pull. Gate → commit → sync are SEPARATE tool calls (30 s per-call caps).
3. Never stage or revert other agent sessions' unstaged work — inspect `git status` first; only stage your own paths.
4. No secrets in the repo. Provider keys live in `~/.cline/data/settings/…` or encrypted Actions secrets. `openai-api-key.txt` is local-only + gitignored.
5. `tools/*.ps1` derive all paths from `$PSScriptRoot` — absolute user profiles are forbidden (purged in d7a2137).
6. `.husky/pre-commit`: NEVER reintroduce `npx` (it stalls); the hook calls `node_modules/.bin/*` directly with an empty-staged-set guard.
7. `.vexp/**` is daemon-owned — observe only, never edit.
8. `engines` wants Node ≥26; local runtime may be v24 → informational gate warning, not an error to "fix".
9. Windows PowerShell 5.1 traps: never capture native stderr with `2>&1` into strings (creates fake NativeCommandError and can abort pipelines); for background jobs use `Start-Process -FilePath <exe> -ArgumentList <array> -RedirectStandardOutput <log> -RedirectStandardError <errlog>` — no backtick-nested quoting.
10. Plans/TODOs live ONLY in `docs/ROADMAP.md`; state snapshots in `docs/STATUS.md`. Update both when state changes; update `.renitor/current-handoff.md` on significant changes and write `.renitor/handoff-result.json` when stopping.
11. Editing `.ps1`/`.md` with non-ASCII via PowerShell: use `[IO.File]::ReadAllText/WriteAllText` with explicit UTF8 (mojibake risk); prefer single-line anchored edits (CRLF files).
12. Fleet mirrors: standalone repos own runtime catalysts; after a standalone repo advances run `node tools/sync-parity.mjs check`, then `sync`. Never overwrite actively-developed nested files (use `missing-only` mode in the map).