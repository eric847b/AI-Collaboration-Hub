# Changelog

All notable workspace-level changes are documented here.

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
