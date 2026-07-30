# Contributing to Unified AI Assistant Suite

Thank you for your interest in contributing! This guide will help you get started.

## 📋 Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Style Guide](#style-guide)

---

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect differing viewpoints and experiences

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Git
- Code editor (VS Code recommended)
- Tampermonkey or Violentmonkey for testing

### Fork and Clone
```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/ai-chat-websites.git
cd ai-chat-websites
git remote add upstream https://github.com/eric847b/ai-chat-websites.git
```

---

## Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Your Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 3. Available Scripts
```bash
# Run tests
npm test

# Build single-file userscript from modules
npm run build

# Lint code
npm run lint

# Format code
npm run format

# Validate modules
npm run validate:modules

# Check module dependencies
npm run check:deps
```

---

## Project Structure

```
Userscripts/
├── modules/                    # Modular source code
│   ├── config.js              # Configuration and constants
│   ├── state.js               # State management
│   ├── utilities.js           # Helper functions
│   ├── storage.js             # GM_storage operations
│   ├── providers.js           # AI provider implementations
│   ├── ui.js                  # UI rendering and events
│   ├── theme.js               # Theme management
│   ├── versioning.js          # Script versioning
│   ├── auth.js                # Authentication & security
│   └── index.js               # Module loader
│
├── docs/                      # Documentation
│   ├── Focus_Chain_List_v1.4.0.md
│   ├── ...
│
├── Unified-AI-Assistant-Suite.user.js  # Single-file build (generated)
├── package.json               # Dependencies and scripts
└── CHANGELOG.md              # Version history

Root level:
├── next_improvement_prompt.md # Feature requirements
├── next_year_roadmap.md       # Strategic roadmap
├── docs/                      # Project-wide documentation
└── scripts/                   # Build and utility scripts
```

---

## Making Changes

### Module Development
When modifying or adding modules:

1. **Edit the module file** in `Userscripts/modules/`
2. **Update the build** to regenerate single-file version:
   ```bash
   npm run build
   ```
3. **Test the changes** in Tampermonkey/Violentmonkey
4. **Run the linter**:
   ```bash
   npm run lint
   ```

### Adding a New Module

1. Create `Userscripts/modules/your-module.js`
2. Export using the standard pattern:
   ```javascript
   const YourModule = {
       // implementation
   };

   // Export for module system
   if (typeof module !== 'undefined' && module.exports) {
       module.exports = { YourModule };
   }

   // Export for userscript context
   if (typeof window !== 'undefined') {
       window.UnifiedSuite.yourModule = YourModule;
   }
   ```
3. Add to `Userscripts/modules/index.js` MODULE_DEFINITIONS
4. Update build script if needed
5. Add JSDoc type definitions

### Modifying the Single-File Build
The single-file build is **generated** from modules. Never edit it directly:
1. Make changes to the appropriate module in `Userscripts/modules/`
2. Run `npm run build`
3. Commit both the module changes and regenerated build

---

## Testing

### Manual Testing
1. Open Tampermonkey/Violentmonkey dashboard
2. Create new userscript with content from `Unified-AI-Assistant-Suite.user.js`
3. Test on various websites
4. Check browser console for errors

### Test Checklist
- [ ] UI loads without errors
- [ ] All tabs function correctly
- [ ] AI provider switching works
- [ ] Script generation completes
- [ ] Theme toggle works
- [ ] Versioning functions
- [ ] Export/import works
- [ ] No console errors

### Automated Testing (Coming Soon)
We're working on adding automated tests. Stay tuned!

---

## Submitting Changes

### 1. Commit Your Changes
```bash
git add .
git commit -m "feat: add template gallery feature"
# or
git commit -m "fix: resolve module loading error"
```

### Commit Message Format
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

### 2. Push to Your Fork
```bash
git push origin feature/your-feature-name
```

### 3. Create Pull Request
- Go to the original repository on GitHub
- Click "New Pull Request"
- Select your branch
- Fill out the PR template
- Link related issues

### Pull Request Guidelines
- Keep PRs focused on a single feature/fix
- Update documentation if needed
- Ensure all tests pass
- Request review from maintainers

---

## Style Guide

### JavaScript Style
- Use ES6+ features (const, let, arrow functions, async/await)
- 2-space indentation
- Single quotes for strings (unless string contains single quote)
- Semicolons required
- camelCase for variables and functions
- PascalCase for classes and modules

### JSDoc Comments
All public functions and modules must have JSDoc:
```javascript
/**
 * Generate a unique ID
 * @returns {string} Unique identifier
 */
function generateId() {
    // ...
}
```

### Module Pattern
All modules must follow this pattern:
```javascript
// Dependencies from global UnifiedSuite
const CONFIG = window.UnifiedSuite?.CONFIG || {};
const state = window.UnifiedSuite?.state || {};

const ModuleName = {
    // Public API
};

// Export for both contexts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ModuleName };
}
if (typeof window !== 'undefined') {
    window.UnifiedSuite.moduleName = ModuleName;
}
```

### Security Considerations
- Never hardcode API keys
- Sanitize all user inputs
- Use GM_xmlhttpRequest for network requests
- Validate all generated scripts
- Don't use eval() (detected by linter)

---

## Questions?

- Open an issue for bugs or feature requests
- Check existing documentation in `docs/`
- Review closed issues for common questions
- Reach out to maintainers

---

## Recognition

Contributors will be:
- Listed in CHANGELOG.md
- Mentioned in release notes
- Invited to maintainer chat (after 3+ contributions)

Thank you for contributing! 🎉