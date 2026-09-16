# Dependency workflows (Hub)

| Workflow | Hard/soft | Node | Notes |
|----------|-----------|------|-------|
| dependency-review | **hard** (PR) | n/a | fail-on-severity: high |
| lockfile-validation | **hard** | n/a | **npm-canonical** `package-lock.json` |
| vulnerability-gate | **hard** (cron) | **22** | npm audit high + pip-audit |
| security-scanning | soft | **22** | OWASP + per-project audit moderate |
| performance-monitoring | build | **22** | npm ci retries |
| e2e-smoke | build | **22** | npm ci retries |
| node-matrix | build | **20, 22** | LTS matrix |
| ai-guardian-suite-ci | build | **20** | userscript suite |

Primary runtime target: **Node 22**. Suite path stays on 20 until engines allow bump.
