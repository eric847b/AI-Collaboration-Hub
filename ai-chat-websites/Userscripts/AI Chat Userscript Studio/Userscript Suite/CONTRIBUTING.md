# Contributing to the Userscript Suite

Thanks for contributing! Follow these guidelines to keep review and testing fast.

## Before you open a PR

- Follow filename conventions: `NN. Name .M.user.js` for modules.
- Run the full verification suite:
  - `npm run verify`
- Run the bundler locally and attach the merged bundle to the PR or ensure CI builds it:
  - `npm run bundle:merge`
- Smoke test locally by loading the merged bundle into Tampermonkey and verifying console logs.
- Update `ConfigManager.getDefaultConfig` when adding new configuration keys.

## PR content

- Describe what the module does and list affected files.
- Include expected DevTools console messages for quick verification.
- If you changed settings, include screenshots of the updated settings UI when helpful.

## Review tips for maintainers

- Confirm module metadata (`name`, `version`, `dependencies`, `critical`) is present.
- Run the merged bundler and scan the generated file for obvious header conflicts.
- Manually test any UI changes using the settings UI.

Thanks - maintainers will review and request changes as needed.
