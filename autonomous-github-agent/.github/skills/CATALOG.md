# Agent skill catalog (curated)

**Upstream index (do not clone wholesale):**
[VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)

**Policy:** free GitHub resources do routine work. AI only writes playbooks
once so Actions / Dependabot / `auto_ops` can run without repeated AI calls.

## Local free skills (already executable)

| Local module | Role |
|--------------|------|
| `scripts/auto_ops.py` (v1.2) | Spam cleanup; Dependabot patch + `*-patches group` merge; conflict → `@dependabot rebase/recreate`; stale branches |
| `scripts/problem_solvers_runner.py` | ROI-ranked solvers, lockfile guards, skip Userscripts/root |
| `scripts/skills.py` | File/grep/test/triage/release helpers (no paid APIs) |
| `scripts/security_audit.py` | Lightweight security pass |
| `scripts/escalate.py` | Recurring failure escalation |
| `.github/workflows/ci-self-heal.yml` | Failure-only heal + cancel-in-progress |

## External skills worth emulating (pointers only)

| Family | Skill | Why it maps here |
|--------|-------|------------------|
| GitHub | [callstackincubator/github](https://github.com/callstackincubator/agent-skills) | PR/branch patterns; we encode merge/rebase policy in `auto_ops` |
| CI fix | [openai/gh-fix-ci](https://github.com/openai/skills) | Log → fix loop; parallel to Self-Heal + failure_solver |
| PR comments | [openai/gh-address-comments](https://github.com/openai/skills) | Review-comment → patch |
| Security | trailofbits/static-analysis, differential-review | Review gates; keep offline/free where possible |
| Expo | expo/expo-cicd-workflows | `third-door-blink-controller` |
| Testing | testmu-ai/cicd-pipeline-skill, playwright-skill | CI templates |
| Artifacts | anthropics/docx, pptx, pdf, xlsx | Only if a product needs docs export — not agent core |

## Explicit non-goals

- Do **not** install 1000+ skills into the monorepo.
- Do **not** call paid MCP/Composio for routine hygiene.
- Majors (eslint major, groq, actions majors) stay human/AI judgment; patches + named patch-groups stay free-bot.

## When to extend

1. A failure class repeats → encode fix in `auto_ops` or a workflow (not a new AI session).
2. Need IDE agent help → add a thin `SKILL.md` under `.github/skills/` (agentskills.io).
3. New product domain → add one row to this table + one local function in `skills.py`.
