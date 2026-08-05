# Autonomous GitHub Agent — Status

**Version: v6.0 Unified** (as of 2026-08-05)

## Live capabilities

| Capability | Status |
|------------|--------|
| Multi-task solve + lockfiles | ✅ |
| Problem solvers (syntax, peers, requirements, GHA) | ✅ |
| CI Self-Heal (schedule + workflow_run) | ✅ |
| Security audit (pip-audit / npm) | ✅ |
| Multi-role consensus (Planner→…→Echo) | ✅ |
| Consensus gate in agent.py (`gate_with_consensus`) | ✅ |
| Closed-loop ledger + human escalation | ✅ |
| Multi-repo metadata scan | ✅ |
| Nexus state export | ✅ |
| Duplicate draft PR cleanup | ✅ |
| Dependabot (npm / pip / actions) | ✅ |
| Ruff + pre-commit | ✅ |
| Dependency review on PRs | ✅ |
| Groq SDK ≥1.6 pin (KNOWN_PY_PINS + singularity-operator) | ✅ |
| Version lineage consolidated (v4.x–v5.3 → v6.0) | ✅ |

## Env flags

`DRY_RUN` · `MAX_SOLVER_TASKS` · `MULTI_REPO` · `NEXUS_CONSENSUS` · `AGENT_OWNS_GITHUB`

## Free tools in use

- [Dependabot](https://docs.github.com/en/code-security/dependabot)
- [Ruff](https://docs.astral.sh/ruff/)
- [pre-commit](https://pre-commit.com)
- [dependency-review-action](https://github.com/actions/dependency-review-action)
- pip-audit
- [Groq](https://console.groq.com/) (via singularity-operator)

## Docs

- `docs/v6.0-unified.md` — single source of truth (prior v5.x docs retained for history)
