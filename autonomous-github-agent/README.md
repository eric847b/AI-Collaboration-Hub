# Autonomous GitHub Agent

**v5.2 Nexus** — self-healing multi-LLM agent for GitHub + monorepo repair.

> Living core of the AI-Collaboration-Hub / Singularity Operator ecosystem.

## Status

See **[STATUS.md](./STATUS.md)** for the full capability matrix (v5.2).

## What it does

1. Scans issues, PRs, TODOs, lockfile gaps, CI gaps
2. Prioritizes highest-ROI work
3. Auto-repairs via problem solvers (syntax, peers, requirements, GHA)
4. Opens **draft** PRs; cleans duplicate drafts
5. **CI Self-Heal** runs on a schedule and after failed workflows
6. Optional **Nexus multi-role consensus** before risky issue/PR edits
7. Closed-loop ledger + escalate to `needs-human` when fixes reappear

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

## Architecture (v5.2)

```
Triggers → GitHub Actions
  → problem_solvers_runner (deterministic repairs)
  → agent.py (LLM + tools + optional consensus gate)
  → draft PRs + ledger + export
  → Self-Heal schedule / workflow_run
```

Modules: `nexus_consensus.py`, `agent_hooks.py`, `closed_loop.py`, `escalate.py`, `multi_repo.py`, `collab_export.py`, `security_audit.py`

## Security

Draft PRs only · input sanitization · high-risk command block · path checks · depth limit · least-privilege workflow permissions.

## License / ecosystem

Part of Eric’s AI collaboration monorepo. Iterate via agent PRs or manual dispatch.
