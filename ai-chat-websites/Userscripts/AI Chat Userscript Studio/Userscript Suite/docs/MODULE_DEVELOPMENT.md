# Module Development Guide

Comprehensive guide for creating, testing, and maintaining modules in the AI Chat Userscript Suite.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Module Anatomy](#module-anatomy)
3. [Step-by-Step: Creating a New Module](#step-by-step-creating-a-new-module)
4. [Hub API Reference](#hub-api-reference)
5. [Settings UI Integration](#settings-ui-integration)
6. [Lifecycle Hooks](#lifecycle-hooks)
7. [Dependency Management](#dependency-management)
8. [Configuration Management](#configuration-management)
9. [Event Bus Communication](#event-bus-communication)
10. [Service Container (DI)](#service-container-di)
11. [Error Handling & Resilience](#error-handling--resilience)
12. [Performance Monitoring](#performance-monitoring)
13. [Platform Adapters](#platform-adapters)
14. [Testing](#testing)
15. [Bundling & Distribution](#bundling--distribution)
16. [Best Practices](#best-practices)
17. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The AI Chat Userscript Suite uses a **hub-and-spoke** architecture:

```
┌─────────────────────────────────────────────────┐
│                  00-hub.user.js                  │
│  ┌───────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Module    │ │ Config   │ │ EventBus       │  │
│  │ Registry  │ │ Manager  │ │ (pub/sub)      │  │
│  ├───────────┤ ├──────────┤ ├────────────────┤  │
│  │ Service   │ │ Error    │ │ Performance    │  │
│  │ Container │ │ Handler  │ │ Metrics        │  │
│  ├───────────┤ ├──────────┤ ├────────────────┤  │
│  │ Theme     │ │ Platform │ │ ModuleLoader   │  │
│  │ Manager   │ │ Adapters │ │ (DOM/URL)      │  │
│  └───────────┘ └──────────┘ └────────────────┘  │
└──────────────────────┬──────────────────────────┘
                       │ registers with
          ┌────────────┼────────────┐
          ▼            ▼            ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│ Module 01    │ │ Module 02│ │ Module NN    │
│ (automation) │ │ (clipbd) │ │ (your module)│
└──────────────┘ └──────────┘ └──────────────┘
```

- **Hub** (`00-hub.user.js`): Central orchestrator. Provides ModuleRegistry, ConfigManager, EventBus, ServiceContainer, ErrorHandler, PerformanceMetrics, ThemeManager, PlatformAdapters, and ModuleLoader.
- **Modules** (`Modules/NN-name.module.user.js`): Self-contained feature units that register with the hub. Each module is an IIFE that creates a class instance and registers it.
- **Settings UI** (`settings-ui.js`): Optional companion that provides a floating control panel for configuring modules.

---

## Module Anatomy

Every module follows this standard pattern:

```javascript
// ==UserScript==
// @name         Module Name
// @namespace    AI-Chat-Userscript-Studio
// @version      1.0.0
// @description  Brief description of what this module does
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const MODULE_ID = "NN-module-name";
  const MODULE_NAME = "Module Name";
  const MODULE_VERSION = "1.0.0";

  class ModuleName {
    constructor() {
      this.dependencies = []; // IDs of required modules, e.g. ["02-module-registry"]
      this.critical = false; // If true, hub init fails when this module fails
      this.config = {
        enabled: true,
        // Module-specific defaults here
      };
      this.state = {
        initialized: false,
      };
    }

    async init() {
      try {
        console.log(`[${MODULE_ID}] Initializing ${MODULE_NAME} v${MODULE_VERSION}`);

        this.loadConfig();
        if (!this.checkDependencies()) {
          console.warn(`[${MODULE_ID}] Dependencies not satisfied`);
          return false;
        }

        this.setup();
        this.exposeAPI();

        this.state.initialized = true;
        console.log(`[${MODULE_ID}] Initialization complete`);
        return true;
      } catch (error) {
        console.error(`[${MODULE_ID}] Init failed:`, error);
        return false;
      }
    }

    loadConfig() {
      try {
        const saved = GM_getValue
          ? GM_getValue(`${MODULE_ID}-config`, null)
          : localStorage.getItem(`${MODULE_ID}-config`);
        if (saved) {
          const parsed = typeof saved === "string" ? JSON.parse(saved) : saved;
          Object.assign(this.config, parsed);
        }
      } catch (e) {
        console.warn(`[${MODULE_ID}] Config load failed, using defaults`);
      }
    }

    saveConfig() {
      try {
        const data = JSON.stringify(this.config);
        if (GM_setValue) {
          GM_setValue(`${MODULE_ID}-config`, data);
        } else {
          localStorage.setItem(`${MODULE_ID}-config`, data);
        }
      } catch (e) {
        console.warn(`[${MODULE_ID}] Config save failed:`, e);
      }
    }

    checkDependencies() {
      if (!window.ModuleRegistry) return false;
      for (const dep of this.dependencies) {
        const mod = window.ModuleRegistry.get(dep);
        if (!mod || !mod.state?.initialized) {
          console.warn(`[${MODULE_ID}] Missing dependency: ${dep}`);
          return false;
        }
      }
      return true;
    }

    setup() {
      // Attach observers, event listeners, DOM mutations, etc.
    }

    exposeAPI() {
      // Expose public methods on window for other modules
      window[`${MODULE_ID}_api`] = {
        getConfig: () => ({ ...this.config }),
        setConfig: (cfg) => {
          Object.assign(this.config, cfg);
          this.saveConfig();
        },
        // Module-specific methods
      };
    }

    destroy() {
      this.state.initialized = false;
      // Clean up observers, timers, event listeners
      console.log(`[${MODULE_ID}] Destroyed`);
    }
  }

  // Register with the Hub
  const instance = new ModuleName();
  if (window.ModuleRegistry) {
    window.ModuleRegistry.register(instance);
  } else {
    // Fallback: wait for hub
    document.addEventListener("DOMContentLoaded", () => {
      if (window.ModuleRegistry) {
        window.ModuleRegistry.register(instance);
      }
    });
  }
})();
```

---

## Step-by-Step: Creating a New Module

### 1. Choose a Module ID and Number

Module files live in `Modules/` and follow the pattern:

```
NN-module-name.module.user.js
```

- `NN`: Two-digit number for ordering (01-99). Check `_module-registry.json` for the next available number.
- `module-name`: kebab-case descriptive name.

**Examples:**
- `42-network-optimization.module.user.js`
- `50-clipboard-manager.module.user.js`

### 2. Copy the Template

Copy `Modules/_archive/_template.module.user.js` (or use the pattern above) as your starting point.

### 3. Update Metadata Block

The `==UserScript==` metadata block at the top defines:

```javascript
// @name         Your Module Name
// @namespace    AI-Chat-Userscript-Studio
// @version      1.0.0
// @description  What your module does
// @match        *://*/*
// @grant        none
// @run-at       document-idle
```

- **@name**: Human-readable name shown in Tampermonkey.
- **@version**: Follow [semver](https://semver.org/). Independent of suite version.
- **@match**: URL patterns where the module runs. Use `*://*/*` for all sites, or restrict to specific AI platforms.
- **@grant**: Declare GM APIs needed. Start with `none` and add only what you use.
- **@require**: External libraries (e.g., CDN scripts). Use sparingly.

### 4. Implement the Class

Fill in the class with your module logic:

- **constructor()**: Set `this.dependencies`, `this.critical`, `this.config` defaults, `this.state`.
- **init()**: Load config, check deps, set up observers, expose API.
- **destroy()**: Clean up all resources (timers, observers, DOM elements).

### 5. Register with the Hub

At the bottom of your IIFE:

```javascript
const instance = new ModuleName();
if (window.ModuleRegistry) {
  window.ModuleRegistry.register(instance);
} else {
  // Defer registration until hub is ready
  const check = setInterval(() => {
    if (window.ModuleRegistry) {
      window.ModuleRegistry.register(instance);
      clearInterval(check);
    }
  }, 100);
}
```

### 6. Update the Module Registry

Add your module to `Modules/_module-registry.json`:

```json
{
  "id": "NN-module-name",
  "name": "Module Name",
  "version": "1.0.0",
  "description": "Brief description",
  "category": "your-category",
  "dependencies": [],
  "critical": false
}
```

### 7. Add Config Defaults (if needed)

If your module introduces new global config keys, add them to `ConfigManager`'s `DEFAULT_CONFIG` in `00-hub.user.js`.

### 8. Test

```bash
npm run validate
npm run test:quick
```

Then load the bundle in Tampermonkey and verify console output.

---

## Hub API Reference

### ModuleRegistry

The central registry for all modules. Exposed as `window.ModuleRegistry` (also aliased as `window.ChatGPTModules`).

```javascript
// Register a module instance
ModuleRegistry.register(instance);
// Parameters: instance must have: name, version, dependencies[], critical, init(), destroy()
// Returns: true on success, false if duplicate or invalid

// List all registered module names
ModuleRegistry.list();
// Returns: string[] of module names

// Get a module instance by name
ModuleRegistry.get(name);
// Returns: module instance or null

// Initialize all modules in dependency order
await ModuleRegistry.initializeAll();
// Returns: true on success, throws if critical module fails

// Execute all modules (calls execute() on each)
await ModuleRegistry.executeAll();
// Returns: { name, success, error? }[]

// Destroy all modules (calls destroy() on each)
ModuleRegistry.destroyAll();

// Resolve dependency order (topological sort)
ModuleRegistry.resolveDependencies();
// Returns: string[] of module names in load order
```

**Module instance requirements:**

| Property     | Type       | Required | Description                              |
|-------------|------------|----------|------------------------------------------|
| `name`      | `string`   | Yes      | Unique module name                       |
| `version`   | `string`   | Yes      | Semver string                            |
| `dependencies` | `string[]` | Yes   | Module IDs this module depends on        |
| `critical`  | `boolean`  | Yes      | If true, hub init fails on error         |
| `init()`    | `function` | Yes      | Async initialization, returns boolean    |
| `destroy()` | `function` | Yes      | Cleanup, no return value                 |
| `execute()` | `function` | No       | Called by executeAll() if present        |
| `state`     | `object`   | No       | Runtime state (e.g., `{ initialized }`)  |

### ConfigManager

Unified configuration with persistence via `GM_setValue`/`GM_getValue`. Exposed as `window.ConfigManager`.

```javascript
// Get a config value (or all config if key omitted)
ConfigManager.get(key);
// Returns: value for key, or full config object

// Set a config value (or merge object)
ConfigManager.set(key, value);
// If key is an object, merges it into config

// Get module-specific config (global + overrides merged)
ConfigManager.getConfig(moduleName);
// Returns: merged config object

// Update module-specific config
ConfigManager.updateConfig(moduleName, settings);
// Merges settings into module's override config

// Get default config
ConfigManager.getDefaultConfig();
// Returns: copy of DEFAULT_CONFIG

// Listen for config changes
ConfigManager.onChange(key, callback);
// Returns: unsubscribe function

// Reset config to defaults
ConfigManager.reset();

// Export/import config as JSON
ConfigManager.export();   // Returns: JSON string
ConfigManager.import(json); // Returns: boolean success
```

**Default config keys:**

| Key                        | Type      | Default | Description                          |
|---------------------------|-----------|---------|--------------------------------------|
| `debugMode`               | `boolean` | `false` | Enable debug logging                 |
| `theme`                   | `string`  | `system`| `light`, `dark`, or `system`         |
| `language`                | `string`  | `en`    | UI language                          |
| `enableCache`             | `boolean` | `true`  | Enable caching                       |
| `cacheExpiration`         | `number`  | `3600`  | Cache TTL in seconds                 |
| `maxRetries`              | `number`  | `3`     | Max retry attempts                   |
| `retryDelay`              | `number`  | `1000`  | Base retry delay in ms               |
| `enablePerformanceMetrics`| `boolean` | `true`  | Track performance metrics            |
| `enableErrorReporting`    | `boolean` | `true`  | Report errors to console             |
| `moduleOverrides`         | `object`  | `{}`    | Per-module config overrides          |

### EventBus

Pub/sub event system for inter-module communication. Exposed as `window.EventBus`.

```javascript
// Subscribe to an event
const unsubscribe = EventBus.on(eventName, callback);
// callback receives (payload)
// Returns: unsubscribe function

// Unsubscribe
EventBus.off(eventName, callback);

// Emit an event
EventBus.emit(eventName, payload);
// payload can be any value (object, string, etc.)

// Subscribe to one event only
EventBus.once(eventName, callback);
// Auto-unsubscribes after first emission
```

**Convention for event names:**
- Use namespaced names: `module:action`, `module:event`
- Examples: `clipboard:copy`, `config:changed`, `theme:updated`
- Prefix with module ID for module-specific events: `clipboard-manager:history-cleared`

### ServiceContainer

Simple dependency injection container. Exposed as `window.ServiceContainer`.

```javascript
// Register a service
ServiceContainer.register(name, factory, options);
// factory receives (container) and returns the service instance
// options.singleton: true (default) reuses the same instance

// Resolve a service
const service = ServiceContainer.resolve(name);
// Throws if service not registered

// Reset all singletons
ServiceContainer.reset();
```

**Example:**

```javascript
// Register
ServiceContainer.register("storage", () => ({
  get: (key) => localStorage.getItem(key),
  set: (key, val) => localStorage.setItem(key, val),
}));

// Resolve
const storage = ServiceContainer.resolve("storage");
storage.set("foo", "bar");
```

### ErrorHandler

Retry, circuit breaker, and error wrapping utilities. Exposed as `window.ErrorHandler`.

```javascript
// Retry with exponential backoff
ErrorHandler.retry(fn, options);
// options: { maxRetries, baseDelay, backoffFactor }
// Returns: result of fn, or throws after all retries exhausted

// Circuit breaker pattern
const safeFn = ErrorHandler.circuitBreaker(fn, options);
// options: { threshold: 5, timeout: 60000 }
// After threshold failures, opens circuit for timeout ms

// Wrap a function with error handler
const wrapped = ErrorHandler.wrap(fn, onError);
// onError receives (error, ...originalArgs)

// Delay helper
await ErrorHandler.delay(ms);
```

**Example:**

```javascript
const result = await ErrorHandler.retry(
  () => fetch("/api/data").then(r => r.json()),
  { maxRetries: 5, baseDelay: 200, backoffFactor: 2 }
);
```

### PerformanceMetrics

Timing and counter tracking. Exposed as `window.PerformanceMetrics`.

```javascript
// Mark a point in time
PerformanceMetrics.mark("eventName");

// Measure duration from a mark
const duration = PerformanceMetrics.measure("measureName", "startMark");
// Returns: duration in ms, pushes to measure array

// Increment a counter
PerformanceMetrics.increment("counterName", amount = 1);

// Get computed metrics (avg, min, max, p50, p95)
PerformanceMetrics.getMetrics();

// Get full snapshot
PerformanceMetrics.snapshot();
// Returns: { timestamp, counters: {}, metrics: {} }

// Reset all data
PerformanceMetrics.reset();
```

### ThemeManager

Manages light/dark/system theme. Exposed as `window.ThemeManager`.

```javascript
// Initialize (reads saved theme)
ThemeManager.init();

// Get current theme
ThemeManager.getTheme();
// Returns: "light", "dark", or "system"

// Set theme
ThemeManager.setTheme("dark");
// Persists via GM_setValue and applies

// Apply current theme to DOM
ThemeManager.apply();
// Sets data-hub-theme attribute on <html>

// Listen for theme changes
const unsubscribe = ThemeManager.onChange(callback);
// callback receives (themeName)
```

### PlatformAdapters

Platform-specific API adapters for AI chat sites. Exposed as `window.PlatformAdapters`.

```javascript
// Get current platform adapter
const adapter = PlatformAdapters.getCurrent();
// Returns: adapter or null if not on a supported site

// Send a message (platform-specific)
await adapter.sendMessage(text);

// Get last reply
const reply = await adapter.getLastReply();
```

**Supported platforms:** chatgpt, claude, poe, perplexity, gemini, copilot, mistral

### ModuleLoader

Dynamic module loading from DOM or URL. Exposed as `window.ModuleLoader`.

```javascript
// Load modules from <script data-module> tags in DOM
await ModuleLoader.loadFromDOM();
// Returns: string[] of loaded module names

// Load a module from a URL
await ModuleLoader.loadFromURL(url);
// Returns: boolean success
```

### Registration Helpers

```javascript
// Register a module with explicit options
registerHubModule({
  name: "MyModule",
  version: "1.0.0",
  instance: myInstance,
  dependencies: ["02-module-registry"],
  critical: false
});

// Create and register a standard module with minimal boilerplate
const mod = createStandardModule({
  name: "MyModule",
  version: "1.0.0",
  dependencies: [],
  critical: false,
  onInit() { /* custom init logic */ },
  onDestroy() { /* custom cleanup */ }
});
```

Both are exposed on `window`.

---

## Settings UI Integration

The `SettingsUI` class (`settings-ui.js`) provides a floating control panel. Modules can contribute settings tabs automatically.

### How It Works

When the settings panel opens, `SettingsUI.refreshTabs()` iterates over all registered modules and calls `createModuleSettings(moduleName)` for each. This method looks for a `getSettings()` method on the module instance.

### Adding Settings to Your Module

Implement a `getSettings()` method on your module class that returns an array of setting definitions:

```javascript
getSettings() {
  return [
    {
      id: "optionKey",
      label: "Human-readable label",
      type: "boolean",   // "boolean" | "text" | "number" | "select" | "color"
      default: true,
      description: "Help text shown below the setting",
    },
    {
      id: "interval",
      label: "Update interval (ms)",
      type: "number",
      default: 5000,
      min: 1000,
      max: 60000,
    },
    {
      id: "theme",
      label: "Color scheme",
      type: "select",
      options: [
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
        { value: "auto", label: "Auto" },
      ],
      default: "auto",
    },
  ];
}
```

**Setting field reference:**

| Field         | Type                   | Required | Description                              |
|---------------|------------------------|----------|------------------------------------------|
| `id`          | `string`               | Yes      | Config key (dotted path supported)       |
| `label`       | `string`               | Yes      | Display label                            |
| `type`        | `string`               | Yes      | `boolean`, `text`, `number`, `select`, `color` |
| `default`     | varies                 | Yes      | Default value                            |
| `description` | `string`               | No       | Help text                                |
| `min`         | `number`               | No       | For `number` type                        |
| `max`         | `number`               | No       | For `number` type                        |
| `step`        | `number`               | No       | For `number` type                        |
| `options`     | `{value, label}[]`     | No       | For `select` type                        |
| `placeholder` | `string`               | No       | For `text` type                          |

### Manual Settings Tab Creation

For advanced UIs, override `createSettingsContent()` on your module:

```javascript
createSettingsContent(container) {
  container.innerHTML = `
    <div class="chatgpt-hub-settings-group">
      <h3>Advanced Options</h3>
      <!-- Custom HTML -->
    </div>
  `;
  // Bind events
  container.querySelector("#my-input").addEventListener("change", (e) => {
    this.config.myOption = e.target.value;
    this.saveConfig();
  });
}
```

### Programmatic Settings Access

```javascript
// Open settings panel
settingsUI.show();

// Close settings panel
settingsUI.hide();

// Add a custom tab
settingsUI.addTab("My Tab", "my-tab-id", myContentElement);

// Activate a specific tab
settingsUI.activateTab("my-tab-id");
```

---

## Lifecycle Hooks

Modules can implement these lifecycle methods:

| Method              | Called When                          | Purpose                              |
|---------------------|--------------------------------------|--------------------------------------|
| `init()`            | Hub initialization (dependency order) | Set up module, load config, attach observers |
| `execute()`         | `ModuleRegistry.executeAll()`        | Run main logic (if separate from init) |
| `destroy()`         | Hub teardown                         | Clean up all resources               |
| `onConfigUpdate(settings)` | Config changes for this module | React to settings changes in real-time |
| `getSettings()`     | Settings UI opens                    | Return setting definitions for UI     |
| `createSettingsContent(container)` | Settings UI opens (alternative) | Render custom settings HTML |

### init() Contract

```javascript
async init() {
  // Return true on success, false on failure
  // Throw only if critical === true
  return true;
}
```

### destroy() Contract

```javascript
destroy() {
  // Must not throw
  // Clean up: clearInterval, disconnect observers, remove DOM elements
}
```

---

## Dependency Management

### Declaring Dependencies

Set `this.dependencies` in the constructor to an array of module IDs:

```javascript
this.dependencies = ["02-module-registry", "03-config-manager"];
```

The hub's `resolveDependencies()` performs a topological sort to ensure correct load order.

### Checking Dependencies at Runtime

```javascript
checkDependencies() {
  for (const dep of this.dependencies) {
    const mod = window.ModuleRegistry.get(dep);
    if (!mod || !mod.state?.initialized) {
      console.warn(`[${MODULE_ID}] Missing dependency: ${dep}`);
      return false;
    }
  }
  return true;
}
```

### Circular Dependency Detection

The hub detects circular dependencies and throws an error:

```
[Hub] Circular dependency detected: module-name
```

### Dependency Categories

| Category    | Description                              |
|-------------|------------------------------------------|
| `core`      | Infrastructure modules (registry, config, DI) |
| `ui`        | UI components (control panel, theme)     |
| `utility`   | Helper modules (clipboard, storage)      |
| `feature`   | Feature modules (automation, export)     |
| `performance` | Performance monitoring modules         |
| `security`  | Security-related modules                 |

---

## Configuration Management

### Module-Level Config

Store module-specific config using the helper methods:

```javascript
loadConfig() {
  const saved = GM_getValue
    ? GM_getValue(`${MODULE_ID}-config`, null)
    : localStorage.getItem(`${MODULE_ID}-config`);
  if (saved) {
    Object.assign(this.config, JSON.parse(saved));
  }
}

saveConfig() {
  const data = JSON.stringify(this.config);
  if (GM_setValue) {
    GM_setValue(`${MODULE_ID}-config`, data);
  } else {
    localStorage.setItem(`${MODULE_ID}-config`, data);
  }
}
```

### Hub Config Integration

For settings that should appear in the global config:

```javascript
// Read merged config (global + module overrides)
const merged = ConfigManager.getConfig("my-module-name");

// Update module-specific config
ConfigManager.updateConfig("my-module-name", { myOption: "value" });

// Listen for config changes
ConfigManager.onChange("my-module-name", (settings) => {
  Object.assign(this.config, settings);
  this.applyConfig();
});
```

### Config Validation

Validate config before applying:

```javascript
validateConfig(config) {
  if (typeof config.interval !== "number" || config.interval < 100) {
    console.warn(`[${MODULE_ID}] Invalid interval, using default`);
    config.interval = 1000;
  }
  return config;
}
```

---

## Event Bus Communication

### Emitting Events

```javascript
// From your module
EventBus.emit("my-module:data-updated", { key: "value", count: 42 });
```

### Listening to Events

```javascript
// In your module's setup()
this.unsubscribers = [];

this.unsubscribers.push(
  EventBus.on("other-module:event", (payload) => {
    // React to event
  })
);

// In destroy()
if (this.unsubscribers) {
  this.unsubscribers.forEach((unsub) => unsub());
}
```

### Common Event Names

| Event Name                    | Payload          | Description                    |
|-------------------------------|------------------|--------------------------------|
| `config:changed`              | `{ key, value }` | Global config changed          |
| `theme:updated`               | `"dark"|"light"` | Theme changed                  |
| `hub:initialized`             | `{}`             | Hub init complete              |
| `module:registered`           | `{ name }`       | New module registered          |
| `resilience:metric`           | `{ moduleName, detail }` | Retry/circuit event   |
| `{module-id}:config-changed`  | `{ settings }`   | Module config updated          |

---

## Service Container (DI)

### Registering a Service

```javascript
// In your module's init()
ServiceContainer.register("my-service", (container) => ({
  doSomething() { /* ... */ }
}), { singleton: true });
```

### Resolving a Service

```javascript
const service = ServiceContainer.resolve("my-service");
service.doSomething();
```

### When to Use Services vs. Events

| Use Service Container When...          | Use EventBus When...                  |
|----------------------------------------|---------------------------------------|
| Multiple modules need the same instance | One-way notification                  |
| You need a shared state object         | Loose coupling between modules        |
| Testing with mock dependencies         | Fire-and-forget communication         |
| Complex initialization order           | Multiple unrelated listeners          |

---

## Error Handling & Resilience

### Basic Error Handling

```javascript
async init() {
  try {
    // Risky operations
    return true;
  } catch (error) {
    console.error(`[${MODULE_ID}] Init failed:`, error);
    return false;
  }
}
```

### Retry with Exponential Backoff

```javascript
const result = await ErrorHandler.retry(
  async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },
  { maxRetries: 3, baseDelay: 1000, backoffFactor: 2 }
);
```

### Circuit Breaker

```javascript
const safeFetch = ErrorHandler.circuitBreaker(
  async (url) => {
    const res = await fetch(url);
    return res.json();
  },
  { threshold: 5, timeout: 30000 }
);

// Use it - after 5 failures, it will fast-fail for 30 seconds
const data = await safeFetch("/api/data");
```

### Error Wrapping

```javascript
const safeOperation = ErrorHandler.wrap(
  () => this.riskyOperation(),
  (error, ...args) => {
    console.error(`[${MODULE_ID}] Operation failed:`, error);
    this.metrics.increment("errors");
  }
);
```

---

## Performance Monitoring

### Mark and Measure

```javascript
PerformanceMetrics.mark("myOperationStart");
// ... do work ...
const duration = PerformanceMetrics.measure("myOperation", "myOperationStart");
console.log(`Operation took ${duration}ms`);
```

### Counters

```javascript
PerformanceMetrics.increment("apiCalls");
PerformanceMetrics.increment("errors", 2);
```

### Getting Metrics

```javascript
const metrics = PerformanceMetrics.getMetrics();
// {
//   myOperation: {
//     count: 10,
//     total: 5234,
//     avg: 523.4,
//     min: 120,
//     max: 1500,
//     p50: 480,
//     p95: 1200
//   }
// }

const snapshot = PerformanceMetrics.snapshot();
// {
//   timestamp: "2026-07-19T...",
//   counters: { apiCalls: 42, errors: 3 },
//   metrics: { ... }
// }
```

---

## Platform Adapters

### Using Platform Adapters

```javascript
const adapter = PlatformAdapters.getCurrent();
if (adapter) {
  await adapter.sendMessage("Hello, AI!");
  const reply = await adapter.getLastReply();
}
```

### Checking Current Platform

```javascript
const site = window.ChatGPTUtils?.site;
if (site) {
  console.log(`Running on: ${site.id}`); // e.g., "chatgpt", "claude"
}
```

### Platform-Specific Logic

```javascript
if (window.location.hostname.includes("chatgpt.com")) {
  // ChatGPT-specific DOM selectors
} else if (window.location.hostname.includes("claude.ai")) {
  // Claude-specific logic
}
```

---

## Testing

### Quick Test

Run the sandboxed module loader test:

```bash
npm run test:quick
```

This loads modules in a Node.js `vm` sandbox and verifies registration patterns.

### Unit Tests

Create test files in `Modules/__tests__/`:

```javascript
// Modules/__tests__/my-module.test.js
describe("MyModule", () => {
  beforeEach(() => {
    // Set up mock hub APIs
    global.ModuleRegistry = { register: jest.fn(), get: jest.fn() };
  });

  test("registers with hub", () => {
    require("../NN-my-module.module.user.js");
    expect(global.ModuleRegistry.register).toHaveBeenCalled();
  });
});
```

Run:

```bash
npm test
npm run test:coverage
```

### Manual Smoke Test

1. Build the merged bundle: `npm run bundle:merge`
2. Load `dist/ai-chat-userscript-suite.bundle.merged.user.js` into Tampermonkey
3. Open DevTools console and verify:
   - `[Hub] Registered module: YourModule v1.0.0`
   - `[YourModule] Initialization complete`
   - No errors in console

### Validation

```bash
npm run validate
```

Checks module metadata, naming conventions, and registry consistency.

---

## Bundling & Distribution

### Development Workflow

```bash
# Full verification
npm run verify

# Concatenated bundle (individual headers preserved)
npm run bundle
# Output: dist/ai-chat-userscript-suite.bundle.user.js

# Merged bundle (single header)
npm run bundle:merge
# Output: dist/ai-chat-userscript-suite.bundle.merged.user.js

# Minified bundle
npm run bundle:minify
# Output: dist/ai-chat-userscript-suite.bundle.merged.min.user.js

# Analyze bundle sizes
npm run bundle:analyze

# Clean build artifacts
npm run clean
```

### Production Build

```bash
npm run build:production
# Runs: clean -> bundle:merge -> bundle:minify
```

### Dev Server (Watch Mode)

```bash
npm run dev
# Watches for changes and rebuilds automatically

npm run dev:hot
# Hot reload support
```

---

## Best Practices

### Code Quality

- **Use `'use strict'`** at the top of your IIFE.
- **Prefer `const`/`let`** over `var`.
- **Use `===`** instead of `==`.
- **Avoid `eval()`** and `new Function()` for user input.
- **Use `textContent`** instead of `innerHTML` when possible.
- **Debounce/throttle** frequent operations (scroll, resize, input).

### Performance

- **Use `MutationObserver`** instead of polling with `setInterval`.
- **Clean up observers** in `destroy()`:
  ```javascript
  if (this.observer) {
    this.observer.disconnect();
    this.observer = null;
  }
  ```
- **Remove event listeners** in `destroy()`:
  ```javascript
  if (this.boundHandler) {
    document.removeEventListener("click", this.boundHandler);
  }
  ```
- **Clear timers** in `destroy()`:
  ```javascript
  if (this.timer) {
    clearInterval(this.timer);
    this.timer = null;
  }
  ```

### Security

- **Sanitize** any data before inserting into DOM.
- **Never trust** `GM_getValue` data - validate on load.
- **Use `@grant none`** when possible; request only the GM APIs you need.
- **Avoid `@require`** for large libraries; prefer lightweight alternatives.

### Accessibility

- Add `aria-label` attributes to custom controls.
- Support keyboard navigation (Enter/Space for buttons, Escape to close).
- Ensure color contrast meets WCAG AA standards.
- Respect `prefers-reduced-motion`.

### Module Design

- **Single responsibility**: Each module should do one thing well.
- **Graceful degradation**: Handle missing dependencies or APIs gracefully.
- **Idempotent init**: Calling `init()` multiple times should be safe.
- **Defensive programming**: Check that APIs exist before calling them.
- **Logging**: Use `console.log`/`warn`/`error` with the module ID prefix.

### Naming Conventions

| Item              | Convention                          | Example                     |
|-------------------|-------------------------------------|-----------------------------|
| Module ID         | `NN-kebab-case`                     | `42-network-optimization`   |
| Module file       | `NN-name.module.user.js`            | `42-network-optimization.module.user.js` |
| Class name        | `PascalCase`                        | `NetworkOptimization`       |
| Config key prefix | `{module-id}-config`                | `42-network-optimization-config` |
| API window key    | `{module-id}_api`                   | `42-network-optimization_api` |
| Event namespace   | `{module-id}:event-name`            | `network-optimization:cache-cleared` |

---

## Troubleshooting

### Module Doesn't Register

1. Check that `window.ModuleRegistry` exists (hub loaded first).
2. Verify the module instance has all required properties: `name`, `version`, `dependencies`, `critical`.
3. Check for duplicate registration (same `name` already registered).
4. Look for syntax errors in the IIFE.

### Module Fails to Initialize

1. Check dependency modules are loaded and initialized.
2. Verify `GM_getValue`/`GM_setValue` are granted if used.
3. Look for errors in the `init()` try-catch.
4. Check that `init()` returns `true` on success.

### Settings Not Appearing

1. Implement `getSettings()` on your module class.
2. Return valid setting definitions (see [Settings UI Integration](#settings-ui-integration)).
3. Verify the module is registered before the settings panel opens.

### Config Not Persisting

1. Check `GM_setValue`/`GM_getValue` are in `@grant`.
2. Verify `JSON.stringify`/`JSON.parse` round-trips correctly.
3. Check for storage quota issues (GM storage is limited).

### Bundle Build Fails

1. Run `npm run validate` to check for metadata issues.
2. Check for duplicate `@name` values across modules.
3. Verify all module files follow the `NN-name.module.user.js` pattern.

### Circular Dependency

The hub detects circular dependencies and logs:

```
[Hub] Circular dependency detected: module-name
```

Fix by removing or restructuring the circular dependency chain.

### Console Debugging

Enable debug mode to see detailed logs:

```javascript
ConfigManager.set("debugMode", true);
```

This enables verbose logging from the hub and modules that check this flag.

---

## Quick Reference

### File Structure

```
Userscript Suite/
├── 00-hub.user.js                    # Hub orchestrator
├── settings-ui.js                    # Settings panel
├── package.json                      # Dependencies & scripts
├── Modules/
│   ├── _module-registry.json         # Module catalog
│   ├── _archive/
│   │   └── _template.module.user.js  # Module template
│   ├── NN-name.module.user.js        # Your module
│   └── __tests__/                    # Unit tests
├── scripts/
│   ├── validate.cjs                  # Pre-flight validation
│   ├── quick-test.cjs                # Sandbox module test
│   ├── bundle.cjs                    # Concatenated bundle
│   ├── bundle-merge.cjs              # Merged bundle
│   ├── bundle-minify.cjs             # Minified bundle
│   └── dev-server.cjs                # Watch mode
├── dist/                             # Build output
└── docs/
    ├── MODULE_DEVELOPMENT.md         # This guide
    ├── hub-api-reference.md          # Hub API details
    └── settings-ui-api-reference.md  # Settings UI details
```

### Common Commands

```bash
npm run validate       # Validate modules
npm test              # Run unit tests
npm run test:quick    # Sandbox module test
npm run bundle:merge  # Build merged bundle
npm run dev           # Watch mode
npm run verify        # Full verification suite
```

### Module Checklist

- [ ] File named `NN-name.module.user.js`
- [ ] Metadata block with `@name`, `@version`, `@description`
- [ ] IIFE wrapping all code
- [ ] Class with `name`, `version`, `dependencies`, `critical`
- [ ] `init()` method returning boolean
- [ ] `destroy()` method cleaning up resources
- [ ] Registered with `ModuleRegistry.register(instance)`
- [ ] Added to `_module-registry.json`
- [ ] Config defaults defined and persisted
- [ ] `getSettings()` implemented (if configurable)
- [ ] `npm run validate` passes
- [ ] `npm run test:quick` passes
- [ ] Manual smoke test on target platform

---

**Last Updated**: 2026-07-19
**Maintainer**: AI Chat Userscript Studio Team
**License**: MIT