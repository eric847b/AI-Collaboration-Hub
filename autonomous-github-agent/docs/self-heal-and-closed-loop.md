# CI Self-Heal & Closed-Loop (v4.7)

## What was implemented

1. **`.github/workflows/ci-self-heal.yml`**
   - Scheduled every 3 hours
   - Manual `workflow_dispatch` with `dry_run` + `max_tasks` inputs
   - Triggers on completion of key workflows (Autonomous Agent, python-checks, lockfile-validation, sanity, lint-autofix)
   - Runs expanded problem solvers + security audit
   - Cleans stale `auto-fix-*` branches
   - Uploads `agent-report.json` / `security-audit-report.json` as artifacts

2. **`security_audit.py`**
   - Best-effort `pip-audit` + `npm audit`
   - Report-only (no aggressive lockfile rewrites)
   - Produces `security-audit-report.json`

## Closed-loop feedback (next iteration)

After auto-fix PRs are merged:

1. Record merge SHA + original problem type in a small JSON ledger (`auto-fix-ledger.json`).
2. On the next self-heal run, re-scan the same class of problem; if the issue is gone, mark the ledger entry `verified`.
3. If the same problem reappears within N days, escalate (open a non-draft issue tagged `needs-human`).

## Multi-repo awareness (next iteration)

- Use the authenticated user/org API to list sibling repos owned by the same account.
- For each public sibling with a compatible agent layout, optionally clone shallow and run the same scanners in isolated jobs (gated by a `MULTI_REPO=1` flag to control cost).

## How to run manually

```bash
# Report only
DRY_RUN=1 MAX_SOLVER_TASKS=10 python autonomous-github-agent/.github/scripts/problem_solvers_runner.py

# Security report
python autonomous-github-agent/.github/scripts/security_audit.py
```

Or trigger the **CI Self-Heal** workflow from the Actions tab.
