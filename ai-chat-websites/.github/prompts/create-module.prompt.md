---
description: "Generate a new userscript module file with proper structure, metadata, and registration. Input: module name, features, dependencies."
---

# Module Scaffold Generator

You are generating a new userscript module for the AI Chat Userscript Suite.

## Input

- Module name (e.g., "Resource Optimizer")
- Core features (1-3 sentences)
- Optional dependencies (e.g., ["ModuleRegistry", "ConfigManager"])

## Output

Generate a complete `.module.user.js` file with:

1. **UserScript metadata** (@name, @version, @match, @grant)
2. **Class structure** with required properties
3. **Lifecycle methods** (init, execute, onConfigUpdate, destroy)
4. **Registration** with fallback patterns

## Template

```javascript
// ==UserScript==
// @name         NN. Module Name .M
// @namespace    http://tampermonkey.net/
// @version      2026.04.24.0
// @description  [One sentence description]
// @author       AI RMD
// @license      MIT
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
  "use strict";

  class ModuleName {
    constructor() {
      this.name = "ModuleName";
      this.version = "2026.04.24.0";
      this.dependencies = [];
      this.critical = false;
      this.config = {};
    }

    init() {
      // Load config
      this.config = window.ConfigManager?.getConfig("moduleName") || {};
      // Setup
      console.log(`[ModuleName] Initialized`);
    }

    execute() {
      // Runtime behavior
    }

    onConfigUpdate(settings) {
      Object.assign(this.config, settings);
    }

    destroy() {
      // Cleanup
    }
  }

  // Register
  const instance = new ModuleName();
  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(instance);
  } else if (window.ChatGPTModules && typeof window.ChatGPTModules.register === "function") {
    window.ChatGPTModules.register(instance);
  }
})();
```

## Rules

- Use current date for version: `2026.04.24`
- Follow filename pattern: `NN-module-name.module.user.js`
- Include both registration fallbacks
- Add console.log for init/execute for debugging
- Set critical=false unless module is essential
