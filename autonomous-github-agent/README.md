# Autonomous GitHub Agent

**v6.0 Unified** — self-healing multi-LLM agent for GitHub + monorepo repair.

> Living core of the AI-Collaboration-Hub / Singularity Operator ecosystem.

## Status

See **[STATUS.md](./STATUS.md)** for the full capability matrix (v6.0).

## What it does

1. Scans issues, PRs, TODOs, lockfile gaps, CI gaps
2. Prioritizes highest-ROI work
3. Auto-repairs via problem solvers (syntax, peers, requirements, GHA)
4. Opens **draft** PRs; cleans duplicate drafts
5. **CI Self-Heal** runs on a schedule and after failed workflows
6. **Nexus multi-role consensus** gated in `agent.py` before risky issue/PR/todo edits
7. Closed-loop ledger + escalate to `needs-human` when fixes reappear
8. Optional multi-repo metadata scan (`MULTI_REPO=1`)
9. **Fleet Maintenance v1.0** — cross-repo audit of required root files (README, LICENSE, SECURITY.md, .gitignore); plan-only by default, fail-closed `apply_safe`

## Quick start

### Secrets
Settings → Secrets → Actions: at least one of `DEEPSEEK_API_KEY`, `HF_TOKEN`, `OPENAI_API_KEY`, etc.

### Trigger
- Actions → **CI Self-Heal** or **Autonomous Agent** → Run workflow
- Or push / open issues / PRs (depending on workflow triggers)

### Local quality gates (free)
```bash
pip install pre-commit ruff
pre-commit install
ruff check autonomous-github-agent --fix
```

## Architecture (v6.0)

```
Triggers → GitHub Actions
  → problem_solvers_runner (deterministic repairs)
  → agent.py (LLM + tools + consensus gate)
  → draft PRs + ledger + export
  → Self-Heal schedule / workflow_run
```

Modules: `nexus_consensus.py`, `agent_hooks.py`, `agent_nexus_bridge.py`, `closed_loop.py`, `escalate.py`, `multi_repo.py`, `collab_export.py`, `security_audit.py`, `fleet_maintenance.py`

## Security

Draft PRs only · input sanitization · high-risk command block · path checks · depth limit · consensus veto · least-privilege workflow permissions.

## License / ecosystem

Part of Eric’s AI collaboration monorepo. Iterate via agent PRs or manual dispatch.
