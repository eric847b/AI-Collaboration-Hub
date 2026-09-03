# Change Log

> **Where am I?** This changelog covers the **Unified AI Assistant Suite**. Plan map: [`PLAN_MAP.md`](PLAN_MAP.md). Suite roadmap: [`next_year_roadmap.md`](next_year_roadmap.md).

All notable changes to the Unified AI Assistant Suite will be documented in this file.

## [1.2.0] - 2026-07-21 - STREAMING, RETRY, THEME, VERSIONING, BATCH OPERATIONS

### Added
- Streaming support for AI responses via SSE (OpenAI + Anthropic)
  - Toggle checkbox in Generator tab to enable/disable streaming
  - Cancel button to abort in-progress streaming generation
  - Real-time token display as script output accumulates
  - Automatic fallback to non-streaming on streaming failure
  - Streaming status indicator in Security tab
- Retry logic with exponential backoff for all API requests
  - Wraps OpenAI and Anthropic provider calls with `withRetry`
  - Configuration: max 5 retries, base 1s delay, 2x backoff factor
  - Max total retry time: 120 seconds across all retries
  - Retry indicator in UI shows current retry count on failure
  - Retry state tracked in `state.retryCount`
- Dark/light theme toggle with CSS variables
  - Theme toggle button (🌓/☀️) in header
  - Persistent theme choice via `state.config.theme`
  - Theme applied immediately without reload
  - Tokens: `--suite-bg`, `--suite-border`, `--suite-text`, `--suite-text-secondary`, `--suite-input-bg`, `--suite-input-border`
  - Theme module exposed via `getModule('theme')`
- Script versioning with diff viewer
  - Manual and automatic version snapshots (up to 10 per script)
  - Versions tab lists versions with timestamps
  - View diff between selected version and current script
  - Rollback button to restore a previous version
  - Version module exposed via `getModule('versioning')`
- Batch export/import for generated scripts
  - Export All Scripts copies JSON to clipboard
  - Import Scripts accepts JSON file input with validation
  - Import progress reporting via status message
  - Clear History button to reset generated scripts

### Changed
- Script generation now supports optional streaming chunk callback
- Provider wrappers delegate retry handling to `withRetry`
- `saveGeneratedScript` returns the stored record for versioning hooks
- Security tab includes streaming and retry status fields
- Dashboard layout extended with batch action buttons

### Fixed
- Theme application preserves existing stylesheet content
- Streaming cancellation safely aborts underlying `GM_xmlhttpRequest`
- Version selector fallback renders current script when no ID is selected

### Infrastructure
- **Added** `@grant GM_notification` for desktop notifications
- **Added** `@grant GM_deleteValue` for storage management
- **Added** `@connect api.openai.com` and `@connect api.anthropic.com`
- **Added** `@exclude` for additional sensitive domains
- **Updated** version to 1.2.0 in metadata and CONFIG
- **Added** `MAX_VERSIONS_PER_SCRIPT` config (10)
- **Added** `RETRY` config block with all retry parameters
- **Added** `STORAGE_KEYS.versions` and `STORAGE_KEYS.theme` keys

### Code Quality
- **Added** `withRetry()` - generic retry wrapper with exponential backoff
- **Added** `fetchJsonStream()` - SSE streaming via GM_xmlhttpRequest
- **Added** `processSSEBuffer()` - SSE buffer parser for OpenAI/Anthropic formats
- **Added** `saveScriptVersion()` / `loadScriptVersions()` / `getScriptVersions()`
- **Added** `rollbackScript()` - rollback to specific version
- **Added** `generateDiff()` - line-by-line diff generator
- **Added** `exportAllScripts()` / `importScripts()` - batch operations
- **Added** `toggleTheme()` / `setTheme()` / `applyTheme()` / `getCurrentTheme()`
- **Added** `escapeHtml()` - HTML escaping for safe rendering
- **Added** `refreshDashboard()` / `refreshVersionsTab()` / `showVersionHistory()`
- **Added** `bindDashboardControls()` / `bindVersionControls()`
- **Added** JSDoc comments for all new functions
- **Exported** new functions via module registry: `withRetry`, `generateDiff`, `exportAllScripts`, `importScripts`

## [1.1.0] - 2026-07-16 - HIGHEST VALUE IMPROVEMENTS

### Security Hardening
- **Removed** `@connect *` - replaced with specific API endpoints only (OpenAI, Anthropic)
- **Removed** wildcard `@include http://*/*` - replaced with `@match *://*/*` for precise control
- **Added** `@inject-into page` to limit script execution context
- **Added** `@noframes` to prevent execution in iframes (clickjacking protection)
- **Added** `@exclude *://*.google.com/*` and similar for well-known sensitive sites
- **Added** Content Security Policy via `// ==/UserScript==` metadata
- **Added** comprehensive input sanitization for all API key handling
- **Added** timeout enforcement (60s) on all network requests
- **Removed** plaintext API key storage in favor of session-only storage

### Performance Optimization
- **Removed** unconditional TensorFlow.js loading (3MB+ savings)
- **Removed** dead code: `generateWithML`, `postprocessOutput`, `buildEnhancedPrompt` (unused)
- **Removed** duplicate `generateScriptFilename` variable
- **Optimized** UI creation: cached template literals, reduced DOM queries
- **Optimized** `saveGeneratedScript`: single-pass history operations, no redundant parsing
- **Added** lazy module initialization on first UI open
- **Reduced** initial execution overhead with early returns

### Code Quality
- **Added** JSDoc comments to all public functions
- **Added** strict mode enforcement throughout
- **Removed** circular reference risk in `saveGeneratedScript`
- **Centralized** all magic strings in `CONFIG` object
- **Added** error boundaries for module initialization failures

### Bug Fixes
- **Fixed** `validateScript` not being called before `saveGeneratedScript`
- **Fixed** potential XSS via unsanitized `script.content` display
- **Fixed** race condition in module registration
- **Fixed** missing `return` statement in `generateWithAnthropic` fallback
- **Fixed** unhandled promise rejection in `generateWithProvider`

### UX Improvements
- **Added** copy-to-clipboard button for generated scripts
- **Added** download script as .user.js file functionality
- **Added** clear validation errors with specific line numbers
- **Added** loading states for all async operations
- **Improved** error messages with actionable suggestions
- **Added** keyboard shortcut (Ctrl+Shift+A) to toggle UI

## [1.0.0] - 2026-07-15 - Initial Release

### Added
- AI Script Generator with OpenAI and Anthropic support
- Authentication & Security module
- Unified UI with Dashboard, Generator, and Security tabs
- Script history with validation scoring
- Template system for common script patterns
- Local AI fallback for offline usage
- Menu commands for quick access
- Performance monitoring and optimization
- Cross-module communication system

---

## NEXT PROMPT FOR CONTINUED IMPROVEMENT

```markdown
Continue improving Unified AI Assistant Suite v1.1.0:

HIGH PRIORITY:
1. Add streaming support for AI responses (reduce perceived latency)
2. Implement retry logic with exponential backoff for API failures
3. Add dark/light theme toggle for UI
4. Implement script versioning with diff view
5. Add batch operations (export/import all generated scripts)

MEDIUM PRIORITY:
6. Split monolithic file into modular architecture
7. Add TypeScript type definitions
8. Implement proper unit tests for all utility functions
9. Add automated security scanning for generated scripts
10. Create plugin system for custom AI providers

REFERENCE: Review CHANGELOG.md v1.1.0 for patterns used.
```

### Automation Note:
Save the above as `next_improvement_prompt.md` and use this command to apply:
```bash
cat next_improvement_prompt.md | pbcopy && echo "Prompt copied to clipboard"