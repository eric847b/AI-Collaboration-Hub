# Unified AI Assistant Suite — API Reference

> **For contributors and module developers.** This reference covers all 36 core modules
> in `Userscripts/AI Chat Userscript Studio/Userscript Suite/Modules/00-Core/`.
> Each module is an IIFE userscript that registers into the `window.UnifiedSuite` global.

**Last updated:** 2026-09-27 · **Modules covered:** 36 · **ROADMAP:** 386/386 (100%)

---

## Table of Contents

- [Core Platform (001–015)](#core-platform)
- [Nexus Engine (016–021)](#nexus-engine)
- [Observability & Quality (022–032)](#observability--quality)
- [Cross-Cutting (033–036)](#cross-cutting)
- [Other Module Folders](#other-module-folders)


---

## Core Platform

### 001-site-adapter
Adapts the suite to the current website's DOM.

| Function | Signature | Description |
|----------|-----------|-------------|
| `detectPageKind` | `() → string` | Returns detected page type |
| `findInput` | `() → HTMLElement\|null` | Locates primary text input |
| `findSendButton` | `() → HTMLElement\|null` | Locates send/submit button |
| `findScrollable` | `() → HTMLElement\|null` | Locates scrollable message container |

---

### 002-error-handling
Compatibility layer for error handling across userscript managers.

| Function | Signature | Description |
|----------|-----------|-------------|
| `createCompatibilityLayer` | `(ctx) → object` | Manager-agnostic error context |
| `createStandaloneErrorHandling` | `(ctx) → object` | Full error handler with recovery |

---

### 003-module-registry (legacy)
Standalone module registry. Superseded by **020-module-registry**.

---

### 004-intelligent-error-handler-module
AI-driven error classification and recovery suggestions.

---

### 005-config-manager
Standalone configuration manager with typed get/set, defaults, change listeners.

---

### 006-unified-configuration-manager-module
Merges multiple config sources (script, URL params, GM storage) into one object.

---

### 007-config-validator
JSON Schema validator for module configuration.

---

### 008-utilities
Shared helpers: debounce, throttle, deep-clone, escapeHtml, formatBytes, etc.

---

### 009-service-container
Dependency injection container. Registers services by name, resolves lazily.

---

### 010-module-loader
Dynamic module loader with dependency resolution via GM_xmlhttpRequest.

---

### 011-memory-manager
Tracks memory usage: `record`, `getStats`, `getSamples`, `sweep`.

---

### 012-hub-event-handler
IPC event bus for inter-module communication.

| Function | Signature | Description |
|----------|-----------|-------------|
| `respond` | `(msg, payload) → void` | Send success response |
| `respondError` | `(msg, err) → void` | Send error response |
| `broadcastEvent` | `(type, data) → void` | Broadcast to all listeners |
| `handleRegisterModule` | `(entry) → void` | Process registration |
| `handleReloadModule` | `(name) → void` | Hot-reload a module |
| `handleUnloadModule` | `(name) → void` | Gracefully unload |
| `handleRefreshRegistry` | `() → void` | Force re-scan |
| `handleInspectModule` | `(name) → object` | Module metadata + health |
| `handleInspectService` | `(name) → object` | Service descriptor |
| `handleMemoryRecord` | `(sample) → void` | Record memory sample |
| `handleMemoryStats` | `() → object` | Aggregated memory stats |
| `handleConfigGet` | `(key) → *` | Read config value |
| `handleConfigSet` | `(key, val) → void` | Write config value |

---

### 013-control-panel-ui
Main dashboard UI. Renders tables, panels, toasts, charts.

| Function | Signature | Description |
|----------|-----------|-------------|
| `emit` | `(event, data) → void` | Emit UI event |
| `toast` | `(msg, type) → void` | Show notification |
| `renderModulesTable` | `(host) → void` | Fill module list |


---

## Nexus Engine

### 016-hub-orchestrator
Central orchestrator. Manages registry, health, catalyst cycle, scope.

| Function | Signature | Description |
|----------|-----------|-------------|
| `atomicWrite` / `atomicRead` | `(key,data)→void` / `(key,def)→*` | Crash-safe GM storage |
| `getRegistry` / `saveRegistry` | `()→object` / `(reg)→void` | Registry access |
| `registerModule` | `(entry)→object` | Register/update module |
| `computeScope` | `(modules)→object` | Compute suite scope |
| `checkModuleHealth` | `(name)→object` | Health-check one module |
| `runCatalyst` | `(scope)→object` | Run catalyst cycle |
| `validateRegistry` | `()→object` | Validate integrity |
| `runSelfAudit` | `()→object` | Full self-audit |
| `generateCatalystPrompt` | `(scope,audit,failures)→string` | Build AI catalyst prompt |
| `discoverModules` | `()→object` | Auto-discover from globals |
| `healUnhealthy` | `(name)→object` | Self-heal + recovery plan |
| `init` / `getHealth` | `()→void` / `()→object` | Init + health |

---

### 017-self-evolution-engine
Failure tracking, retry backoff, recovery planning, audit ledger.

| Function | Signature | Description |
|----------|-----------|-------------|
| `recordFix` / `markVerified` | `(name,desc)→void` / `(id)→void` | Fix tracking |
| `recordFailure` | `(name,err,ctx)→void` | Record failure |
| `shouldRetryFailure` | `(f)→boolean` | Retry check |
| `getBackoffDelay` | `(attempts)→number` | Exponential backoff |
| `attemptRecovery` | `(f)→object` | Recover from failure |
| `planRecovery` | `(failure)→object` | Consensus recovery plan |
| `runAudit` | `()→object` | Evolution audit |

---

### 018-dashboard-core
Real-time dashboard, event tracking, analytics, FPS counter.

| Function | Signature | Description |
|----------|-----------|-------------|
| `trackEvent` | `(type,data)→void` | Record event |
| `getAnalyticsSummary` | `()→object` | Aggregate analytics |
| `collectSnapshot` | `()→object` | Full system snapshot |
| `getPerformanceMetrics` | `()→object` | perf.now() metrics |
| `startFps` / `stopFps` | `()→void` | FPS sampling |
| `getHealthStatus` | `()→object` | Subsystem health |
| `renderDashboard` | `(host)→void` | Main render |

---

### 019-consensus-engine
Multi-role AI consensus (Architect, Researcher, Reviewer).

| Function | Signature | Description |
|----------|-----------|-------------|
| `getFailureContext` | `()→object` | Pull active failures |
| `runConsensus` | `(task,opts)→object` | Run multi-role consensus |

---

### 020-module-registry
Full registry with validation, topological sort, auto-discovery, recovery tracking.

| Function | Signature | Description |
|----------|-----------|-------------|
| `register` / `remove` | `(entry)→object` / `(name)→void` | Add/remove module |
| `getByName` / `getByRole` / `getByCategory` | `(name)→object` / `(role)→array` / `(cat)→array` | Lookups |
| `validate` | `()→object` | Validate integrity |
| `topologicalSort` | `()→array` | Sort by dependency order |
| `scanExisting` / `discoverFromGlobals` | `()→array` | Auto-discovery |
| `discoverPlatforms` | `()→array` | Chat platform discovery |
| `recordRecoveryAction` | `(name,plan)→object` | Track recovery |
| `getStats` | `()→object` | Registry statistics |

---

### 021-failure-recovery
Failure detection, retry with backoff, escalation, self-healing.

| Function | Signature | Description |
|----------|-----------|-------------|
| `record` | `(entry)→void` | Record failure |
| `getFailureSummary` | `()→object` | Summarize active failures |
| `retryWithBackoff` | `(fn,opts)→*` | Retry with backoff |
| `escalate` | `(err)→void` | Escalate unrecoverable |
| `selfHeal` | `(modState)→object` | Self-healing attempt |
| `getPolicy` | `()→object` | Current policy |
| `renderModuleDetails` | `(name, host) → void` | Single module details |
| `renderServiceDropdown` | `(host) → void` | Service picker |
| `renderServiceInfo` | `(name, host) → void` | Service detail panel |
| `renderMemorySamples` | `(host) → void` | Memory timeline chart |
| `renderMemoryStats` | `(host) → void` | Memory aggregate stats |
| `renderConfigCurrent` | `(host) → void` | Config viewer/editor |
| `addConfigLog` | `(entry) → void` | Append config log |
| `renderErrors` | `(host) → void` | Error log panel |
| `addEvent` | `(entry) → void` | Append event log |

---

### 014-autonomous-improvement
Autonomous code improvement engine.

| Function | Signature | Description |
|----------|-----------|-------------|
| `runCycle` | `(ctx) → void` | Full improvement cycle |
| `proposeChange` | `(change) → object` | Submit improvement proposal |
| `applyChange` | `(id) → void` | Apply approved change |

---

### 015-module-bootstrap-helper
Bootstraps module init. Provides `refreshInterval` and `stop`.

---

### 016-hub-orchestrator
Central orchestrator that ties all subsystems together.

| Function | Signature | Description |
|----------|-----------|-------------|
| `init` | `() → void` | Full system init |
| `shutdown` | `() → void` | Graceful shutdown |
| `getStatus` | `() → object` | Combined system status |

---

### 017-evolution-auditor
Self-audit, recovery planning, audit ledger.

| Function | Signature | Description |
|----------|-----------|-------------|
| `recordFix` / `markVerified` | `(name,desc)→void` / `(id)→void` | Fix tracking |
| `recordFailure` | `(name,err,ctx)→void` | Record failure |
| `shouldRetryFailure` | `(f)→boolean` | Retry check |
| `getBackoffDelay` | `(attempts)→number` | Exponential backoff |
| `attemptRecovery` | `(f)→object` | Recover from failure |
| `planRecovery` | `(failure)→object` | Consensus recovery plan |
| `runAudit` | `()→object` | Evolution audit |

---

### 018-dashboard-core
Real-time dashboard, event tracking, analytics, FPS counter.

| Function | Signature | Description |
|----------|-----------|-------------|
| `trackEvent` | `(type,data)→void` | Record event |
| `getAnalyticsSummary` | `()→object` | Aggregate analytics |
| `collectSnapshot` | `()→object` | Full system snapshot |
| `getPerformanceMetrics` | `()→object` | perf.now() metrics |
| `startFps` / `stopFps` | `()→void` | FPS sampling |
| `getHealthStatus` | `()→object` | Subsystem health |
| `renderDashboard` | `(host)→void` | Main render |

---

### 019-consensus-engine
Multi-role AI consensus (Architect, Researcher, Reviewer).

| Function | Signature | Description |
|----------|-----------|-------------|
| `getFailureContext` | `()→object` | Pull active failures |
| `runConsensus` | `(task,opts)→object` | Run multi-role consensus |

---

### 020-module-registry
Full registry with validation, topological sort, auto-discovery, recovery tracking.

| Function | Signature | Description |
|----------|-----------|-------------|
| `register` / `remove` | `(entry)→object` / `(name)→void` | Add/remove module |
| `getByName` / `getByRole` / `getByCategory` | `(name)→object` / `(role)→array` / `(cat)→array` | Lookups |
| `validate` | `()→object` | Validate integrity |
| `topologicalSort` | `()→array` | Sort by dependency order |
| `scanExisting` / `discoverFromGlobals` | `()→array` | Auto-discovery |
| `discoverPlatforms` | `()→array` | Chat platform discovery |
| `recordRecoveryAction` | `(name,plan)→object` | Track recovery |
| `getStats` | `()→object` | Registry statistics |

---

### 021-failure-recovery
Failure detection, retry with backoff, escalation, self-healing.

| Function | Signature | Description |
|----------|-----------|-------------|
| `record` | `(entry)→void` | Record failure |
| `getFailureSummary` | `()→object` | Summarize active failures |
| `retryWithBackoff` | `(fn,opts)→*` | Retry with backoff |
| `escalate` | `(err)→void` | Escalate unrecoverable |
| `selfHeal` | `(modState)→object` | Self-healing attempt |
| `getPolicy` | `()→object` | Current policy |
| `renderModuleDetails` | `(name, host) → void` | Single module details |
| `renderServiceDropdown` | `(host) → void` | Service picker |
| `renderServiceInfo` | `(name, host) → void` | Service detail panel |
| `renderMemorySamples` | `(host) → void` | Memory timeline chart |
| `renderMemoryStats` | `(host) → void` | Memory aggregate stats |
| `renderConfigCurrent` | `(host) → void` | Config viewer/editor |
| `addConfigLog` | `(entry) → void` | Append config log |
| `renderErrors` | `(host) → void` | Error log panel |

---

## Observability & Quality

### 022-025 — Observability, Analytics & Platform
Modules for observability infrastructure, analytics engines, data visualization, and cross-platform support.

### 026-analytics-engine
Comprehensive analytics engine with session tracking, funnel analysis, cohort analysis.

| Function | Signature | Description |
|----------|-----------|-------------|
| `trackSession` | `(session) → void` | Record user session |
| `analyzeFunnel` | `(steps) → object` | Funnel conversion analysis |
| `cohortAnalysis` | `(cohort) → object` | Cohort retention |
| `buildReport` | `(opts) → object` | Full analytics report |
| `exportData` | `(format) → string` | CSV/JSON export |

---

### 027-security-hardening
Security hardening with XSS prevention, CSP enforcement, secret scanning, dependency audit.

| Function | Signature | Description |
|----------|-----------|-------------|
| `sanitizeInput` | `(input) → string` | XSS prevention |
| `enforceCSP` | `(policy) → void` | CSP header enforcement |
| `scanSecrets` | `(code) → array` | Secret/credential scanning |
| `auditDependencies` | `() → object` | Dependency vulnerability audit |
| `rotateKeys` | `(service) → void` | Key rotation |

---

### 028-performance-optimizer
Performance optimization with lazy loading, code splitting, caching, memory leak detection.

| Function | Signature | Description |
|----------|-----------|-------------|
| `lazyLoad` | `(module, opts) → Promise` | Dynamic import with retry |
| `splitCode` | `(bundles) → object` | Bundle splitting config |
| `configureCache` | `(strategy) → void` | Cache strategy setup |
| `detectMemoryLeaks` | `() → object` | Memory leak detection |

### 029-monitoring-observability
Full monitoring stack with alerting, log aggregation, distributed tracing, SLO tracking.

| Function | Signature | Description |
|----------|-----------|-------------|
| `sendMetric` | `(name, value, tags) → void` | Emit metric |
| `createAlert` | `(rule) → object` | Define alert rule |
| `aggregateLogs` | `(query) → array` | Log aggregation query |
| `startTrace` | `(name) → span` | Distributed trace span |
| `trackSLO` | `(slo) → object` | SLO compliance tracking |
| `runHealthCheck` | `() → object` | System health check |

---

### 030-feature-enhancements
Feature enhancements including theme engine, command palette, plugin system, keyboard shortcuts.

| Function | Signature | Description |
|----------|-----------|-------------|
| `registerTheme` | `(theme) → void` | Add theme |
| `openCommandPalette` | `() → void` | Command palette UI |
| `installPlugin` | `(manifest) → object` | Plugin lifecycle |
| `bindShortcut` | `(combo, fn) → void` | Keyboard shortcut |
| `migrateConfig` | `(from, to) → void` | Config migration |

---

### 031-ui-ux-enhancements
UI/UX enhancements with responsive design, animations, accessibility, internationalization.

| Function | Signature | Description |
|----------|-----------|-------------|
| `applyResponsive` | `(breakpoints) → void` | Responsive layout |
| `animateTransition` | `(el, opts) → void` | CSS/JS animation |
| `checkA11y` | `(root) → array` | Accessibility audit |

### 032-testing-quality
Testing & quality with test runner, coverage analysis, E2E testing, canary deployments.

| Function | Signature | Description |
|----------|-----------|-------------|
| `runTests` | `(pattern) → object` | Test runner |
| `analyzeCoverage` | `() → object` | Coverage report |
| `runE2E` | `(spec) → object` | End-to-end test |
| `createCanary` | `(config) → object` | Canary deployment |
| `promoteCanary` | `(id) → void` | Promote canary |
| `rollbackCanary` | `(id) → void` | Rollback canary |

---

## Cross-Cutting

### 033-cross-cutting-concerns
Cross-cutting concerns: logging, caching, feature flags, rate limiting.

| Function | Signature | Description |
|----------|-----------|-------------|
| `createLogger` | `(ns) → object` | Namespaced logger |
| `featureFlag` | `(name) → boolean` | Feature flag check |
| `rateLimit` | `(key, limit) → boolean` | Rate limit check |
| `cacheWrap` | `(fn, ttl) → function` | Memoize with TTL |

---

### 034-developer-experience
Developer experience: hot reload, debug tools, scaffolding, code generation.

| Function | Signature | Description |
|----------|-----------|-------------|
| `hotReload` | `(module) → void` | Hot module replacement |
| `debugInspect` | `(obj) → object` | Deep inspection |
| `scaffoldProject` | `(template) → void` | Project scaffolding |
| `generateCode` | `(spec) → string` | Code generation |

---

### 035-documentation-generator
Documentation generation with JSDoc parsing, markdown rendering, changelog, API docs.

| Function | Signature | Description |
|----------|-----------|-------------|
| `parseJSDoc` | `(file) → array` | Extract JSDoc comments |
| `renderMarkdown` | `(md) → string` | Markdown to HTML |
| `buildChangelog` | `(commits) → string` | Generate changelog |
| `buildAPIDocs` | `(modules) → string` | Generate API reference |

---

### 036-infra-devops
Infrastructure & DevOps with Docker, K8s, Terraform, CI/CD, monitoring.


---

## Other Module Folders

| Folder | Range | Description |
|--------|-------|-------------|
| `05-Security` | 037–045 | Security scanning, threat modeling, zero-trust |
| `12-Testing` | — | 25 test files covering 500+ test cases |
| `15-Analytics` | 046–050 | Dashboards, reporting, BI integration |
| `18-Organization` | 051–055 | Bookmarks, tags, search, archive |
| `19-Hotkeys-Shortcuts` | 056–060 | Global shortcuts, context bindings |

---

## Testing

```bash
npm run test:modules    # Run all tests
npm run test:coverage   # Run with coverage
npx jest --runInBand tests/path/to/test.test.js  # Single file
```

Coverage thresholds: **80%** branches, functions, lines, statements.

---

## See Also

- [ROADMAP.md](../Userscripts/AI%20Chat%20Userscript%20Studio/Userscript%20Suite/ROADMAP.md) — Feature roadmap (386/386 complete)
- [CONTRIBUTING.md](../CONTRIBUTING.md) — Contributor guide
- [QUALITY_STATUS.md](../QUALITY_STATUS.md) — Quality metrics
- [DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md) — Developer onboarding
- [next_year_roadmap.md](../next_year_roadmap.md) — Future trajectory
| Function | Signature | Description |
|----------|-----------|-------------|
| `dockerComposeBuild` | `(services) → string` | Generate docker-compose.yml |
| `k8sManifest` | `(spec) → object` | K8s deployment manifest |
| `terraformResource` | `(type, config) → string` | Terraform HCL output |
| `ansiblePlaybook` | `(tasks) → object` | Ansible playbook YAML |
| `ciPipeline` | `(stages) → object` | CI/CD pipeline config |
| `helmChart` | `(spec) → object` | Helm chart structure |
| `i18n` | `(key, locale) → string` | Internationalization |
| `measureCLS` | `() → number` | Layout shift metric |
| `benchmark` | `(fn, opts) → object` | Performance benchmarking |

| Module | Key Exports | Description |
|--------|-------------|-------------|
| `022-observability-infrastructure` | `initObservability`, `getMetrics` | Observability pipeline |
| `023-analytics-engine` | `trackEvent`, `getAnalytics`, `buildReport` | Event analytics |
| `024-data-visualization` | `renderChart`, `renderHeatmap`, `renderTimeline` | Chart rendering |
| `025-cross-platform` | `adaptPlatform`, `getCapabilities` | Platform detection & adaptation |
| `addEvent` | `(entry) → void` | Append event log |