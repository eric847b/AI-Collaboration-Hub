# Fleet Component Sync Catalyst

**Status:** Active — highest-ROI alignment between monorepo and standalone fleet repos.

## Scope
Sync nested components inside `eric847b/AI-Collaboration-Hub` with external standalone repositories:

| Nested path | Standalone repo | Priority |
|-------------|-----------------|----------|
| `autonomous-github-agent/` | `eric847b/autonomous-github-agent` | Critical (ROI Catalyst source of truth) |
| `singularity-operator/` | `eric847b/singularity-operator` | High |
| `collabhub-modules/` | `eric847b/collabhub-modules` | Medium |
| `modular-hub-modernization/` | `eric847b/modular-hub-modernization` | Medium |
| (reference) | `eric847b/zero-cost-wealth-playbook-tool` | Currency path |

## Completed this cycle (2026-08-11)
- Created tracking issue #225
- Propagated `roi_catalyst.py` v4.1.2 into nested autonomous-github-agent
- Propagated `completed_catalyst_dataset.md` (abbreviated + sync contract)
- Documented sync contract

## Ongoing (updated 2026-09-14 — parity sweep executed)

- ✅ DONE: full `agent.py` / `security.py` / `stale_branches.py` / `roi_catalyst.py` / `failure_solver*` /
  `profile_io` / `cross_repo_coordinator` / `fleet_maintenance` propagation — 11/11 modules SHA256-verified
  (several had drifted despite earlier ✅ claims — always re-hash, never trust the table)
- ✅ DONE: `singularity_operator/` package subtree deep parity — 13/13 files, zero diffs
- ✅ DONE: modular-hub-modernization mirror backfill (9 files); collabhub-modules partial (VERSION + release.yml)
- ◑ 3 documented divergences need manual review (see `tools/sync_fleet_catalysts.md`)
- Optional subtree or Actions-based bidirectional sync
- Keep FLEET list consistent across all catalyst modules

## Verification
After any sync commit: `github___get_file_contents` on both nested and standalone paths and confirm SHA or content parity for critical files.
