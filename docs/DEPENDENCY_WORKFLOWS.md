# Dependency workflows (Hub)

**Last updated:** 2026-09-19

| Workflow | Hard/soft | Node | Notes |
|----------|-----------|------|-------|
| dependency-review | **hard** (PR) | n/a | fail-on-severity: high |
| lockfile-validation | **hard** | n/a | **npm-canonical** `package-lock.json` |
| vulnerability-gate | **hard** (cron) | **22** | npm audit high + pip-audit |
| security-scanning | soft | **22** | OWASP + per-project audit moderate |
| performance-monitoring | build | **22** | npm ci retries |
| e2e-smoke | build | **22** | npm ci retries + load test |
| node-matrix | build | **20, 22** | LTS matrix |
| ai-guardian-suite-ci | build | **20** | userscript suite |
| multi-os-gate | **hard** (PR) | **26** | Windows + Linux syntax, tools, extension check |

Node reality check (2026-09-19): **26** in gate/quality paths (`multi-os-gate`, `ops-dashboard-refresh`,
`playwright-e2e`, `all-projects-sanity`, `collabhub-modules-test`, `lint-autofix`), **22** for the
perf/e2e/security crons (`performance-monitoring`, `e2e-smoke`, `vulnerability-gate`, `security-scanning`),
**20** in the `node-matrix` compatibility leg and legacy suites (`ai-guardian-suite-ci`, `regression`,
`generate-docs`). `engines >= 26` is enforced by workspace-gate (informational warning on local v24).

**Workflow security features (all 25 workflows):**
- Least-privilege top-level `permissions:`
- Job `timeout-minutes: 30`
- Top-level `concurrency:` groups
- All 70 action `uses:` are full commit SHAs (WF005 debt: 0)

**Workflow audit status:** 1 accepted finding (WF004 review-flag on `ci-self-heal.yml`).

## Dependabot (`.github/dependabot.yml`)

One shared fleet config; labels feed the AGA `dependabot_coordinator`. Weekly Mondays; patch+minor
grouped per ecosystem, majors open as separate PRs for human review.

| Ecosystem | Directories | PR limits |
|-----------|-------------|-----------|
| github-actions | `/` (all 25 workflows) | 5 |
| npm | `/` (root tooling: eslint, husky, lint-staged, prettier), `/self-evolve-dash`, `/nexus-infinity-hub`, `/third-door-blink-controller`, `/ai-chat-websites`, `/collabhub-modules` | 5/5/5/3/3/2 |
| pip | `/` (root), `/autonomous-github-agent`, `/singularity-operator`, `/solutions-dynamics` | 5/5/5/3 |

For npm and pip, Dependabot scans manifest files in subdirectories below each `directory:`, so the
nested `ai-chat-websites/**` package.jsons are covered by the top-level entry.

Companion hard gate: `dependency-review.yml` fails PRs that introduce high-severity vulnerabilities.

**Conscious exclusions:**
- `AI-Collaboration-Hub/requirements.txt` and `nexus-core/requirements.txt` - auto-generated
  placeholders written by the autonomous agent (v4.3); a Dependabot entry would fight the generator
  on every regeneration.
