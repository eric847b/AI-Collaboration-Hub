# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Fleet Maintenance v1.0 — cross-repo audit of required root files
  (`README`, `LICENSE`, `SECURITY.md`, `.gitignore`); plan-only by default,
  fail-closed `apply_safe`. Mirrored from `autonomous-github-agent` PR #322.
  - `autonomous-github-agent/.github/fleet_maintenance.py` + workflow.
  - Declared `requests>=2.34.2` runtime dependency for the mirrored engine.

### Changed
- **Catalyst-series engine** (`tools/run-quality.ps1`):
  - Exposed the full series as **`npm run quality`** via root `package.json`.
  - Guarded Steps 2/7/9 to run only where a project actually declares the
    script (`Has-Script`), removing false warnings for `collabhub-modules`
    (no `lint`/`lint:fix`) and `third-door-blink-controller`
    (no `check`/`build`).
  - Step 6 (`npm audit`) now sweeps **all four Node projects** workspace-wide
    instead of only the root package, surfacing subproject high-severity vulns.
  - Replaced invalid `pip -quiet` with `pip -q` (Step 3).
- **Secret-scan CI gate** (`.github/workflows/secret-scan.yml`): expanded
  trigger paths to `*.py`, `*.sh`, `*.ps1`, `*.txt`, `*.toml`, `*.ini`,
  `*.cfg` so the credential detector also covers Python/shell/scripts/config.

## [26.0.0] - 2026-08-18

### Added
- FreeAI permanent-free rotator — initial production release.
  - `FreeAIRotator.module.user.js`: Tampermonkey userscript that rotates
    free AI providers, performs page‑context‑aware auto‑prompting, and renders
    results in a dockable inline card.
  - `src/rotator.js`: core provider rotation + failover logic.
  - `src/rotator.mjs`: ESM façade exposing named imports
    `FreeAirRotator`, `defaultProviders`, and `delay`.
  - `run-ai.js`: CLI entry point (`npm run ai`) delegating to the rotator.
  - `examples/local-proof.js`: offline 429→500→200 failover demo.
  - `test/rotator.test.js`: 8 offline unit checks.
  - `test/userscript-dom.test.js`: 10 DOM injection + failover checks.
  - `.github/workflows/collabhub-modules-test.yml`: 18‑check CI gate.
  - `nexus-infinity-hub/package.json`: workspace `npm run ai` script.
  - `ai-chat-websites/.../17-Collaboration/18-FreeAI.module.user.js`:
    cross‑repo module + README wiring the userscript to the workspace CLI.
- MIT `LICENSE` file for the repository.

### Changed
- README files updated across `collabhub-modules`, `AI-Collaboration-Hub`,
  and `nexus-infinity-hub` with FreeAI CLI documentation and local‑LLM
  setup guidance.

