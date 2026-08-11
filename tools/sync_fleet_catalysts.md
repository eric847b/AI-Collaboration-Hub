# Fleet Catalyst Sync Contract

**Issue:** AI-Collaboration-Hub#225  
**Date:** 2026-08-11  
**Direction:** Standalone repos = source of truth for runtime catalysts. Nested monorepo paths receive high-fidelity copies of critical modules.

## Critical modules now parity (nested autonomous-github-agent)

| Module | Standalone path | Nested path | Status |
|--------|-----------------|-------------|--------|
| ROI Catalyst v4.1.2 | `.github/roi_catalyst.py` | `autonomous-github-agent/.github/roi_catalyst.py` | ✅ |
| FailureSolver v3.5 | `.github/failure_solver.py` | `autonomous-github-agent/.github/failure_solver.py` | ✅ |
| Cross-repo coordinator | `.github/cross_repo_coordinator.py` | same under nested | ✅ |
| Draft-ext | `.github/failure_solver_draft_ext.py` | same | ✅ |
| Profile IO | `.github/profile_io.py` | same | ✅ |
| Completed dataset | `docs/completed_catalyst_dataset.md` | nested docs + root SYNC | ✅ |

## Source-of-truth rule
1. `eric847b/autonomous-github-agent` owns live Actions, profile, ROI runs, FailureSolver cycles.
2. Nested tree under `AI-Collaboration-Hub/autonomous-github-agent/` is a **catalyst mirror** for monorepo bootstrap, docs, and offline inspection — not a second runtime.
3. When standalone advances a catalyst module, re-copy the file(s) into the nested path and update this table + issue #225.

## Remaining (lower priority)
- Full `agent.py` / security.py / stale_branches.py parity (large; nested already has substantial scripts tree).
- singularity-operator nested vs standalone (package layout differs; core Python files partially aligned).
- collabhub-modules / modular-hub-modernization / zero-cost-wealth-playbook-tool mirrors.

## Verification
```bash
# After any sync commit, confirm SHA/content of critical files match intent.
# Prefer github___get_file_contents on both repos for the same relative path under .github/
```

## Next high-ROI after this closed loop
Open a work issue on zero-cost-wealth-playbook-tool (currency) or singularity-operator (project unlock) with labels `catalyst` + `revenue`/`blocker`, then re-run the fleet ROI Catalyst.
