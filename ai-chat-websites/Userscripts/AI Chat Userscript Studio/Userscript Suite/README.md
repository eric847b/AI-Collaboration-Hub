# AI Chat Userscript Suite

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![ESLint](https://img.shields.io/badge/ESLint-9.0-blue)](https://eslint.org/)

Enterprise-grade modular userscript suite for AI chat platforms including ChatGPT, Claude, Poe, Perplexity, and more.

## Features

### Core Architecture (Merged from AI-Collaboration-Hub & autonomous-github-agent)
- **Hub Orchestrator**: Central brain that runs catalyst cycles (scope → improve → act), registry validation, atomic writes, and health monitoring
- **Self-Evolution Engine**: 50+ typed failure types with automatic retry, exponential backoff, fix verification ledger, and escalation
- **Dashboard Core**: Real-time health dashboard with performance metrics (FPS, memory, latency), analytics tracking, and registry browser
- **Consensus Engine**: Multi-role AI consensus (Planner → Researcher → Critic → Forge → Echo) with confidence scoring and rule-based fallback
- **Module Registry**: Full module tracking with roles, dependencies, entrypoints, and auto-discovery
- **Failure Recovery**: ErrorBoundary class, typed failure tracking, automatic retry with exponential backoff

### User-Facing Features
- **Modular Architecture**: 351 modules across 27 categories — load and manage feature modules dynamically
- **Enterprise-Grade**: Advanced error handling, performance monitoring, and analytics
- **Configuration Management**: Centralized settings with validation
- **Service Container**: Dependency injection with lifecycle management
- **Settings UI**: Beautiful, accessible settings interface
- **Keyboard Navigation**: Full keyboard support for accessibility
- **Dark/Light Theme**: Automatic theme detection and manual override
- **Import/Export**: Backup and restore settings
- **Performance Monitoring**: Track module load times and performance metrics
- **Error Boundary**: Graceful error handling and recovery

## Supported Platforms

- ChatGPT (https://chat.openai.com/*, https://chatgpt.com/*)
- Claude (https://claude.ai/*)
- Poe (https://poe.com/*)
- Perplexity (https://perplexity.ai/*, https://www.perplexity.ai/*)
- Pi (https://pi.ai/*)
- You.com (https://you.com/*)
- Gemini (https://gemini.google.com/*)
- AI Studio (https://aistudio.google.com/*)
- Copilot (https://copilot.microsoft.com/*)
- Mistral (https://chat.mistral.ai/*)

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Tampermonkey or Greasemonkey browser extension

### Installation

1. Clone or download this repository
2. Navigate to the `Userscript Suite` directory
3. Install dependencies:

```bash
npm install
```

4. Verify installation:

```bash
npm run verify
```

5. Build the bundle:

```bash
npm run bundle:merge
```

6. Load the generated bundle in Tampermonkey:
   - File: `dist/ai-chat-userscript-suite.bundle.merged.user.js`
   - Or load individual modules from the `Modules/` directory

### Development Mode

For development with auto-reload:

```bash
npm run dev
```

## Project Structure

```text
Userscript Suite/
|-- README.md                   # This file
|-- ROADMAP.md                  # Development roadmap with remaining items
|-- NEXT_100_SUGGESTIONS_ARCHIVED.md  # Original suggestion list (archived)
|-- package.json                # Project configuration
|-- eslint.config.cjs           # ESLint configuration
|-- CONTRIBUTING.md             # Contribution guidelines
|-- DEVELOPMENT.md              # Development documentation
|-- Modules/                    # Feature modules (351 total)
|   |-- 00-Core/                # Core orchestrators (15 modules)
|   |   |-- 001-site-adapter.module.user.js
|   |   |-- 002-error-handling.module.user.js
|   |   |-- 003-module-registry.module.user.js
|   |   |-- 004-intelligent-error-handler.module.user.js
|   |   |-- 005-config-manager.module.user.js
|   |   |-- 006-unified-configuration-manager.module.user.js
|   |   |-- 007-config-validator.module.user.js
|   |   |-- 008-utilities.module.user.js
|   |   |-- 009-service-container.module.user.js
|   |   |-- 010-module-loader.module.user.js
|   |   |-- 011-memory-manager.module.user.js
|   |   |-- 012-hub-event-handler.module.user.js
|   |   |-- 013-control-panel-ui.module.user.js
|   |   |-- 014-autonomous-improvement.module.user.js
|   |   |-- 015-module-bootstrap-helper.module.user.js
|   |   |-- 016-hub-orchestrator.module.user.js          # Central orchestrator
|   |   |-- 017-self-evolution-engine.module.user.js     # Self-healing engine
|   |   |-- 018-dashboard-core.module.user.js            # Real-time health dashboard
|   |   |-- 019-consensus-engine.module.user.js          # Multi-role AI consensus
|   |   |-- 020-module-registry.module.user.js        # Module tracking & discovery
|   |   `-- 021-failure-recovery.module.user.js       # Recovery with retry/backoff
|   |-- 01-Chat-Enhancement/      # Chat features (25 modules)
|   |-- 02-AI-Agents/             # AI agent modules (7 modules)
|   |-- 03-UI-Components/         # UI components (14 modules)
|   |-- 04-Production/            # Production tools (16 modules)
|   |-- 05-Security/              # Security modules (23 modules)
|   |-- 06-Performance/           # Performance optimization (33 modules)
|   |-- 07-Accessibility/         # Accessibility (5 modules)
|   |-- 08-Export-Import/         # Export/import (20 modules)
|   |-- 09-Media/                 # Media handling (23 modules)
|   |-- 10-Text-Language/         # Text/language tools (23 modules)
|   |-- 11-Code-Tools/            # Code utilities (20 modules)
|   |-- 12-Testing/               # Testing tools (12 modules)
|   |-- 13-Chat-Platforms/       # Platform integrations
|   |-- 14-Networking-API/       # Network tools (8 modules)
|   |-- 15-Analytics/              # Analytics (9 modules)
|   |-- 16-Prompt-Engineering/     # Prompt tools
|   |-- 14-Error-Handling/       # Error handling (20 modules)
|   |-- 17-Collaboration/          # Collaboration tools (10 modules)
|   |-- 18-Organization/           # Organization tools (23 modules)
|   |-- 19-Hotkeys-Shortcuts/      # Keyboard shortcuts (6 modules)
|   |-- 20-Session-Timing/         # Session tools (5 modules)
|   |-- 21-Quota-Saving/           # Quota optimization (4 modules)
|   `-- 25-Cost-Advisor/           # Cost analysis (3 modules)
|-- scripts/                    # Build and utility scripts
|   |-- validate.cjs
|   |-- bundle.cjs
|   |-- bundle-merge.cjs
|   |-- bundle-minify.cjs
|   |-- bundle-analyze.cjs
|   |-- bundler-utils.cjs
|   |-- dev-server.cjs
|   |-- quick-test.cjsup.js
|   `-- __tests__/
|-- dist/                       # Generated bundles (created by build)
`-- node_modules/               # Dependencies (created by npm install)
```

## Available Scripts

### Build Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Create production bundle |
| `npm run build:merge` | Create merged production bundle |
| `npm run build:production` | Clean, rebuild, and minify the merged bundle |
| `npm run build:all` | Build both standard and merged bundles |
| `npm run bundle` | Create `dist/ai-chat-userscript-suite.bundle.user.js` |
| `npm run bundle:merge` | Create `dist/ai-chat-userscript-suite.bundle.merged.user.js` |
| `npm run bundle:minify` | Create `dist/ai-chat-userscript-suite.bundle.merged.min.user.js` |
| `npm run bundle:analyze` | Report generated bundle sizes in `dist/` |

### Development Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with auto-reload |
| `npm run dev:hot` | Start the development server in hot mode |
| `npm run dev:debug` | Start the development server with the Node inspector |
| `npm run ai-assist` | Run the AI development assistant against the suite |
| `npm run clean` | Clean build artifacts |
| `npm run clean:dist` | Clean only generated bundle output |
| `npm run clean:coverage` | Clean only generated coverage output |

### Testing Scripts

| Script | Description |
|--------|-------------|
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:ci` | Run CI-oriented tests with coverage |
| `npm run test:quick` | Run quick module registration test |

### Linting Scripts

| Script | Description |
|--------|-------------|
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run lint:md` | Run markdownlint |

### Quality Scripts

| Script | Description |
|--------|-------------|
| `npm run validate` | Run pre-flight checks |
| `npm run verify` | Run validation, tests, quick checks, and linting |
| `npm run verify:ci` | Run CI-oriented validation, coverage, and linting |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm run prepare` | Set up Husky git hooks |

### Security Scripts

| Script | Description |
|--------|-------------|
| `npm run security:audit` | Run npm audit |
| `npm run security:fix` | Fix security vulnerabilities |

### Documentation Scripts

| Script | Description |
|--------|-------------|
| `npm run docs` | Generate JSDoc documentation |

## Module System

### Module Structure

Each module follows this structure:

```javascript
// ==UserScript==
// @name         Module Name
// @version      1.0.0
// @description  Module description
// @author       Author
// @match        https://chat.openai.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
  'use strict';

  class ModuleName {
    constructor() {
      this.name = 'ModuleName';
      this.version = '1.0.0';
      this.dependencies = [];
    }

    init() {
      // Module initialization
    }

    execute() {
      // Module execution
    }

    destroy() {
      // Module cleanup
    }
  }

  // Register module
  const instance = new ModuleName();
  if (window.ChatGPTModules && typeof window.ChatGPTModules.register === 'function') {
    window.ChatGPTModules.register(instance);
  } else {
    window.ModuleName = instance;
    instance.init();
    instance.execute();
  }
})();
```

### Module Registration

Modules can register with the hub in two ways:

1. **Modern Registration** (Recommended):
```javascript
window.ChatGPTModules.register(instance);
```

2. **Legacy Registration**:
```javascript
window.ChatGPTModules.register(name, version, instance);
```

### Module Dependencies

Modules can declare dependencies:

```javascript
class MyModule {
  constructor() {
    this.name = 'MyModule';
    this.version = '1.0.0';
    this.dependencies = ['Utilities', 'ErrorHandler'];
  }
}
```

## Configuration

### Configuration Manager

Access configuration through the global `ConfigManager`:

```javascript
// Get configuration
const value = ConfigManager.get('key');

// Set configuration
ConfigManager.set('key', value);

// Get module-specific config
const moduleConfig = ConfigManager.getConfig('moduleName');

// Update module config
ConfigManager.updateConfig('moduleName', { key: value });
```

### Default Configuration

The hub provides sensible defaults:

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

## Settings UI

The Settings UI provides a beautiful, accessible interface for managing configuration.

### Features

- Tab-based navigation
- Keyboard shortcuts (Escape to close, Tab for navigation, Arrow keys for tabs)
- Dark/light theme support
- Import/export settings
- Responsive design
- ARIA accessibility

### Usage

```javascript
// Initialize settings UI
const settingsUI = new SettingsUI(ConfigManager);
settingsUI.init();

// Show settings
settingsUI.show();

// Hide settings
settingsUI.hide();

// Toggle settings
settingsUI.toggle();
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Escape` | Close settings |
| `Tab` | Navigate between elements |
| `Shift+Tab` | Navigate backwards |
| `Arrow Left/Right` | Switch tabs (when tab focused) |

## Error Handling

### Error Handler

```javascript
// Retry with exponential backoff
await ErrorHandler.retry(async () => {
  // Your async operation
}, {
  maxRetries: 3,
  baseDelay: 1000,
  backoffFactor: 2
});

// Circuit breaker
const protectedFn = ErrorHandler.circuitBreaker(fn, {
  threshold: 5,
  timeout: 60000
});

// Wrap with error handling
const safeFn = ErrorHandler.wrap(fn, (error, ...args) => {
  console.error('Error:', error);
  // Handle error
});
```

## Performance Monitoring

### Metrics

The hub tracks:

- Module registration time
- Configuration load/save time
- Error counts
- Memory usage
- Performance snapshots

### Access Metrics

```javascript
// Get performance metrics
const metrics = performanceMetrics;

// Get module-specific metrics
const moduleMetrics = ServiceContainer.getMetrics('moduleName');

// Take performance snapshot
const snapshot = takePerformanceSnapshot();
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run quick tests
npm run test:quick
```

### Test Structure

Tests live in two places:

```
Modules/
|-- 08-code-shrinker.module.user.js
`-- 08-code-shrinker.module.user.test.js

scripts/
`-- __tests__/
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Development

For detailed development documentation, see [DEVELOPMENT.md](DEVELOPMENT.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [chatgpt.js](https://github.com/kudoai/chatgpt.js) - ChatGPT API library
- [ESLint](https://eslint.org/) - JavaScript linter
- [Jest](https://jestjs.io/) - Testing framework
- [Prettier](https://prettier.io/) - Code formatter

## Support

For issues and questions:

1. Check the [DEVELOPMENT.md](DEVELOPMENT.md) documentation
2. Search existing issues
3. Create a new issue with detailed information

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the full development roadmap with 291 remaining items across 12 categories.

**Current Status**: 69/360 items implemented (19%), 351 modules on disk

**Recent Merges**:
- Hub Orchestrator — central brain with catalyst cycles
- Self-Evolution Engine — 50+ typed failure recovery
- Dashboard Core — real-time health monitoring
- Consensus Engine — multi-role AI consensus

**Next Priority**: Feature Enhancements + UI/UX for maximum user impact

---

Made with care by AI RMD
