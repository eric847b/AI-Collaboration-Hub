# NEXT CATALYST

Run nexus-core improve, then apply the top proposed change. Stronger pattern found? Replace orchestrator and bump version. Always finish with scope + update NEXT_CATALYST.md. Minimal. Runtime fails absorbed. Free cron. Zero user time.

Generated: 2026-08-11T17:48Z
Version: 2.8

## v2.8 Complete ✅

**Accomplished:**
- Code-split nexus modules (bundle 676→397kB) - 76b0cda
- Densified 5 components, confirmed 9 optimal
- Fixed Windows Unicode crash, git bleed, TODO scanner false positives
- Fixed invalid react-rnd version (recreated node_modules)
- Resolved vitest jsdom config issue (switched to node environment)
- Reverted VectorFS regression (minified artifacts restored)
- All tests passing (2/2), build successful

**Commits:**
- 76b0cda perf: code-split nexus modules + fix react-rnd version
- 4d9e174 fix: resolve vitest jsdom config issue + revert VectorFS regression

## v2.9 Scope

**Next priorities:**
1. ✅ Restore DOM testing — replaced jsdom with **happy-dom** (jsdom env worker-times-out on vitest 4.1.10 + Windows)
2. ✅ Add comprehensive component tests with proper DOM assertions (KernelWidget + store + utils = 19 tests)
3. Implement CI/CD pipeline with automated testing
4. Performance monitoring and bundle size tracking
5. Documentation for component densification patterns

**v2.9 Progress:**
- Fixed real bug: `addScript` param shadowing (prepended whole state object instead of script) - bc99cbd
- Stabilized vitest: `globals:false` + `pool:threads`; forks pool can't spawn DOM-env workers - bc99cbd, 474df79
- Restored DOM testing via happy-dom (^20.11.2) — jsdom env hangs with "failed to start forks worker" - 474df79
- Added real test coverage: 19 tests across 4 files (store CRUD/versioning/persistence, cn() util, KernelWidget DOM render), stable across consecutive runs - bc99cbd, 474df79

**Commits:**
- bc99cbd test: add store + utils tests, fix addScript shadowing, stabilize vitest
- 474df79 feat: restore DOM testing via happy-dom + add component tests

**Resolved blockers:**
- ~~Vitest 4.1.10 jsdom incompatibility~~ → solved with happy-dom + threads pool
- ~~"reading 'config'" runtime race~~ → solved with globals:false + explicit imports

## v2.10 Candidate Remaining Items

1. CI/CD: run `npm run check` (lint + test + build) in GitHub Actions (workflow exists; enrich with happy-dom + threads flags if needed)
2. Performance monitoring + bundle size tracking (baseline 397.67kB index)
3. More component tests (Dashboard, EventBus, PromptLab, Sidebar)
4. Component densification documentation
5. Node engine mismatch: package.json declares `>=26.0.0` but dev machine runs v24.14.0 (verify before relying on engine-gated features)
