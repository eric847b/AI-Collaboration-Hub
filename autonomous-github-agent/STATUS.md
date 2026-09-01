# Autonomous GitHub Agent — Status

**Version: v6.2 free-path** (as of 2026-09-01)

## Live capabilities

| Capability | Status |
|------------|--------|
| Multi-task solve + lockfiles | ✅ |
| Problem solvers (syntax, peers, requirements, GHA) | ✅ |
| CI Self-Heal (schedule every 3h + failure-only workflow_run + dispatch) | ✅ |
| **auto_ops v1.2** — spam cleanup, patch + `*-patches group` merge, conflict rebase/recreate | ✅ |
| Security audit (pip-audit / npm) | ✅ |
| Multi-role consensus (Planner→…→Echo) | ✅ |
| Closed-loop ledger + human escalation | ✅ |
| Multi-repo metadata scan | ✅ |
| Nexus state export | ✅ |
| Duplicate draft PR cleanup | ✅ |
| Dependabot groups (npm / pip / actions patch batches) | ✅ |
| Skill catalog (VoltAgent map, thin only) + `github-ops/SKILL.md` | ✅ |
| Ruff + pre-commit | ✅ |
| Dependency review on PRs | ✅ |
| Fleet Maintenance (cross-repo root-file audit) | ✅ |

## Free-path policy (encode once, run forever)

1. **Patches + named `*-patches` groups** → Dependabot opens; `auto_ops` squash-merges when checks green.
2. **Conflicts on those PRs** → `@dependabot rebase` (<14d) or `recreate` (≥14d); markers stop comment spam.
3. **Minors / majors** (eslint major, groq, setup-node major, lint-staged 15→17, etc.) → human or one-shot AI; never auto_ops.
4. **AI role** → write durable playbooks (`auto_ops`, workflows, SKILL.md). Do not burn AI calls on routine hygiene.
5. **No force-merge to main.** No paid MCP for routine ops.

## Env flags

`DRY_RUN` · `MAX_SOLVER_TASKS` · `MULTI_REPO` · `NEXUS_CONSENSUS` · `AGENT_OWNS_GITHUB` · `AUTO_MERGE_DEPENDABOT` · `MAX_DEP_MERGES` · `CONFLICT_RECREATE_DAYS`

## Free tools in use

- [Dependabot](https://docs.github.com/en/code-security/dependabot) (grouped patches)
- GitHub Actions (Self-Heal, lockfile-validation, workflow-lint)
- [Ruff](https://docs.astral.sh/ruff/) · [pre-commit](https://pre-commit.com)
- [dependency-review-action](https://github.com/actions/dependency-review-action)
- pip-audit
- PyGithub (auto_ops API)

## Docs

- `.github/skills/CATALOG.md` — external skill pointers (VoltAgent subset)
- `.github/skills/github-ops/SKILL.md` — agentskills.io playbook for IDE agents
- `docs/v6.0-unified.md` — historical unified architecture note
