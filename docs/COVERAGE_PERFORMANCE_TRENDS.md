# Coverage & Performance Trends Dashboard

> **Visual trends for test coverage and bundle performance across projects.**
> 
> **Last updated:** 2026-09-23 · **Gate status:** PASS (24/24) · **Completed rounds:** 11 (Round 12 in progress: B coverage-trend visualization shipped)

---

## Overview

This dashboard visualizes test coverage and bundle performance trends across all projects, extending the existing OPS Dashboard with trend data.

---

## Test Coverage Trends

### Current Coverage Status

Live coverage is tracked per-snapshot in `docs/metrics/coverage-history.json` (via `node tools/coverage-trend.cjs collect`, preferred source: istanbul `coverage-summary.json`, fallback: decoded raw-V8 `coverage-final.json`) and surfaced in the OPS Dashboard **Coverage Trends** section with per-project lines/stmts/funcs/branches + ASCII lines-% sparklines. Full history: `docs/metrics/coverage-report.md` (`node tools/coverage-trend.cjs markdown`).

| Project | Coverage | Requirement | Status | Last Tested |
|---------|----------|-------------|--------|-------------|
| nexus-infinity-hub | ≥70% | ≥70% (CI hard gate) | ✅ Enforced | Via CI |
| self-evolve-dash | ≥70% | ≥70% (CI hard gate) | ✅ Enforced | Via CI |
| collabhub-modules | 100% (18/18 tests) | N/A | ✅ All passing | Local |
| singularity-operator | Varies | Advisory | 📊 Track | Via CI |
| autonomous-github-agent | Varies | Advisory | 📊 Track | Via CI |
| ai-chat-websites | 80/90% goal | 80/90% (roadmap) | 🌐 Track | Via CI |

**Notes:**
- Coverage ≥70% is enforced as a hard gate in CI for nexus-infinity-hub and self-evolve-dash
- collabhub-modules has 18/18 tests passing (100% test pass rate)
- Python projects have advisory coverage targets
- ai-chat-websites 80/90% coverage goal is tracked in its own roadmap
- nexus-infinity-hub currently measures ~16% lines via local vitest run (2026-09-23; untested UI surface dominates) — the ledger + sparklines exist precisely to track this upward; CI gates remain ≥70%

---

## Bundle Size Trends

### Latest Bundle Sizes (2026-09-17)

| Project | Size | Files | Change | Trend |
|---------|------|-------|--------|-------|
| nexus-infinity-hub | 823.3 KB | 31 | +0.5% | 📈 Slight growth |
| self-evolve-dash | 1.50 MB | 6 | +0.0% | ➡️ Stable |

**Ledger:** `docs/metrics/bundle-history.json` (maintained by `tools/bundle-trend.cjs`)

**Regression gate:** >10% growth fails CI (`performance-monitoring.yml`)

---

## Performance Metrics

### Load Test Results

Run load tests with:
```powershell
node tools/load-test.mjs --project nexus-infinity-hub
node tools/load-test.mjs --project self-evolve-dash
```

**Metrics collected:**
- RPS (Requests Per Second)
- p50/p95/p99 latency
- Error rate
- p95 latency gates

**Gates:**
- Error rate must be below threshold
- p95 latency must be below threshold

---

## CI Performance Trends

### Workflow Execution Times

| Workflow | Trigger | Typical Duration | Timeout |
|----------|---------|------------------|---------|
| quality-checks.yml | PR + push | ~5-10 min | 30 min |
| playwright-e2e.yml | PR + main | ~10-15 min | 30 min |
| e2e-smoke.yml | PR + main | ~5-8 min | 30 min |
| node-matrix.yml | Sat 03:30 + PR | ~15-20 min | 30 min |
| python-checks.yml | PR + push | ~5-10 min | 30 min |
| security-scanning.yml | Sun 02:00 | ~10-15 min | 30 min |
| performance-monitoring.yml | Sat 03:00 + PR | ~5-10 min | 30 min |

**All workflows:** 30-minute timeout, concurrency groups configured

---

## Tooling Performance

### Tool Execution Times (Approximate)

| Tool | Purpose | Typical Time |
|------|---------|--------------|
| `npm run gate` | Quality gate (22 checks) | ~30-60 seconds |
| `node tools/verify-tools.mjs` | Tool health (12 tools) | ~10-20 seconds |
| `node tools/workflow-audit.mjs` | Workflow audit (12 rules) | ~5-10 seconds |
| `node tools/secret-scan.mjs --all` | Secret scan (1551 files) | ~10-30 seconds |
| `node tools/sync-parity.mjs check` | Fleet parity (41 files) | ~5-10 seconds |
| `node tools/bundle-trend.cjs collect` | Bundle snapshot | ~5-15 seconds |
| `npm run dashboard` | OPS Dashboard generation | ~10-20 seconds |
| `npm run quality` | Full 11-step series | ~10-20 minutes |

---

## Improvement Opportunities

### Coverage Visualization

**Current:** Coverage data exists in CI but not visualized in dashboard

**Opportunities:**
1. **Add coverage to OPS Dashboard** — Pull coverage data from CI artifacts or test output
2. **Coverage trend charts** — Track coverage over time (like bundle trends)
3. **Per-project coverage cards** — Show current coverage, requirement, trend

**Implementation approach:**
- Extend `tools/ops-dashboard.mjs` to include coverage data
- Parse test output or CI artifacts for coverage percentages
- Store coverage history similar to bundle history

### Performance Monitoring

**Current:** Bundle size tracked, load test available but not automated in dashboard

**Opportunities:**
1. **Automate load tests** — Run periodically and store results
2. **Performance trend charts** — Track RPS, latency over time
3. **Alert on performance regression** — Like bundle size regression alerts

---

## Data Sources

### Coverage Data
- CI test reports (coverage reports)
- Local test runs: `npm run test:coverage`, `pytest --cov`

### Bundle Data
- `docs/metrics/bundle-history.json` (maintained by `tools/bundle-trend.cjs`)
- `docs/metrics/bundle-report.md` (generated report)

### Performance Data
- Load test output (manual or automated)
- CI workflow timing (from GitHub Actions logs)

### CI Data
- GitHub Actions workflow run history
- `tools/workflow-audit.mjs` for workflow metadata

---

## Related Tools

- **`tools/bundle-trend.cjs`** — Bundle size tracking + regression gate
- **`tools/coverage-trend.cjs`** — Coverage tracking (collect/report/markdown) + append-only ledger — delivered 2026-09-23
- **`tools/ops-dashboard.mjs`** — OPS Dashboard generator
- **`tools/load-test.mjs`** — Load testing with performance gates
- **`tools/verify-tools.mjs`** — Tool health verification
- **`.github/workflows/performance-monitoring.yml`** — CI performance monitoring

---

## Future Enhancements

### Priority 1: Coverage in OPS Dashboard
- [x] Parse coverage from test output — `tools/coverage-trend.cjs collect` reads istanbul summaries (or decodes raw V8) — delivered 2026-09-23
- [x] Store coverage history — `docs/metrics/coverage-history.json` append-only ledger (MAX 200 entries) — delivered 2026-09-23
- [x] Display coverage trends in dashboard — OPS Dashboard **Coverage Trends** section with per-project metrics + ASCII sparklines + link to `coverage-report.md` — delivered 2026-09-23

### Priority 2: Automated Performance Testing
- [ ] Schedule load tests via CI
- [ ] Store performance metrics
- [ ] Visualize performance trends

### Priority 3: Alerts
- [ ] Alert on coverage drop below threshold
- [ ] Alert on bundle size regression (already implemented)
- [ ] Alert on performance regression

---

*Last updated: 2026-09-23 · Gate: PASS (24/24) · Rounds: 11 complete, Round 12 in progress (coverage-trend visualization shipped)*