# OPS Dashboard Automation

> **Last updated:** 2026-09-19  
> **Status:** Phase 1 implemented 2026-09-19 (scheduled refresh live); Phase 2–3 open — tracked in `docs/ROADMAP.md` Round 12+  
> **Related:** [OPS Dashboard](metrics/OPS-DASHBOARD.md), [Bundle Trends](COVERAGE_PERFORMANCE_TRENDS.md)

---

## Purpose

The OPS Dashboard (`docs/metrics/OPS-DASHBOARD.md`) is currently generated manually via `node tools/ops-dashboard.mjs`. This document outlines the automation strategy to keep it fresh and accurate.

---

## Current State

### Manual Generation Required

| Component | Update Cadence | Last Auto Update |
|-----------|----------------|------------------|
| CI Workflows | On workflow changes | Manual |
| Tooling | On tool changes | Manual |
| Bundle Ledger | On builds | Manual |
| Fleet Parity | On sync | Manual |
| Markdown Links | On doc changes | Manual |
| Extension Health | On manifest changes | Manual |
| Machine Telemetry | Per machine | Manual |

**Problem:** Dashboard is stale after any repository change unless manually regenerated.

---

## Automation Strategy

### 1. GitHub Actions Workflow

Add a scheduled workflow that runs daily and regenerates the dashboard:

```yaml
# .github/workflows/ops-dashboard-refresh.yml
name: OPS Dashboard Refresh
on:
  schedule:
    - cron: '0 4 * * *'  # Daily at 4 AM UTC
  workflow_dispatch:    # Manual trigger
  push:
    paths:
      - 'docs/**'
      - 'tools/**'
      - '.github/workflows/**'
```

**Actions:**
1. Checkout repository
2. Install Node.js dependencies
3. Run `node tools/ops-dashboard.mjs`
4. Check for changes
5. Commit and push if updated

### 2. Incremental Updates

Instead of full regeneration, identify what changed and update selectively:

| Trigger | Affected Sections |
|---------|-------------------|
| Workflow file changes | CI Workflows section |
| Tool additions/removals | Workspace Tooling section |
| Build changes (package.json) | Bundle Ledger section |
| Mirror sync changes | Fleet Mirror section |
| Markdown changes | Markdown Link Health section |
| Manifest changes | Extension Health section |

### 3. Real-Time Components (Future)

For metrics that change frequently (bundle sizes, link health), consider:

- **Webhook triggers** for immediate updates on push
- **API endpoints** for live data sources
- **Caching layer** for expensive computations

---

## Implementation Plan

### Phase 1: Scheduled Refresh (Immediate)
- [x] Create `.github/workflows/ops-dashboard-refresh.yml` — **implemented 2026-09-19**
- [x] Add `cron` schedule (daily at 4 AM UTC) — implemented as `0 4 * * *`
- [x] Add `workflow_dispatch` for manual trigger
- [x] Add path-based triggers for docs/tools/workflows (+ package manifests)
- [x] Test workflow execution — static validation (actionlint clean, `workflow-audit --check-baseline` green, ledger re-seeded 24 → 25 workflows) + live regeneration via `node tools/ops-dashboard.mjs`; first scheduled run due 2026-09-20 04:00 UTC

### Phase 2: Smart Diffs (Short-term)
- [ ] Modify `ops-dashboard.mjs` to track last update timestamp per section
- [ ] Add logic to skip unchanged sections
- [ ] Cache expensive computations (parity checks, link health)

### Phase 3: Real-Time Updates (Long-term)
- [ ] Add webhook receiver for critical events
- [ ] Implement incremental section updates
- [ ] Add dashboard health monitoring

---

## Data Sources

### CI Workflows
- **Source:** `.github/workflows/` directory
- **Tool:** Manual scan + `actionlint` validation
- **Frequency:** On every workflow change

### Workspace Tooling
- **Source:** `tools/*.mjs`, `tools/*.cjs` files
- **Tool:** File system enumeration
- **Frequency:** On tool changes

### Bundle Ledger
- **Source:** `docs/metrics/bundle-history.json`
- **Tool:** `node tools/bundle-trend.cjs collect`
- **Frequency:** On build changes

### Fleet Mirror Parity
- **Source:** `tools/parity-map.json` + mirror directories
- **Tool:** `node tools/sync-parity.mjs check`
- **Frequency:** On sync changes

### Markdown Link Health
- **Source:** All `*.md` files in repository
- **Tool:** `node tools/check-doc-links.mjs`
- **Frequency:** On markdown changes

### Browser Extension
- **Source:** `ai-chat-websites/` userscript suite
- **Tool:** `node tools/extension-check.mjs`
- **Frequency:** On manifest/content changes

### Machine Telemetry
- **Source:** Per-machine state
- **Tool:** `docs/.agent_profile.json`
- **Frequency:** Per machine

---

## Automation Benefits

1. **Always Current:** Dashboard reflects latest repository state
2. **Reduced Manual Work:** No need to remember to regenerate
3. **Early Detection:** Stale metrics caught quickly
4. **Reliability:** Consistent update schedule
5. **Audit Trail:** Git history shows dashboard changes

---

## Related Documentation

- [OPS Dashboard](metrics/OPS-DASHBOARD.md) — The dashboard itself
- [Bundle Trends](COVERAGE_PERFORMANCE_TRENDS.md) — Performance tracking
- [API Documentation Coverage](API_DOCUMENTATION_COVERAGE.md) — Documentation completeness
- [Workspace Templates](WORKSPACE_TEMPLATES.md) — Project scaffolding
