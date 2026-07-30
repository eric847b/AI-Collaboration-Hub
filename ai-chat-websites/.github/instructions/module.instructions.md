---
description: "Use when: editing or creating userscript module files in the Modules/ directory. Provides context on module patterns, registration, and lifecycle."
applyTo: "**/Modules/*.module.user.js"
---

# Userscript Module Instructions

When working with module files in this directory, follow these patterns:

## Required Metadata

Every module must have these properties in the constructor:

```javascript
class MyModule {
  constructor() {
    this.name = "MyModule"; // Unique identifier
    this.version = "2026.04.24.0"; // Semantic version
    this.dependencies = []; // Array of module names
    this.critical = false; // If true, errors halt execution
  }
}
```

## Lifecycle Methods

| Method                     | Required | Purpose                                         |
| -------------------------- | -------- | ----------------------------------------------- |
| `init()`                   | Yes      | Load config, setup observers, register with hub |
| `execute()`                | No       | Runtime behavior after all modules loaded       |
| `onConfigUpdate(settings)` | No       | React to settings changes                       |
| `destroy()`                | No       | Cleanup timers, observers, DOM elements         |

## Registration Pattern

```javascript
// At the end of the file
if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
  window.ModuleRegistry.register(new MyModule());
} else if (window.ChatGPTModules && typeof window.ChatGPTModules.register === "function") {
  window.ChatGPTModules.register(new MyModule());
}
```

## Configuration Access

```javascript
// In init()
this.config = window.ConfigManager?.getConfig("myModule") || defaultConfig;

// Or with defaults
const defaultConfig = { enabled: true, option: "default" };
this.config = window.ConfigManager?.getConfig("myModule") || defaultConfig;
```

## Common Patterns

- Use MutationObserver for DOM changes
- Provide chatgpt.js hook fallback before observers
- Use GM_* APIs for persistence (GM_setValue, GM_getValue)
- Register menu commands with GM_registerMenuCommand
