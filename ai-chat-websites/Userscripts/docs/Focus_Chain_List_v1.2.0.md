# Focus Chain List - v1.2.0 Implementation

**Task ID**: 1784384535721  
**Version**: 1.2.0  
**Created**: 2026-07-18  
**Status**: Ready for Implementation

## Overview

This document provides the focused implementation chain for the v1.2.0 improvements. Each feature is broken down into atomic, actionable steps that can be implemented sequentially.

---

## Focus Chain Priority Order

The implementation follows this dependency-aware order:

1. **Streaming Support** - Highest user impact, foundation for real-time UX
2. **Retry Logic** - Critical reliability improvement for all network operations
3. **Theme Toggle** - Quick win, visible UI improvement, no dependencies
4. **Script Versioning** - Builds on existing history system
5. **Batch Operations** - Completes the workflow, depends on versioning

---

## Feature 1: Streaming Support for AI Responses

**Priority**: HIGHEST  
**Complexity**: Medium  
**Dependencies**: None

### Subtask Chain

- [ ] **1.1** Create `fetchJsonStream()` utility function using GM_xmlhttpRequest
  - Implement SSE parsing for OpenAI/Anthropic
  - Handle chunked response parsing
  - Add abort controller support
  
- [ ] **1.2** Add streaming configuration to CONFIG object
  - `CONFIG.STREAMING.enabled` (default: false)
  - `CONFIG.STREAMING.timeout` (default: 60000ms)
  - `CONFIG.STREAMING.retryOnFail` (default: true)
  - Provider-specific streaming endpoints

- [ ] **1.3** Modify `callOpenAI()` to support streaming mode
  - Add `stream: true` parameter
  - Parse SSE events: `data: [DONE]` and `data: {"choices":[...]}`
  - Yield tokens via callback function
  - Handle connection drops gracefully

- [ ] **1.4** Modify `callAnthropic()` to support streaming mode
  - Use Anthropic SSE format
  - Parse `event: content_block_delta` events
  - Extract `delta.text` from events
  - Yield tokens via callback function

- [ ] **1.5** Add streaming UI components to buildEnhancedPrompt
  - Add checkbox: "Enable streaming" (aria-label, role="checkbox")
  - Create token display area with monospace font
  - Add streaming indicator (animated dots or spinner)
  - Show character count as tokens arrive

- [ ] **1.6** Implement fallback mechanism
  - Catch streaming errors (network, timeout, parse errors)
  - Automatically retry once with non-streaming mode
  - Display warning: "Streaming failed, falling back to standard mode"

- [ ] **1.7** Update buildEnhancedPrompt to use streaming
  - Check CONFIG.STREAMING.enabled flag
  - Pass streaming callback to AI provider calls
  - Update UI in real-time as tokens arrive
  - Maintain final response parsing

- [ ] **1.8** Add timeout and error handling
  - Enforce streaming timeout (60s default)
  - Cancel pending streams on user action
  - Display errors: "Streaming timeout", "Connection lost", "Parse error"

### Acceptance Criteria

- Streaming toggle visible in UI
- Tokens appear in real-time when enabled
- Automatic fallback on streaming failure
- No breaking changes to non-streaming mode
- All new elements have ARIA attributes

---

## Feature 2: Retry Logic with Exponential Backoff

**Priority**: HIGH  
**Complexity**: Medium  
**Dependencies**: None

### Subtask Chain

- [ ] **2.1** Create `NetworkRetry` utility class
  - Constructor takes: maxRetries, baseDelay, maxDelay, maxTotalTime
  - Default config: 5 retries, 1s base, 16s max, 120s total
  - Exponential backoff calculation: `min(baseDelay * 2^attempt, maxDelay)`
  - Jitter: ±20% random variation to prevent thundering herd

- [ ] **2.2** Implement retry decision logic
  - Retry on: network errors (TypeError), 5xx errors, 429 rate limit
  - Do NOT retry on: 400/401/403/404 (client errors)
  - Check `response.ok` and `response.status`
  - Parse Retry-After header for 429 responses

- [ ] **2.3** Wrap `fetchJson()` with retry logic
  - Replace raw fetch calls with `NetworkRetry.execute()`
  - Pass original request as callback
  - Track attempt count and total elapsed time
  - Abort if maxTotalTime exceeded

- [ ] **2.4** Wrap `callOpenAI()` with retry logic
  - Decorate API call with retry wrapper
  - Preserve existing error handling
  - Log each retry attempt with delay

- [ ] **2.5** Wrap `callAnthropic()` with retry logic
  - Same wrapping as OpenAI
  - Provider-specific retry headers (Retry-After)

- [ ] **2.6** Add retry UI indicator
  - Show retry count: "Attempt 2 of 5..."
  - Display countdown: "Retrying in 2s..."
  - Progress bar for elapsed time
  - Disable retry button during retry loop

- [ ] **2.7** Add manual retry button
  - Show after final failure with "Retry" button
  - Button has aria-label and role="button"
  - Resets retry state and re-executes request
  - Clears error message on click

- [ ] **2.8** Add retry configuration to CONFIG
  - `CONFIG.RETRY.maxRetries` (default: 5)
  - `CONFIG.RETRY.baseDelay` (default: 1000ms)
  - `CONFIG.RETRY.maxDelay` (default: 16000ms)
  - `CONFIG.RETRY.maxTotalTime` (default: 120000ms)

### Acceptance Criteria

- All network requests support automatic retry
- Exponential backoff visible in logs
- Retry indicator shown in UI during attempts
- Manual retry available after final failure
- Configurable via CONFIG object

---

## Feature 3: Dark/Light Theme Toggle

**Priority**: HIGH  
**Complexity**: Low  
**Dependencies**: None

### Subtask Chain

- [ ] **3.1** Create CSS variables for theming
  - Define `--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-secondary`
  - Define `--accent-primary`, `--accent-hover`, `--border-color`, `--shadow`
  - Define `--error-color`, `--success-color`, `--warning-color`
  - Define `--code-bg`, `--code-text`

- [ ] **3.2** Define dark and light color palettes
  - **Dark theme**: Dark backgrounds (#1a1a2e, #16213e), light text (#eaeaea)
  - **Light theme**: Light backgrounds (#f5f5f5, #ffffff), dark text (#333333)
  - High contrast mode option for accessibility

- [ ] **3.3** Add theme toggle button to UI header
  - Button with sun/moon icon (emoji or SVG)
  - aria-label: "Toggle dark/light theme"
  - role="button", tabindex="0"
  - Keyboard accessible (Enter/Space to toggle)

- [ ] **3.4** Create theme persistence system
  - Save preference to `state.config.theme` ('dark' | 'light' | 'system')
  - Load on initialization: `applyTheme(state.config.theme || 'light')`
  - Update immediately on toggle without reload

- [ ] **3.5** Implement `applyTheme()` function
  - Accept theme name as parameter
  - Set `document.documentElement.setAttribute('data-theme', theme)`
  - Update CSS variables accordingly
  - Handle 'system' preference via `prefers-color-scheme` media query

- [ ] **3.6** Add high contrast mode support
  - Check `window.matchMedia('(prefers-contrast: high)')`
  - Override colors for high contrast: thicker borders, higher contrast ratios
  - WCAG AAA compliance (7:1 contrast ratio)

- [ ] **3.7** Update all existing CSS to use variables
  - Replace hardcoded colors with var(--variable-name)
  - Ensure all UI components inherit theme properly
  - Test in both themes for visual consistency

- [ ] **3.8** Add animation for theme switching
  - Smooth 300ms transition on color changes
  - `transition: background-color 0.3s ease, color 0.3s ease;`
  - Prevents jarring visual shift

### Acceptance Criteria

- Theme toggle visible and accessible
- Theme persists across sessions
- Smooth transition between themes
- High contrast mode supported
- All UI elements styled with CSS variables

---

## Feature 4: Script Versioning with Diff View

**Priority**: MEDIUM  
**Complexity**: Medium  
**Dependencies**: Feature 3 (Theme Toggle)

### Subtask Chain

- [ ] **4.1** Extend history data structure to support versions
  - Add `versions` array to `state.history[scriptId]`
  - Each version: `{ id, content, timestamp, provider, parentId }`
  - Limit to last 10 versions per scriptId
  - Auto-prune oldest when limit exceeded

- [ ] **4.2** Implement version saving on script generation
  - On new script generation, create version entry
  - Link to previous version via `parentId`
  - Include metadata: timestamp, provider, prompt

- [ ] **4.3** Create version history UI component
  - Show in Dashboard tab under script card
  - List versions: "v1", "v2", etc. with timestamps
  - Click version to view details
  - "Rollback to this version" button per version

- [ ] **4.4** Implement diff algorithm (Myers diff or simple line diff)
  - Compare two versions line-by-line
  - Mark additions: `+` prefix, green color
  - Mark deletions: `-` prefix, red color
  - Mark unchanged lines: ` ` prefix, gray color
  - Line numbering on both sides

- [ ] **4.5** Create diff view modal
  - Modal with split-pane or unified diff view
  - Scroll synced between left/right panes (if split)
  - Color-coded lines (green/red/gray)
  - Show metadata: "Comparing v2 (2026-07-18 14:32) vs v1 (2026-07-18 14:30)"

- [ ] **4.6** Implement rollback functionality
  - "Rollback to v2" button restores that version's content
  - Creates new version entry after rollback (rollback is a version too)
  - Updates script card display
  - Confirmation dialog before rollback

- [ ] **4.7** Add version pruning logic
  - OnEachNewVersion(): check versions.length > 10
  - Remove oldest version if over limit
  - Maintain version chain integrity

### Acceptance Criteria

- Version history visible for each script
- Diff view shows color-coded changes
- Rollback creates new version (not destructive)
- Limited to 10 versions per script
- Theme colors applied to diff view

---

## Feature 5: Batch Operations (Export/Import)

**Priority**: MEDIUM  
**Complexity**: Low  
**Dependencies**: Feature 4 (Script Versioning)

### Subtask Chain

- [ ] **5.1** Implement "Export All Scripts" functionality
  - Button in Dashboard header: "Export All"
  - Creates JSON blob with structure:
    ```json
    {
      "version": "1.2.0",
      "exportDate": "2026-07-18T20:00:00Z",
      "scripts": {
        "scriptId1": { content, validation, timestamps, provider, versions }
      }
    }
    ```
  - Trigger download via Blob API
  - Filename: `userscripts-backup-YYYY-MM-DD.json`

- [ ] **5.2** Implement "Import Scripts" functionality
  - Button in Dashboard: "Import"
  - File input accepting .json files
  - Validate file structure before import
  - Display validation errors if malformed

- [ ] **5.3** Add merge/replace options
  - Radio buttons: "Merge with existing" / "Replace all"
  - Merge: add new scripts, skip duplicates
  - Replace: clear existing, import all
  - Show preview: "This will add 15 scripts, update 3"

- [ ] **5.4** Implement import validation
  - Check required fields: `content`, `validation`, `timestamp`
  - Verify JSON schema compliance
  - Reject scripts with invalid metadata
  - Show error count: "5 scripts failed validation"

- [ ] **5.5** Add import progress UI
  - Progress bar during import
  - Show: "Importing... 7/15"
  - Success/failure summary after completion
  - Option to retry failed imports

- [ ] **5.6** Add export metadata
  - Include EXIF-style metadata: script count, total size
  - Include version compatibility info
  - Include export tool version

### Acceptance Criteria

- Export creates valid JSON with all script data
- Import validates and reports errors
- Merge and replace options both work
- Progress indicator during import
- Backup files are self-contained

---

## Implementation Checklist

### Pre-Implementation

- [ ] Back up current `Unified-AI-Assistant-Suite.user.js`
- [ ] Review DEPENDENCIES section to ensure no conflicts
- [ ] Set up test environment with Tampermonkey/Violentmonkey
- [ ] Create branch: `feature/v1.2.0-improvements`

### Implementation Order

1. **Feature 1**: Streaming Support (Days 1-2)
2. **Feature 2**: Retry Logic (Days 2-3)
3. **Feature 3**: Theme Toggle (Day 4)
4. **Feature 4**: Script Versioning (Days 5-6)
5. **Feature 5**: Batch Operations (Day 7)

### Post-Implementation

- [ ] Update `@version` to 1.2.0 in metadata
- [ ] Update CHANGELOG.md with v1.2.0 section
- [ ] Update IMPROVEMENT_v1.1.0.md with new changes
- [ ] Run full test suite
- [ ] Test in Tampermonkey, Violentmonkey, Greasemonkey
- [ ] Verify backward compatibility with v1.1.0 data
- [ ] Update todo_list.json with completed features
- [ ] Commit with message: "feat: implement v1.2.0 improvements"

---

## Dependencies

### Internal Dependencies

- Feature 4 requires Feature 3 (theme colors for diff view)
- Feature 5 requires Feature 4 (versioning for complete export)

### No External Dependencies

All features use native browser APIs:
- GM_xmlhttpRequest (already available)
- Blob API (already available)
- CSS Variables (already available)
- localStorage/state.config (already available)

---

## Metrics (v1.2.0 Target)

- **Features**: 5 new features
- **Lines Added**: ~800-1000
- **Breaking Changes**: None
- **Browser Support**: Chrome, Firefox, Edge (all support CSS variables)
- **Load Time**: No significant increase (lazy initialization)
- **Accessibility**: WCAG 2.1 AA compliance maintained

---

## Notes

- Each feature is independently testable
- Features can be implemented in parallel by different developers
- Rollback is safe: each feature has fallback behavior
- Documentation should be updated as each feature completes

---

## Quick Reference: Focus Chain Summary

```
Focus Chain: 1 → 2 → 3 → 4 → 5

[STREAMING] ──→ [RETRY] ──→ [THEME] ──→ [VERSIONING] ──→ [BATCH]
    1.1             2.1          3.1          4.1           5.1
    1.2             2.2          3.2          4.2           5.2
    1.3             2.3          3.3          4.3           5.3
    1.4             2.4          3.4          4.4           5.4
    1.5             2.5          3.5          4.5
    1.6             2.6          3.6          4.6
    1.7             2.7          3.7          4.7
    1.8             2.8          3.8
```

**Start here**: Feature 1, Subtask 1.1 (`fetchJsonStream()` utility)