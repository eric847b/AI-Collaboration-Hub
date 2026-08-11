# Fleet Catalyst Sync Contract

**Primary closed loop:** AI-Collaboration-Hub#225 (2026-08-11)  
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

## Singularity-operator nested parity (project unlock after #225)

| Module | Nested path | Status |
|--------|-------------|--------|
| Launcher singularity_operator.py (v0.5.10 AGA feedback) | `singularity-operator/singularity_operator.py` | ✅ |
| groq_singularity.py (resilient SDK fallback) | `singularity-operator/groq_singularity.py` | ✅ |
| pyproject.toml / requirements.txt | same | ✅ |
| README (v0.5.11 continuous ROI ranking) | same | ✅ |

Package subtree `singularity_operator/` may still lag standalone package internals; core entrypoints are aligned.

## Source-of-truth rule
1. `eric847b/autonomous-github-agent` owns live Actions, profile, ROI runs, FailureSolver cycles.
2. `eric847b/singularity-operator` owns package evolution, Groq paths, EverythingDB.
3. Nested tree under `AI-Collaboration-Hub/` is a **catalyst / bootstrap mirror** — not a second runtime.
4. When standalone advances a catalyst module, re-copy into nested path and update this table.

## Remaining (lower priority)
- Full `agent.py` / security.py / stale_branches.py byte-for-byte parity.
- Full `singularity_operator/` package subtree deep parity.
- collabhub-modules / modular-hub-modernization / zero-cost-wealth-playbook-tool mirrors.

## Verification
```bash
# After any sync commit, confirm content via github___get_file_contents on both repos.
```

## Next high-ROI
Prefer a real work issue on `zero-cost-wealth-playbook-tool` (currency) or deep singularity package parity with labels `catalyst` + `revenue`/`blocker`, then re-run fleet ROI Catalyst.
