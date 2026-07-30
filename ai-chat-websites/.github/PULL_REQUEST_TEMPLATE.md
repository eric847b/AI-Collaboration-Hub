# Pull Request Template

## Summary

Explain the change and why it's needed.

## Checklist

- [ ] I ran `npm run bundle:merge` and attached `dist/code-pack.bundle.merged.user.js` or confirmed CI builds it.
- [ ] I updated `ConfigManager.getDefaultConfig` if new config keys were added.
- [ ] I smoke-tested by loading the merged bundle in Tampermonkey and verified DevTools console logs.
- [ ] Module metadata (`name`, `version`, `dependencies`, `critical`) present for added/updated modules.

## How to test

Describe specific steps a reviewer can take to verify the change.

## Screenshots (optional)

Attach screenshots for UI changes.
