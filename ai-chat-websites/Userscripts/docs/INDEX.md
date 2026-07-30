# Unified AI Assistant Suite — Documentation

**Version:** 1.9.0 (20 modules, 195 KB)
**Status:** v2.0.0 preparation

## Quick Start

1. Install the userscript via Greasemonkey/Tampermonkey/Violentmonkey
2. Open any AI chat website (ChatGPT, Claude, Gemini, etc.)
3. Click the floating action button to open the suite
4. Configure your AI provider API key in Settings
5. Start generating scripts!

## Architecture

```
┌─────────────────────────────────────────────┐
│                  UI Layer                    │
│  ui.js · theme.js · i18n.js                 │
├─────────────────────────────────────────────┤
│              Feature Modules                 │
│  templates.js · context.js · validator.js   │
│  autoupdate.js · debugger.js · analytics.js │
│  sync.js · performance.js                   │
├─────────────────────────────────────────────┤
│              Plugin System                   │
│  plugin-api.js · plugins/*.plugin.js        │
├─────────────────────────────────────────────┤
│              Core Modules                    │
│  config.js · state.js · utilities.js        │
│  storage.js · providers.js · auth.js        │
│  versioning.js · index.js                   │
└─────────────────────────────────────────────┘
```

## Module Reference

### Core Modules

| Module | File | Description |
|--------|------|-------------|
| Config | config.js | Application configuration constants |
| State | state.js | Reactive state management |
| Utilities | utilities.js | Helper functions (sanitize, fetch, debug) |
| Storage | storage.js | GM_storage wrapper with fallback |
| Providers | providers.js | AI provider integrations (OpenAI, Anthropic, Gemini, Ollama) |
| Auth | auth.js | Authentication and security |
| Versioning | versioning.js | Script version management |
| Module Loader | index.js | Dynamic module loading system |

### Feature Modules (v1.4.0+)

| Module | Version | File | Description |
|--------|---------|------|-------------|
| Template Gallery | v1.4.0 | templates.js | 10 built-in templates, CRUD, search, import/export |
| Context Analysis | v1.5.0 | context.js | Page content extraction, form detection, prompt enhancement |
| Auto-Update | v1.5.0 | autoupdate.js | GitHub releases check, 3-way merge, notifications |
| Validator | v1.5.0 | validator.js | OWASP security linter, best practices, complexity metrics |
| Plugin API | v1.6.0 | plugin-api.js | Plugin manifest, sandbox, hooks, permissions |
| Debugger | v1.7.0 | debugger.js | Console intercept, network tracing, profiling |
| Sync | v1.7.0 | sync.js | GitHub Gist sync, JSON export/import |
| Analytics | v1.7.0 | analytics.js | Usage tracking, provider rankings, time saved |
| i18n | v1.8.0 | i18n.js | Multi-language (EN/ES/ZH/JA), RTL support |
| Performance | v1.9.0 | performance.js | Lazy loading, RAF, debounce/throttle |

## Plugin Development

### Manifest Format

```javascript
const manifest = {
    id: 'my-plugin',           // Unique ID
    name: 'My Plugin',         // Display name
    version: '1.0.0',          // Semantic version
    description: '...',        // Description
    author: 'You',             // Author name
    permissions: ['storage'],  // Required permissions
    dependencies: [],          // Plugin dependencies
    hooks: ['onInit']          // Lifecycle hooks
};
```

### Available Hooks

| Hook | Arguments | Description |
|------|-----------|-------------|
| onInit | none | Called when plugin is loaded |
| onScriptGenerated | script | After a script is generated |
| onScriptSaved | script | After a script is saved |
| onGenerationComplete | event | After generation completes |
| onError | error | When an error occurs |
| onUpdateAvailable | update | When an update is available |
| onBeforeUpdate | none | Before suite update |
| onScriptGeneration | context | During script generation |

### Permissions

| Permission | APIs Available |
|------------|---------------|
| storage | GM_getValue, GM_setValue, GM_deleteValue |
| network | GM_xmlhttpRequest, fetch |
| dom | document.querySelector, document.getElementById |
| ui | GM_notification, GM_setClipboard |
| tabs | GM_openInTab, GM_getTab, GM_saveTab |

## Example Plugins

The following plugins are included in `Userscripts/plugins/`:

1. **Analytics Dashboard** — Visual generation statistics dashboard
2. **Backup Manager** — Automated backup/restore with scheduling
3. **Snippets Library** — Reusable code snippets with one-click insert
4. **Export Tools** — Export to JSON, Markdown, HTML, ZIP
5. **Notification Center** — Centralized toast/desktop notifications

## API Reference

### Window.UnifiedSuite

The global namespace for all modules:

```javascript
window.UnifiedSuite = {
    CONFIG,           // Configuration
    state,            // State management
    debugLog,         // Debug logging
    sanitizeText,     // Text sanitization
    
    // Modules
    storage,          // Storage operations
    providers,        // AI providers
    templates,        // Template gallery
    context,          // Context analysis
    autoupdate,       // Auto-update
    validator,        // Security linter
    pluginAPI,        // Plugin system
    i18n,             // Internationalization
    performance,      // Performance optimization
    debugger,         // Debugging tools
    sync,             // GitHub Gist sync
    analytics,        // Usage analytics
    ui,               // UI rendering
    theme,            // Theme management
    versioning,       // Script versioning
    auth,             // Authentication
    moduleSystem      // Module loader
};
```

## Build & Development

```bash
# Build single-file userscript
node scripts/build-userscript.js

# Validate all modules
node scripts/validate-modules.js

# Run tests
npx mocha tests/**/*.test.js

# Full CI pipeline
node scripts/build-userscript.js && node scripts/validate-modules.js
```

## Roadmap

See [next_year_roadmap.md](../next_year_roadmap.md) for the complete development roadmap through July 2027.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `node scripts/build-userscript.js && node scripts/validate-modules.js`
5. Submit a pull request

## License

MIT License — see LICENSE file for details.