---
name: github-ops
description: >
  Autonomous GitHub hygiene for AI-Collaboration-Hub — Dependabot patch
  merges, conflict rebase/recreate, lockfile PR spam guards, failure-only
  self-heal. Use when working on PRs, Actions failures, or agent scripts
  under autonomous-github-agent/.
license: MIT
metadata:
  author: eric847b
  tags: github, dependabot, actions, auto_ops, free-resources
---

# github-ops

## Prefer free automation over AI loops

1. **Patches** — Dependabot groups (`dependabot.yml`) + `auto_ops` auto-merge when checks green.
2. **Conflicts** — Comment `@dependabot rebase` (age < 14d) or `@dependabot recreate` (older). Marker comments prevent spam.
3. **Lockfile drafts** — Never open root/`Userscripts` lockfile PRs; close duplicate lockfile drafts.
4. **Self-Heal** — `ci-self-heal.yml` runs only on **failure** (`workflow_run` conclusion) + schedule; `cancel-in-progress`.
5. **Majors** — Do not auto-merge (eslint major, groq, actions major). Human or one-shot AI judgment.

## Key paths

| Path | Purpose |
|------|---------|
| `autonomous-github-agent/.github/scripts/auto_ops.py` | Spam, merges, conflict requests |
| `autonomous-github-agent/.github/scripts/problem_solvers_runner.py` | Solver cycle |
| `autonomous-github-agent/.github/scripts/skills.py` | Local free skill registry |
| `.github/workflows/ci-self-heal.yml` | Orchestration |
| `autonomous-github-agent/.github/skills/CATALOG.md` | External skill map |

## Upstream patterns (read, don't vendor)

- [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)
- Callstack `github` skill — PR/branch patterns
- OpenAI `gh-fix-ci` — Actions log repair patterns

## Safety

- No force-push to `main`.
- No secrets in logs.
- Pages deploy may 404 if Pages disabled — treat as optional (`continue-on-error`).
