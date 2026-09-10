# Fleet Catalyst Sync Policy

Governs how code moves between the two copies of the autonomous agent:

| Copy | Role |
|---|---|
| Monorepo nested: `GitHub/autonomous-github-agent/` | Dev / audit sandbox (free models, experiments, regression suites) |
| Standalone: `C:/Users/Eric/Documents/Cline/Repos/autonomous-github-agent` → `eric847b/autonomous-github-agent` (private) | Production worker (dispatched via `gh workflow run`, OPS-MANUAL §4) |

## Rules

1. **Parallel evolution is expected.** The two copies are NOT mirrors. The
   standalone has its own fleet-ops modules (`agent_profile_persist.py`,
   `persist_bridge.py`, duplicate-guard, fleet-pulse, promotion tests) and its
   own `.github/tests/` suite. Never blanket-overwrite the standalone.

2. **Propagation is fix-shaped and one-way at a time.** Only audited,
   tested fixes move: dev → prod (default), or prod → dev when the standalone
   gains capability first. Before any sync, run the divergence scan
   (`git diff --no-index` per candidate file) and classify each direction.

3. **Runaway caps are mandatory in both copies.** Every workflow with
   `schedule:` or `workflow_dispatch:` carries `concurrency:` (+
   `cancel-in-progress`) and `timeout-minutes:`. Entry points referenced by
   workflows must actually exist (`python -m py_compile` + smoke test before
   commit) — see the codex_loop/controller.py incident of 2026-09.

4. **Catalyst state is authoritative where it is written.** Fleet catalyst
   artifacts (`.agent_profile.json`, `fleet_pulse`, cooldown/persist bridges)
   belong to the copy that produced them; the other side reads via pull and
   reconciles, never force-writes. Nested-copy state files that are pure
   dev artifacts stay gitignored in the monorepo.

5. **Verify before and after.** Both sides must pass: `ruff check .github`,
   `python -m compileall`, `pytest` (own suite), and `actionlint` on all
   workflows. Sync commits are separate, tagged `sync:` in the subject, and
   go through `resilient-git.ps1 sync` — never bare push.
