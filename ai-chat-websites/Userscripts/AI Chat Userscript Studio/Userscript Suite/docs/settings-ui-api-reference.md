# Settings UI API Reference

> **File:** `settings-ui.js` — Unified settings panel for the AI Chat Userscript Suite.
>
> This document describes the `SettingsUI` class, its public API, CSS contract, integration patterns, and extension points for module developers.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [SettingsUI Class](#settingsui-class)
   - [Constructor](#constructor)
   - [Public Methods](#public-methods)
   - [Internal Methods](#internal-methods)
3. [CSS Contract](#css-contract)
   - [Class Reference](#class-reference)
   - [Dark Theme Support](#dark-theme-support)
4. [DOM Structure](#dom-structure)
5. [Integration Guide](#integration-guide)
   - [Basic Integration](#basic-integration)
   - [Hub Integration](#hub-integration)
   - [Module Settings](#module-settings)
6. [Extending the Settings UI](#extending-the-settings-ui)
   - [Adding Custom Tabs](#adding-custom-tabs)
   - [Custom Setting Controls](#custom-setting-controls)
7. [Event Contract](#event-contract)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SettingsUI Instance                        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    Panel (div)                        │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  Header: "ChatGPT Hub Settings"    [×]         │  │   │
│  │  ├────────────────────────────────────────────────┤  │   │
│  │  │  Tabs: [Hub] [Module1] [Module2] [Module3]     │  │   │
│  │  ├────────────────────────────────────────────────┤  │   │
│  │  │  Content:                                       │  │   │
│  │  │  ┌──────────────────────────────────────────┐  │  │   │
│  │  │  │  Section (active tab)                     │  │  │   │
│  │  │  │  ┌────────────────────────────────────┐  │  │  │   │
│  │  │  │  │  Group: "General Settings"          │  │  │  │   │
│  │  │  │  │  ├─ Label: [input]                  │  │  │  │   │
│  │  │  │  │  └─ Label: [input]                  │  │  │  │   │
│  │  │  │  └────────────────────────────────────┘  │  │  │   │
│  │  │  └──────────────────────────────────────────┘  │  │   │
│  │  ├────────────────────────────────────────────────┤  │   │
│  │  │  Footer: [Cancel] [Reset] [Save]               │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  State: isVisible (boolean), tabs (string[])                │
└─────────────────────────────────────────────────────────────┘
```

The Settings UI is a modal dialog that provides a tabbed interface for configuring the hub and all registered modules. It is designed to be instantiated by the hub and populated dynamically based on registered modules.

---

## SettingsUI Class

**Window path:** `window.SettingsUI` (the class itself, not an instance)

### Constructor

```javascript
new SettingsUI(configManager)
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `configManager` | `ConfigManager` | Yes | Reference to the hub's `ConfigManager` instance for reading/writing settings |

**Example:**
```javascript
const settingsUI = new SettingsUI(window.ConfigManager);
settingsUI.init();
```

### Public Methods

#### `init()`

Initializes the settings UI by creating styles, building the panel, and registering Tampermonkey menu commands.

**Returns:** `void`

**Called during:** Hub initialization, after `ConfigManager` is available.

**Example:**
```javascript
settingsUI.init();
```

---

#### `show()`

Displays the settings panel. Refreshes all tabs to reflect the current module state before showing.

**Returns:** `void`

**Triggers:**
- `refreshTabs()` — Rebuilds all tab content from current module registrations
- Sets `this.isVisible = true`
- Sets panel `display` to `'flex'`

**Example:**
```javascript
settingsUI.show();
```

---

#### `hide()`

Hides the settings panel.

**Returns:** `void`

**Triggers:**
- Sets `this.isVisible = false`
- Sets panel `display` to `'none'`

**Example:**
```javascript
settingsUI.hide();
```

---

### Internal Methods

These methods are used internally but may be useful for advanced integration or debugging.

#### `createStyles()`

Creates and injects a `<style>` element into `document.head` with all CSS classes for the settings UI. Includes both light and dark theme styles.

**Returns:** `void`

**CSS classes created:** See [CSS Contract](#css-contract).

---

#### `createPanel()`

Builds the complete settings panel DOM structure and appends it to `document.body`. The panel is initially hidden (`display: none`).

**Returns:** `void`

**DOM structure created:**
```
div.chatgpt-hub-settings (initially hidden)
├── div.chatgpt-hub-settings-header
│   ├── span ("ChatGPT Hub Settings")
│   └── button.chatgpt-hub-settings-close (×)
├── div.chatgpt-hub-settings-tabs
├── div.chatgpt-hub-settings-content
└── div.chatgpt-hub-settings-footer
    ├── button.chatgpt-hub-settings-cancel
    ├── button.chatgpt-hub-settings-reset
    └── button.chatgpt-hub-settings-save
```

**Event listeners attached:**
- Close button → `hide()`
- Cancel button → `hide()`
- Reset button → `resetSettings()`
- Save button → `saveSettings()`

---

#### `registerCommands()`

Registers a Tampermonkey menu command (`GM_registerMenuCommand`) to open the settings panel. Only executes if `GM_registerMenuCommand` is available.

**Returns:** `void`

**Menu command:** `"ChatGPT Hub Settings"` → calls `show()`

---

#### `refreshTabs()`

Rebuilds all tabs and their content from scratch. Clears existing tabs, then:
1. Adds a "Hub" tab with hub-level settings
2. Iterates over `window.ChatGPTModules.list()` to add a tab per module
3. Activates the first tab

**Returns:** `void`

**Called by:** `show()` every time the panel opens.

---

#### `addTab(label, id, content)`

Adds a single tab to the settings panel.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `label` | `string` | Yes | Display text for the tab button |
| `id` | `string` | Yes | Unique identifier for the tab (used in `data-tab-id`) |
| `content` | `HTMLElement` | Yes | DOM element to display as the tab's content |

**Returns:** `void`

**Side effects:**
- Creates a tab button in `.chatgpt-hub-settings-tabs`
- Creates a content section in `.chatgpt-hub-settings-content`
- Adds `id` to `this.tabs` array
- Attaches click handler to activate the tab

---

#### `activateTab(id)`

Activates a specific tab by ID, deactivating all others.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Tab ID to activate |

**Returns:** `void`

**Behavior:**
- Removes `active` class from all tab buttons and sections
- Adds `active` class to the matching tab button and section

---

#### `createHubSettings()`

Creates the content for the "Hub" tab. Returns a DOM fragment with hub-level configuration controls.

**Returns:** `HTMLElement` — A document fragment containing hub settings groups.

**Note:** This method is called by `refreshTabs()` and its implementation reads from `this.configManager` to build appropriate controls.

---

#### `createModuleSettings(moduleName)`

Creates the content for a specific module's settings tab.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `moduleName` | `string` | Yes | Name of the module to create settings for |

**Returns:** `HTMLElement` — A document fragment containing module-specific settings controls.

**Note:** This method reads the module's configuration from `this.configManager.getConfig(moduleName)` and builds appropriate form controls.

---

#### `saveSettings()`

Persists all current settings from the UI controls back to the `ConfigManager`.

**Returns:** `void`

**Called by:** Save button click handler.

---

#### `resetSettings()`

Resets all settings to their default values.

**Returns:** `void`

**Called by:** Reset button click handler.

---

## CSS Contract

### Class Reference

| Class | Element | Description |
|-------|---------|-------------|
| `.chatgpt-hub-settings` | Panel container | Fixed-position modal, centered, 80% width (max 800px), 80vh max height |
| `.chatgpt-hub-settings-header` | Header bar | Green background (`#4CAF50`), white text, flex layout |
| `.chatgpt-hub-settings-close` | Close button | No background/border, white text, cursor pointer |
| `.chatgpt-hub-settings-tabs` | Tab bar | Light gray background (`#f5f5f5`), bottom border |
| `.chatgpt-hub-settings-tab` | Tab button | Padding 10px 15px, cursor pointer, no background/border |
| `.chatgpt-hub-settings-tab.active` | Active tab | White background, green bottom border (`#4CAF50`), bold |
| `.chatgpt-hub-settings-content` | Content area | Padding 20px, overflow-y auto, flex: 1 |
| `.chatgpt-hub-settings-section` | Tab content | `display: none` by default |
| `.chatgpt-hub-settings-section.active` | Active section | `display: block` |
| `.chatgpt-hub-settings-group` | Settings group | Bottom margin 20px, bottom border separator |
| `.chatgpt-hub-settings-group h3` | Group title | No top margin, 10px bottom margin, 16px font |
| `.chatgpt-hub-settings-row` | Setting row | Flex layout, 10px bottom margin, align-items center |
| `.chatgpt-hub-settings-label` | Setting label | `flex: 0 0 40%`, 14px font |
| `.chatgpt-hub-settings-input` | Setting input | `flex: 1` |
| `.chatgpt-hub-settings-footer` | Footer bar | Light gray background, right-aligned text, top border |
| `.chatgpt-hub-settings-button` | Footer button | Padding 8px 15px, 4px border-radius, 14px font, 10px left margin |
| `.chatgpt-hub-settings-save` | Save button | Green background (`#4CAF50`), white text |
| `.chatgpt-hub-settings-reset` | Reset button | Red background (`#f44336`), white text |
| `.chatgpt-hub-settings-cancel` | Cancel button | Gray background (`#ccc`), black text |

### Dark Theme Support

The settings UI supports dark theme via a parent `.dark-theme` class. When a parent element has this class, the following overrides apply:

| Selector | Override |
|----------|----------|
| `.dark-theme .chatgpt-hub-settings` | Background `#2c3e50`, text `#ecf0f1` |
| `.dark-theme .chatgpt-hub-settings-tabs` | Background `#34495e`, border `#2c3e50` |
| `.dark-theme .chatgpt-hub-settings-tab` | Text `#ecf0f1` |
| `.dark-theme .chatgpt-hub-settings-tab.active` | Background `#2c3e50`, border `#3498db` |
| `.dark-theme .chatgpt-hub-settings-footer` | Background `#34495e`, border `#2c3e50` |
| `.dark-theme .chatgpt-hub-settings-group` | Border `#34495e` |

**Note:** The dark theme is applied by the hub's `ThemeManager` which sets `data-hub-theme` on `<html>`. The settings UI uses the `.dark-theme` class convention, which should be set on a common ancestor (typically `<html>` or `<body>`).

---

## DOM Structure

When rendered, the settings panel produces this DOM:

```html
<div class="chatgpt-hub-settings" style="display: none;">
  <!-- Header -->
  <div class="chatgpt-hub-settings-header">
    <span>ChatGPT Hub Settings</span>
    <button class="chatgpt-hub-settings-close">&times;</button>
  </div>

  <!-- Tabs -->
  <div class="chatgpt-hub-settings-tabs">
    <button class="chatgpt-hub-settings-tab active" data-tab-id="hub">Hub</button>
    <button class="chatgpt-hub-settings-tab" data-tab-id="utilities">Utilities</button>
    <button class="chatgpt-hub-settings-tab" data-tab-id="automation">Automation</button>
  </div>

  <!-- Content -->
  <div class="chatgpt-hub-settings-content">
    <div class="chatgpt-hub-settings-section active" data-tab-id="hub">
      <!-- Hub settings content -->
    </div>
    <div class="chatgpt-hub-settings-section" data-tab-id="utilities">
      <!-- Utilities module settings -->
    </div>
    <div class="chatgpt-hub-settings-section" data-tab-id="automation">
      <!-- Automation module settings -->
    </div>
  </div>

  <!-- Footer -->
  <div class="chatgpt-hub-settings-footer">
    <button class="chatgpt-hub-settings-button chatgpt-hub-settings-cancel">Cancel</button>
    <button class="chatgpt-hub-settings-button chatgpt-hub-settings-reset">Reset</button>
    <button class="chatgpt-hub-settings-button chatgpt-hub-settings-save">Save</button>
  </div>
</div>
```

---

## Integration Guide

### Basic Integration

The simplest way to integrate the Settings UI:

```javascript
// 1. Instantiate with a ConfigManager
const settingsUI = new SettingsUI(configManager);

// 2. Initialize (creates styles, panel, and menu command)
settingsUI.init();

// 3. Show/hide programmatically
settingsUI.show();
settingsUI.hide();
```

### Hub Integration

The hub should integrate the Settings UI during its initialization sequence:

```javascript
// In 00-hub.user.js initialization
function initializeHub() {
  // ... other initialization ...

  // Create and initialize Settings UI
  const settingsUI = new SettingsUI(ConfigManager);
  settingsUI.init();

  // Expose for module access
  window.SettingsUIInstance = settingsUI;

  // Listen for config changes to update UI
  ConfigManager.onChange((key, value) => {
    if (settingsUI.isVisible) {
      settingsUI.refreshTabs();
    }
  });
}
```

### Module Settings

Modules can provide their own settings by storing configuration via `ConfigManager`:

```javascript
// Module stores its config
ConfigManager.updateConfig('MyModule', {
  enabled: true,
  threshold: 0.8,
  apiEndpoint: 'https://api.example.com'
});

// The Settings UI automatically creates a tab for the module
// when `refreshTabs()` is called, reading from `ConfigManager.getConfig('MyModule')`
```

---

## Extending the Settings UI

### Adding Custom Tabs

You can add custom tabs programmatically after initialization:

```javascript
// Create custom content
const customContent = document.createElement('div');
customContent.innerHTML = `
  <div class="chatgpt-hub-settings-group">
    <h3>Custom Settings</h3>
    <div class="chatgpt-hub-settings-row">
      <label class="chatgpt-hub-settings-label">My Setting</label>
      <input class="chatgpt-hub-settings-input" type="text" data-setting="myModule.mySetting">
    </div>
  </div>
`;

// Add the tab
settingsUI.addTab('Custom', 'custom', customContent);
```

### Custom Setting Controls

The settings UI supports various input types via `data-setting` attributes:

```html
<!-- Text input -->
<input class="chatgpt-hub-settings-input" type="text" data-setting="moduleName.key">

<!-- Checkbox -->
<input class="chatgpt-hub-settings-input" type="checkbox" data-setting="moduleName.enabled">

<!-- Number input -->
<input class="chatgpt-hub-settings-input" type="number" data-setting="moduleName.threshold">

<!-- Select dropdown -->
<select class="chatgpt-hub-settings-input" data-setting="moduleName.theme">
  <option value="dark">Dark</option>
  <option value="light">Light</option>
  <option value="system">System</option>
</select>
```

The `data-setting` attribute uses dot notation to map to config keys:
- `"moduleName.key"` → `ConfigManager.getConfig('moduleName').key`
- `"debugMode"` → `ConfigManager.get('debugMode')`

---

## Event Contract

The Settings UI does not emit events directly, but it interacts with the hub's event system:

| Event | Direction | Description |
|-------|-----------|-------------|
| `config:changed` | Consumed (via ConfigManager) | Triggers tab refresh when settings are modified externally |
| `module:registered` | Consumed (via ModuleRegistry) | Next `show()` call will include the new module's tab |
| `module:destroyed` | Consumed (via ModuleRegistry) | Next `show()` call will exclude the destroyed module's tab |

---

## Best Practices

1. **Instantiate after ConfigManager** — The Settings UI requires a `ConfigManager` instance; create it after the hub's ConfigManager is initialized.

2. **Use `data-setting` for persistence** — All setting inputs should use `data-setting` attributes with dot-notation keys so that `saveSettings()` can automatically persist them.

3. **Refresh on show** — Always call `refreshTabs()` in `show()` to ensure the UI reflects the current module state.

4. **Clean up on destroy** — If the hub is destroyed, remove the panel from the DOM:
   ```javascript
   if (settingsUI.panel && settingsUI.panel.parentNode) {
     settingsUI.panel.parentNode.removeChild(settingsUI.panel);
   }
   ```

5. **Respect dark theme** — Ensure any custom tab content works with the `.dark-theme` class by using CSS variables or explicit overrides.

6. **Keep settings grouped** — Use `.chatgpt-hub-settings-group` to organize related settings under a heading.

7. **Label width consistency** — Labels use `flex: 0 0 40%`; keep labels concise to avoid overflow.

---

## Troubleshooting

### Settings panel does not appear

- Verify `ConfigManager` was passed to the constructor
- Check that `init()` was called
- Ensure the panel was appended to `document.body` (check for `.chatgpt-hub-settings` in the DOM)
- Verify `display` is not being overridden by other CSS

### Tabs are empty

- Check that modules are registered before `show()` is called
- Verify `window.ChatGPTModules` exists and `list()` returns modules
- Check `ConfigManager.getConfig(moduleName)` returns data for each module

### Dark theme not applied

- Ensure a parent element has the `.dark-theme` class
- The hub's `ThemeManager` sets `data-hub-theme` on `<html>`, but the settings UI uses `.dark-theme` class convention
- You may need to synchronize: `document.documentElement.classList.toggle('dark-theme', theme === 'dark')`

### Save button does not persist settings

- Verify `ConfigManager.set()` and `ConfigManager.updateConfig()` are working
- Check that `GM_setValue`/`GM_getValue` are available (Tampermonkey API)
- Ensure `data-setting` attributes are correctly formatted with dot notation

### Panel appears off-center

- The panel uses `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%)`
- Check for CSS conflicts with the host page's layout
- Verify no ancestor elements have `transform` that could affect fixed positioning

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-19 | Initial comprehensive Settings UI API reference |

---

*Generated from `settings-ui.js` — For questions or updates, refer to the source file.*