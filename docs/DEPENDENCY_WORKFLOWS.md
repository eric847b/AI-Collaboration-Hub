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
| multi-os-gate | **hard** (PR) | **22** | Windows + Linux syntax, tools, extension check |

Primary runtime target: **Node 22**. Suite path stays on 20 until engines allow bump.

**Workflow security features (all 24 workflows):**
- Least-privilege top-level `permissions:`
- Job `timeout-minutes: 30`
- Top-level `concurrency:` groups
- All action pins are full commit SHAs (WF005 debt: 68 → 0)

**Workflow audit status:** 1 accepted finding (WF004 review-flag on `ci-self-heal.yml`).
