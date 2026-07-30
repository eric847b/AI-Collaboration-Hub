# Hub API Reference

> **File:** `00-hub.user.js` — Central orchestrator for the AI Chat Userscript Suite.
>
> This document describes every public API surface exposed by the hub, including global objects, event contracts, configuration schemas, and integration patterns for module developers.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Global Objects](#global-objects)
   - [ModuleRegistry](#moduleregistry)
   - [ConfigManager](#configmanager)
   - [ConfigValidator](#configvalidator)
   - [ServiceContainer](#servicecontainer)
   - [EventBus](#eventbus)
   - [ThemeManager](#thememanager)
   - [PerformanceMetrics](#performancemetrics)
   - [ResilienceMetrics](#resiliencemetrics)
   - [PlatformAdapters](#platformadapters)
   - [ModuleLoader](#moduleloader)
3. [Helper Functions](#helper-functions)
   - [registerHubModule()](#registerhubmodule)
   - [createStandardModule()](#createstandardmodule)
4. [Event Reference](#event-reference)
5. [Configuration Schema](#configuration-schema)
6. [Module Integration Guide](#module-integration-guide)
7. [Error Handling & Resilience](#error-handling--resilience)
8. [Performance Monitoring](#performance-monitoring)
9. [Platform Adapters](#platform-adapters)
10. [Migration Guide](#migration-guide)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    00-hub.user.js (Hub)                      │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ ModuleRegistry│  │ ConfigManager│  │ ServiceContainer │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │            │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌────────┴─────────┐  │
│  │  EventBus    │  │ConfigValidator│  │  ModuleLoader    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ ThemeManager │  │  PerfMetrics │  │ PlatformAdapters │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   Feature Modules      Settings UI         Platform APIs
   (01-*.user.js)       (settings-ui.js)    (ChatGPT, Claude, etc.)
```

The hub initializes in this order:

1. **Polyfills** — `AbortController`, `AbortSignal` (if missing)
2. **ModuleRegistry** — Core module tracking and dependency resolution
3. **ConfigManager** — Configuration persistence and validation
4. **ConfigValidator** — Schema-based configuration validation
5. **ServiceContainer** — Dependency injection and lifecycle management
6. **PerformanceMetrics** — Timing and performance tracking
7. **ResilienceMetrics** — Retry and degradation tracking
8. **EventBus** — Pub/sub event system
9. **ThemeManager** — Dark/light/system theme management
10. **PlatformAdapters** — Platform-specific API wrappers
11. **ModuleLoader** — Dynamic module loading from DOM or URL
12. **Hub Initialization** — `initializeHub()` orchestrates startup

---

## Global Objects

### ModuleRegistry

Central registry for all feature modules. Provides dependency resolution, lifecycle management, and module enumeration.

**Window path:** `window.ModuleRegistry`

#### Methods

##### `ModuleRegistry.register(name, version, instance, dependencies)`
Registers a module with the hub.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Unique module identifier (e.g., `"Utilities"`, `"Automation"`) |
| `version` | `string` | Yes | Semantic version string (e.g., `"1.0.0"`) |
| `instance` | `Object` | Yes | Module instance with `init()` and `destroy()` methods |
| `dependencies` | `string[]` | No | Array of module names this module depends on |

**Returns:** `boolean` — `true` if registration succeeded.

**Throws:** If a module with the same name is already registered.

**Example:**
```javascript
const result = ModuleRegistry.register('MyModule', '1.0.0', {
  name: 'MyModule',
  version: '1.0.0',
  init() { console.log('init'); },
  destroy() { console.log('cleanup'); }
}, ['Utilities']);
```

##### `ModuleRegistry.get(name)`
Retrieves a registered module by name.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Module name to look up |

**Returns:** `Object|null` — The module instance, or `null` if not found.

##### `ModuleRegistry.list()`
Lists all registered modules.

**Returns:** `Array<{name, version, dependencies, critical, initialized}>`

##### `ModuleRegistry.isRegistered(name)`
Checks if a module is registered.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Module name to check |

**Returns:** `boolean`

##### `ModuleRegistry.getDependencies(name)`
Returns the dependency list for a module.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Module name |

**Returns:** `string[]` — Array of dependency names.

##### `ModuleRegistry.resolveDependencies(name)`
Resolves the full dependency chain for a module (transitive).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Module name |

**Returns:** `string[]` — Flattened, deduplicated array of all transitive dependencies.

##### `ModuleRegistry.initializeAll()`
Initializes all registered modules in dependency order. Modules with unfulfilled dependencies are skipped.

**Returns:** `Promise<{initialized: string[], failed: string[], skipped: string[]}>`

##### `ModuleRegistry.destroyAll()`
Destroys all registered modules in reverse dependency order.

**Returns:** `Promise<void>`

##### `ModuleRegistry.getStatus()`
Returns a snapshot of the registry state.

**Returns:** `{total: number, initialized: number, failed: number, modules: Array}`

#### Events Emitted

| Event | Payload | Description |
|-------|---------|-------------|
| `module:registered` | `{name, version, dependencies, critical}` | Fired when a module is registered |
| `module:initialized` | `{name, version}` | Fired when a module initializes successfully |
| `module:failed` | `{name, error}` | Fired when a module fails to initialize |
| `module:destroyed` | `{name}` | Fired when a module is destroyed |

---

### ConfigManager

Centralized configuration management with persistence via `GM_setValue`/`GM_getValue`.

**Window path:** `window.ConfigManager`

#### Methods

##### `ConfigManager.get(key)`
Retrieves a configuration value.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | `string` | Yes | Configuration key |

**Returns:** `*` — The stored value, or `undefined` if not set.

##### `ConfigManager.set(key, value)`
Sets a configuration value and persists it.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | `string` | Yes | Configuration key |
| `value` | `*` | Yes | Value to store |

**Returns:** `boolean` — `true` if the value was saved.

##### `ConfigManager.getAll()`
Returns a copy of all configuration values.

**Returns:** `Object`

##### `ConfigManager.getConfig(moduleName)`
Returns the configuration object for a specific module.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `moduleName` | `string` | Yes | Module name |

**Returns:** `Object` — Module-specific configuration.

##### `ConfigManager.updateConfig(moduleName, updates)`
Merges updates into a module's configuration.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `moduleName` | `string` | Yes | Module name |
| `updates` | `Object` | Yes | Key/value pairs to merge |

**Returns:** `boolean` — `true` if the update succeeded.

##### `ConfigManager.reset(key)`
Resets a configuration key to its default value.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | `string` | Yes | Configuration key |

**Returns:** `boolean`

##### `ConfigManager.resetAll()`
Resets all configuration to defaults.

**Returns:** `boolean`

##### `ConfigManager.export()`
Exports all configuration as a JSON-serializable object.

**Returns:** `Object`

##### `ConfigManager.import(data)`
Imports configuration from a JSON object.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | `Object` | Yes | Configuration data to import |

**Returns:** `boolean` — `true` if import succeeded.

##### `ConfigManager.onChange(callback)`
Subscribes to configuration changes.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `callback` | `Function(key, value)` | Yes | Called when any config value changes |

**Returns:** `Function` — Unsubscribe function.

#### Events Emitted

| Event | Payload | Description |
|-------|---------|-------------|
| `config:changed` | `{key, value}` | Fired when a configuration value changes |
| `config:imported` | `{count}` | Fired after configuration import |
| `config:reset` | `{key}` | Fired when a config key is reset |

---

### ConfigValidator

Schema-based configuration validation. Ensures configuration values conform to expected types and constraints.

**Window path:** `window.ConfigValidator`

#### Methods

##### `ConfigValidator.validate(schema, config)`
Validates a configuration object against a schema.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `schema` | `Object` | Yes | Validation schema (see below) |
| `config` | `Object` | Yes | Configuration to validate |

**Returns:** `{valid: boolean, errors: string[]}`

**Schema format:**
```javascript
{
  keyName: {
    type: 'string',       // 'string' | 'number' | 'boolean' | 'array' | 'object'
    required: true,        // boolean
    min: 0,                // for numbers
    max: 100,              // for numbers
    pattern: /^[a-z]+$/,   // for strings
    enum: ['a', 'b', 'c'], // allowed values
    default: 'value'       // default if not provided
  }
}
```

##### `ConfigValidator.registerSchema(moduleName, schema)`
Registers a validation schema for a module.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `moduleName` | `string` | Yes | Module name |
| `schema` | `Object` | Yes | Validation schema |

**Returns:** `boolean`

##### `ConfigValidator.getSchema(moduleName)`
Retrieves the registered schema for a module.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `moduleName` | `string` | Yes | Module name |

**Returns:** `Object|null`

##### `ConfigValidator.validateModule(moduleName)`
Validates a module's current configuration against its registered schema.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `moduleName` | `string` | Yes | Module name |

**Returns:** `{valid: boolean, errors: string[]}`

---

### ServiceContainer

Dependency injection container with lifecycle management. Manages service instances, their dependencies, and lifecycle hooks.

**Window path:** `window.ServiceContainer`

#### Methods

##### `ServiceContainer.register(name, factory, dependencies)`
Registers a service factory.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Service name |
| `factory` | `Function` | Yes | Factory function that returns a service instance |
| `dependencies` | `string[]` | No | Array of service names this service depends on |

**Returns:** `boolean`

##### `ServiceContainer.get(name)`
Retrieves a service instance (creates it if not yet instantiated).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Service name |

**Returns:** `*` — The service instance.

##### `ServiceContainer.has(name)`
Checks if a service is registered.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Service name |

**Returns:** `boolean`

##### `ServiceContainer.list()`
Lists all registered services.

**Returns:** `string[]`

##### `ServiceContainer.getMetrics(name)`
Returns performance metrics for a specific service.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Service name |

**Returns:** `Object` — Metrics including initialization time, call count, etc.

##### `ServiceContainer.destroy(name)`
Destroys a service instance and removes it from the container.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Service name |

**Returns:** `boolean`

##### `ServiceContainer.destroyAll()`
Destroys all registered services.

**Returns:** `Promise<void>`

---

### EventBus

Typed pub/sub event system for decoupled communication between hub components and modules.

**Window path:** `window.EventBus`

#### Methods

##### `EventBus.on(event, callback)`
Subscribes to an event.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `event` | `string` | Yes | Event name |
| `callback` | `Function(payload)` | Yes | Event handler |

**Returns:** `Function` — Unsubscribe function (call to remove listener).

##### `EventBus.off(event, callback)`
Unsubscribes from an event.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `event` | `string` | Yes | Event name |
| `callback` | `Function` | Yes | Previously registered callback |

##### `EventBus.emit(event, payload)`
Emits an event to all subscribers.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `event` | `string` | Yes | Event name |
| `payload` | `*` | No | Data to pass to handlers |

##### `EventBus.once(event, callback)`
Subscribes to an event for a single invocation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `event` | `string` | Yes | Event name |
| `callback` | `Function(payload)` | Yes | One-time event handler |

**Returns:** `Function` — Unsubscribe function.

---

### ThemeManager

Manages dark/light/system theme with automatic detection and persistence.

**Window path:** `window.ThemeManager`

#### Methods

##### `ThemeManager.init()`
Initializes the theme manager. Reads persisted theme preference and applies it.

##### `ThemeManager.getTheme()`
Returns the current theme setting.

**Returns:** `'dark' | 'light' | 'system'`

##### `ThemeManager.setTheme(theme)`
Sets the theme and persists the preference.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `theme` | `string` | Yes | `'dark'`, `'light'`, or `'system'` |

##### `ThemeManager.onChange(callback)`
Subscribes to theme changes.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `callback` | `Function(theme)` | Yes | Called when theme changes |

**Returns:** `Function` — Unsubscribe function.

#### DOM Contract

The theme manager sets `data-hub-theme` attribute on `<html>`:

- `data-hub-theme="dark"` — Dark mode active
- `data-hub-theme="light"` — Light mode active

CSS can target this attribute:
```css
[data-hub-theme="dark"] .my-element {
  background: #1a1a2e;
  color: #e0e0e0;
}
```

#### Events Emitted

| Event | Payload | Description |
|-------|---------|-------------|
| `theme:changed` | `'dark' \| 'light' \| 'system'` | Fired when theme changes |

---

### PerformanceMetrics

High-resolution performance timing and metrics collection.

**Window path:** `window.PerformanceMetrics`

#### Methods

##### `PerformanceMetrics.mark(name)`
Creates a performance mark.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Mark name |

##### `PerformanceMetrics.measure(name, startMark, endMark)`
Measures the duration between two marks.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Measure name |
| `startMark` | `string` | Yes | Starting mark name |
| `endMark` | `string` | No | Ending mark name (defaults to now) |

**Returns:** `number` — Duration in milliseconds.

##### `PerformanceMetrics.getMeasures()`
Returns all recorded measures.

**Returns:** `Array<{name, duration, startTime}>`

##### `PerformanceMetrics.getMetrics()`
Returns aggregated metrics.

**Returns:** `Object` — Summary statistics.

##### `PerformanceMetrics.snapshot()`
Takes a performance snapshot.

**Returns:** `{timestamp, counters, metrics}`

##### `PerformanceMetrics.reset()`
Clears all marks, measures, and counters.

---

### ResilienceMetrics

Tracks retry attempts, degradation events, and recovery operations across modules.

**Window path:** `window.ResilienceMetrics`

#### Methods

##### `ResilienceMetrics.record(event)`
Records a resilience event.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `event` | `Object` | Yes | Event data |
| `event.timestamp` | `number` | No | Event timestamp (defaults to `Date.now()`) |
| `event.moduleName` | `string` | Yes | Module that experienced the event |
| `event.detail.attempt` | `number` | No | Retry attempt number |
| `event.detail.maxRetries` | `number` | No | Maximum retries configured |
| `event.detail.delayMs` | `number` | No | Delay before this attempt |
| `event.detail.degraded` | `boolean` | No | Whether the module entered degraded mode |

##### `ResilienceMetrics.getSummary()`
Returns aggregated resilience summary.

**Returns:** `Object` — Per-module summary with `retries`, `successes`, `failures`, `degraded`, `totalDelayMs`, `avgDelayMs`.

##### `ResilienceMetrics.getEvents(moduleName)`
Returns recent resilience events.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `moduleName` | `string` | No | Filter by module (returns last 200 events if omitted) |

**Returns:** `Array` — Recent events.

##### `ResilienceMetrics.reset()`
Clears all events and summaries.

#### Events Consumed

| Event | Source | Description |
|-------|--------|-------------|
| `resilience:metric` | `EventBus` | Records a resilience metric event |
| `HubResponse` (DOM) | CustomEvent | Records resilience metrics from DOM events |

---

### PlatformAdapters

Platform-specific API wrappers for sending messages and retrieving replies across supported AI chat platforms.

**Window path:** `window.PlatformAdapters`

#### Methods

##### `PlatformAdapters.chatgpt.sendMessage(text)`
Sends a message on ChatGPT.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | `string` | Yes | Message text to send |

**Returns:** `Promise<*>`

**Throws:** If the ChatGPT adapter is not available.

##### `PlatformAdapters.chatgpt.getLastReply()`
Retrieves the last reply on ChatGPT.

**Returns:** `Promise<string>`

##### `PlatformAdapters.claude.sendMessage(text)`
Sends a message on Claude.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | `string` | Yes | Message text to send |

**Returns:** `Promise<*>`

**Throws:** If the Claude adapter is not available.

##### `PlatformAdapters.claude.getLastReply()`
Retrieves the last reply on Claude.

**Returns:** `Promise<string>`

##### `PlatformAdapters.getCurrent()`
Detects the current platform and returns the appropriate adapter.

**Returns:** `Object|null` — The platform adapter, or `null` if the platform is not recognized.

**Supported platform mapping:**

| Site ID | Adapter Used |
|---------|-------------|
| `chatgpt` | `PlatformAdapters.chatgpt` |
| `claude` | `PlatformAdapters.claude` |
| `poe` | `PlatformAdapters.chatgpt` |
| `perplexity` | `PlatformAdapters.chatgpt` |
| `gemini` | `PlatformAdapters.chatgpt` |
| `copilot` | `PlatformAdapters.chatgpt` |
| `mistral` | `PlatformAdapters.chatgpt` |

---

### ModuleLoader

Dynamic module loading from DOM `<script>` tags or external URLs.

**Window path:** `window.ModuleLoader`

#### Methods

##### `ModuleLoader.loadFromDOM()`
Scans the DOM for `<script data-module>` elements and executes their content as modules.

**Returns:** `Promise<Array>` — List of registered modules.

##### `ModuleLoader.loadFromURL(url)`
Fetches and executes a module from a URL.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | `string` | Yes | URL to fetch the module from |

**Returns:** `Promise<boolean>` — `true` if the module loaded successfully.

---

## Helper Functions

### registerHubModule()

Convenience function for registering a module with the `ModuleRegistry`. Accepts either a pre-constructed instance or a factory function.

**Window path:** `window.registerHubModule`

#### Signature

```javascript
registerHubModule(options)
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `options.name` | `string` | No | From instance | Module name |
| `options.version` | `string` | No | `'0.0.0'` | Module version |
| `options.instance` | `Object` | No* | — | Pre-constructed module instance |
| `options.factory` | `Function` | No* | — | Factory function returning an instance |
| `options.dependencies` | `string[]` | No | From instance | Module dependencies |
| `options.critical` | `boolean` | No | `false` | Whether the module is critical |

*\* Either `instance` or `factory` must be provided.*

#### Returns

`boolean` — `true` if registration succeeded.

#### Example

```javascript
// With instance
registerHubModule({
  name: 'MyModule',
  version: '1.0.0',
  instance: { init() {}, destroy() {} },
  dependencies: ['Utilities'],
  critical: false
});

// With factory
registerHubModule({
  name: 'MyModule',
  factory: () => new MyModule(),
  dependencies: ['Utilities']
});
```

---

### createStandardModule()

Creates a standard module object with default `init()` and `destroy()` methods, then registers it with the hub.

**Window path:** `window.createStandardModule`

#### Signature

```javascript
createStandardModule(params)
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `params.name` | `string` | No | `'UnnamedModule'` | Module name |
| `params.version` | `string` | No | `'0.0.0'` | Module version |
| `params.dependencies` | `string[]` | No | `[]` | Module dependencies |
| `params.critical` | `boolean` | No | `false` | Whether the module is critical |
| `params.state` | `Object` | No | `{ initialized: false }` | Initial state |
| `params.onInit` | `Function` | No | — | Custom initialization logic |
| `params.onDestroy` | `Function` | No | — | Custom destruction logic |

#### Returns

`Object` — The created module instance (also automatically registered).

#### Example

```javascript
const myModule = createStandardModule({
  name: 'MyFeature',
  version: '1.0.0',
  dependencies: ['Utilities', 'ConfigManager'],
  critical: false,
  onInit() {
    console.log('MyFeature initialized');
    // Custom setup logic
  },
  onDestroy() {
    console.log('MyFeature destroyed');
    // Custom cleanup logic
  }
});
```

---

## Event Reference

### Hub Events

| Event | Emitter | Payload | Description |
|-------|---------|---------|-------------|
| `module:registered` | ModuleRegistry | `{name, version, dependencies, critical}` | Module registered |
| `module:initialized` | ModuleRegistry | `{name, version}` | Module initialized |
| `module:failed` | ModuleRegistry | `{name, error}` | Module initialization failed |
| `module:destroyed` | ModuleRegistry | `{name}` | Module destroyed |
| `config:changed` | ConfigManager | `{key, value}` | Config value changed |
| `config:imported` | ConfigManager | `{count}` | Config imported |
| `config:reset` | ConfigManager | `{key}` | Config key reset |
| `theme:changed` | ThemeManager | `'dark' \| 'light' \| 'system'` | Theme changed |
| `resilience:metric` | EventBus | `{moduleName, detail}` | Resilience event recorded |

### DOM Events

The hub listens for and dispatches CustomEvents on `window`:

| Event | Direction | Detail | Description |
|-------|-----------|--------|-------------|
| `HubResponse` | Inbound | `{type, moduleName, detail}` | Resilience metrics from external sources |

### Subscribing to Events

```javascript
// Via EventBus
const unsub = EventBus.on('module:initialized', ({ name }) => {
  console.log(`Module ${name} initialized`);
});

// Later: unsubscribe
unsub();
```

---

## Configuration Schema

### Default Configuration

```javascript
{
  debugMode: false,
  theme: 'system',
  language: 'en',
  enableCache: true,
  cacheExpiration: 3600,
  maxRetries: 3,
  retryDelay: 1000,
  enablePerformanceMetrics: true
}
```

### Configuration Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `debugMode` | `boolean` | `false` | Enable debug logging |
| `theme` | `string` | `'system'` | UI theme (`'dark'`, `'light'`, `'system'`) |
| `language` | `string` | `'en'` | Interface language |
| `enableCache` | `boolean` | `true` | Enable configuration caching |
| `cacheExpiration` | `number` | `3600` | Cache TTL in seconds |
| `maxRetries` | `number` | `3` | Maximum retry attempts for operations |
| `retryDelay` | `number` | `1000` | Base retry delay in milliseconds |
| `enablePerformanceMetrics` | `boolean` | `true` | Enable performance tracking |

### Module Configuration

Modules can store their own configuration under a namespaced key:

```javascript
// Get module config
const config = ConfigManager.getConfig('MyModule');

// Update module config
ConfigManager.updateConfig('MyModule', {
  enabled: true,
  threshold: 0.8
});
```

---

## Module Integration Guide

### Creating a Module

#### Method 1: Using `createStandardModule()` (Recommended)

```javascript
(function() {
  'use strict';

  createStandardModule({
    name: 'MyFeature',
    version: '1.0.0',
    dependencies: ['Utilities'],
    critical: false,
    onInit() {
      // Your initialization code
      this.setupObservers();
    },
    onDestroy() {
      // Your cleanup code
      this.teardownObservers();
    }
  });
})();
```

#### Method 2: Using `registerHubModule()`

```javascript
(function() {
  'use strict';

  class MyFeature {
    constructor() {
      this.name = 'MyFeature';
      this.version = '1.0.0';
      this.dependencies = ['Utilities'];
      this.critical = false;
    }

    init() {
      console.log('MyFeature initialized');
      return true;
    }

    destroy() {
      console.log('MyFeature destroyed');
    }
  }

  registerHubModule({
    instance: new MyFeature()
  });
})();
```

#### Method 3: Direct ModuleRegistry Registration

```javascript
(function() {
  'use strict';

  const instance = {
    name: 'MyFeature',
    version: '1.0.0',
    dependencies: ['Utilities'],
    critical: false,
    init() { return true; },
    destroy() {}
  };

  if (window.ModuleRegistry) {
    ModuleRegistry.register(instance.name, instance.version, instance, instance.dependencies);
  }
})();
```

### Module Lifecycle

```
Registered ──► Initialized ──► Active ──► Destroyed
     │              │                       │
     └── failed ────┘                       │
                                            └── removed from registry
```

1. **Registration** — Module is added to the registry with its dependencies
2. **Initialization** — `init()` is called after all dependencies are resolved
3. **Active** — Module performs its functions
4. **Destruction** — `destroy()` is called during cleanup

### Best Practices

1. **Always declare dependencies** — List all modules your module depends on in the `dependencies` array
2. **Implement `init()` and `destroy()`** — These are required for proper lifecycle management
3. **Use `EventBus` for cross-module communication** — Avoid direct coupling between modules
4. **Store module config via `ConfigManager`** — Use `getConfig()`/`updateConfig()` for persistent settings
5. **Handle errors gracefully** — Wrap initialization code in try/catch
6. **Clean up on destroy** — Remove event listeners, disconnect observers, clear timers
7. **Use `PerformanceMetrics` for timing** — Mark and measure performance-critical operations
8. **Use `ResilienceMetrics` for retry tracking** — Record retry attempts and degradation events

---

## Error Handling & Resilience

### Retry with Exponential Backoff

The hub's error handler (available via `window.ErrorHandler` in modules) provides retry logic:

```javascript
// Retry with exponential backoff
const result = await ErrorHandler.retry(async () => {
  return await fetchSomeData();
}, {
  maxRetries: 3,
  baseDelay: 1000,
  backoffFactor: 2
});
```

### Circuit Breaker Pattern

```javascript
const protectedFn = ErrorHandler.circuitBreaker(async () => {
  return await externalService.call();
}, {
  threshold: 5,     // Failures before opening circuit
  timeout: 60000    // Milliseconds before half-open
});
```

### Recording Resilience Events

```javascript
// Via EventBus
EventBus.emit('resilience:metric', {
  moduleName: 'MyModule',
  detail: {
    attempt: 2,
    maxRetries: 3,
    delayMs: 2000,
    degraded: false
  }
});

// Via DOM event
window.dispatchEvent(new CustomEvent('HubResponse', {
  detail: {
    type: 'resilienceMetric',
    moduleName: 'MyModule',
    detail: { attempt: 1, maxRetries: 3, delayMs: 1000, degraded: false }
  }
}));
```

---

## Performance Monitoring

### Marking and Measuring

```javascript
// Mark the start
PerformanceMetrics.mark('myOperationStart');

// ... perform operation ...

// Measure duration
const duration = PerformanceMetrics.measure('myOperation', 'myOperationStart');
console.log(`Operation took ${duration}ms`);
```

### Taking Snapshots

```javascript
const snapshot = PerformanceMetrics.snapshot();
// {
//   timestamp: '2026-07-19T...',
//   counters: { ... },
//   metrics: { ... }
// }
```

### Viewing All Measures

```javascript
const measures = PerformanceMetrics.getMeasures();
measures.forEach(m => {
  console.log(`${m.name}: ${m.duration}ms`);
});
```

---

## Platform Adapters

### Using Adapters

```javascript
// Get the current platform adapter
const adapter = PlatformAdapters.getCurrent();
if (adapter) {
  await adapter.sendMessage('Hello!');
  const reply = await adapter.getLastReply();
}
```

### Platform Detection

The hub detects the current platform via `window.ChatGPTUtils?.site`:

```javascript
const site = window.ChatGPTUtils?.site;
if (site) {
  console.log(`Current platform: ${site.id}`);
}
```

### Adding a New Platform Adapter

```javascript
// Add a new platform
PlatformAdapters.myPlatform = {
  async sendMessage(text) {
    // Platform-specific implementation
  },
  async getLastReply() {
    // Platform-specific implementation
  }
};

// Update the platform mapping
const originalGetCurrent = PlatformAdapters.getCurrent.bind(PlatformAdapters);
PlatformAdapters.getCurrent = function() {
  const site = window.ChatGPTUtils?.site;
  if (site?.id === 'myPlatform') return this.myPlatform;
  return originalGetCurrent();
};
```

---

## Migration Guide

### Legacy → Modern Module Registration

**Legacy (deprecated):**
```javascript
window.ChatGPTModules.register(name, version, instance);
```

**Modern:**
```javascript
ModuleRegistry.register(name, version, instance, dependencies);
// or
registerHubModule({ instance });
// or
createStandardModule({ name, version, dependencies });
```

### Legacy → Modern Event System

**Legacy (deprecated):**
```javascript
window.addEventListener('chatgpt:event', handler);
```

**Modern:**
```javascript
EventBus.on('chatgpt:event', handler);
```

### Legacy → Modern Configuration

**Legacy (deprecated):**
```javascript
GM_getValue('key');
GM_setValue('key', value);
```

**Modern:**
```javascript
ConfigManager.get('key');
ConfigManager.set('key', value);
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-19 | Initial comprehensive API reference |

---

*Generated from `00-hub.user.js` — For questions or updates, refer to the source file.*