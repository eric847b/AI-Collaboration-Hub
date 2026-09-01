# Autonomous GitHub Agent

**v6.2 free-path** — self-healing GitHub + monorepo repair with free resources first.

> Living core of the AI-Collaboration-Hub / Singularity Operator ecosystem.

## Status

See **[STATUS.md](./STATUS.md)** for the capability matrix and free-path policy.

## What it does

1. Scans issues, PRs, TODOs, lockfile gaps, CI gaps
2. Prioritizes highest-ROI work
3. Auto-repairs via problem solvers (syntax, peers, requirements, GHA)
4. Opens **draft** PRs; cleans duplicate drafts
5. **CI Self-Heal** — schedule (every 3h), failure-only `workflow_run`, manual dispatch
6. **auto_ops v1.2** — Dependabot patch + `*-patches group` merge when green; conflict → `@dependabot rebase|recreate`
7. **Nexus multi-role consensus** gated before risky issue/PR/todo edits
8. Closed-loop ledger + escalate to `needs-human` when fixes reappear
9. Optional multi-repo metadata scan (`MULTI_REPO=1`)
10. **Fleet Maintenance** — cross-repo audit of required root files; plan-only by default

## Free path vs AI

| Work | Who |
|------|-----|
| Patch deps, spam PRs, stale branches, lockfile policy | Dependabot + `auto_ops` (no AI) |
| CI failure → known solver | Self-Heal + problem_solvers |
| New failure class / major bump / architecture | AI writes playbook once → free path thereafter |

Skill map (do not vendor wholesale): `.github/skills/CATALOG.md` · upstream [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)

## Quick start

### Secrets
Settings → Secrets → Actions: `GITHUB_TOKEN` is enough for auto_ops. Optional LLM keys only if you run agent.py solvers that need them.

### Trigger
- Actions → **CI Self-Heal** → Run workflow (`auto_merge_dependabot=1`)
- Or wait for the 3-hour schedule / a failed watched workflow

### Local quality gates (free)
```bash
pip install pre-commit ruff
pre-commit install
ruff check autonomous-github-agent --fix
```

## Architecture (v6.2)

```
Triggers → GitHub Actions
  → auto_ops (Dependabot hygiene, free)
  → problem_solvers_runner (deterministic repairs)
  → agent.py (LLM + tools + consensus — only when needed)
  → draft PRs + ledger + export
  → Self-Heal schedule / failure-only workflow_run
```

Modules: `scripts/auto_ops.py`, `problem_solvers_runner.py`, `nexus_consensus.py`, `closed_loop.py`, `escalate.py`, `multi_repo.py`, `security_audit.py`, `fleet_maintenance.py`, `skills/`

## Security

Draft PRs only · no force-push to main · path checks · consensus veto · least-privilege workflow permissions · Pages deploy optional (`continue-on-error`).

## License / ecosystem

Part of Eric’s AI collaboration monorepo. Iterate via agent PRs or manual dispatch.
