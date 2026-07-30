# AI Chat Userscript Suite

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![ESLint](https://img.shields.io/badge/ESLint-9.0-blue)](https://eslint.org/)

Enterprise-grade modular userscript suite for AI chat platforms including ChatGPT, Claude, Poe, Perplexity, and more.

## Features

- **Modular Architecture**: Load and manage feature modules dynamically
- **Enterprise-Grade**: Advanced error handling, performance monitoring, and analytics
- **Configuration Management**: Centralized settings with validation
- **Service Container**: Dependency injection with lifecycle management
- **Module Registry**: Track and manage loaded modules
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
|-- 00-hub.user.js              # Main hub/orchestrator
|-- settings-ui.js              # Settings UI manager
|-- package.json                # Project configuration
|-- eslint.config.cjs           # ESLint configuration
|-- README.md                   # This file
|-- CONTRIBUTING.md             # Contribution guidelines
|-- DEVELOPMENT.md              # Development documentation
|-- Modules/                    # Feature modules
|   |-- 00-utilities.module.user.js
|   |-- 01-automation.module.user.js
|   |-- 02-error-handling.module.user.js
|   |-- ...
|   `-- 28-ai-conversation-enhancer.module.user.js
|-- scripts/                    # Build and utility scripts
|   |-- validate.cjs
|   |-- bundle.cjs
|   |-- bundle-merge.cjs
|   |-- bundle-minify.cjs
|   |-- bundle-analyze.cjs
|   |-- bundler-utils.cjs
|   |-- dev-server.cjs
|   |-- quick-test.cjs
|   |-- ai-dev-assistant.cjs
|   |-- clean.cjs
|   |-- lint-markdown.cjs
|   |-- lint-markdown.mjs
|   |-- setup-husky.cjs
|   |-- setup-husky.js
|   |-- jest-setup.js
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

- [ ] Add more AI platform support
- [ ] Implement plugin system
- [ ] Add cloud sync for settings
- [ ] Create visual module manager
- [ ] Add performance dashboard
- [ ] Implement A/B testing framework
- [ ] Add internationalization support
- [ ] Create mobile companion app

---

Made with care by AI RMD
