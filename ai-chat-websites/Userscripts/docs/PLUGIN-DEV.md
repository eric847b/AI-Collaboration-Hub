# Plugin Developer Guide — Unified AI Assistant Suite

Plugins extend the suite through the Plugin API (`Userscripts/modules/plugin-api.js`)
and are distributed via the marketplace (`Userscripts/plugins/marketplace/`).

## Plugin manifest (minimum)

```js
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "What it does",
  "author": "you",
  "category": "utilities",
  "permissions": ["storage", "ui"],
  "hooks": ["onInit", "onGenerationComplete"],
  "downloadUrl": "https://raw.githubusercontent.com/you/repo/main/plugin.js"
}
```

## Plugin implementation

```js
(function () {
  const manifest = { id: 'my-plugin', name: 'My Plugin', version: '1.0.0', /* ... */ };
  const implementation = {
    async onInit() { /* register UI, load state */ },
    onGenerationComplete(event) { /* react to generation */ }
  };
  if (window.UnifiedSuite?.pluginAPI) window.UnifiedSuite.pluginAPI.register(manifest, implementation);
})();
```

## Submission checklist

Validate your manifest with `v3/plugin-submission.js`:

```js
const { PluginSubmission } = require('../v3/plugin-submission.js');
const res = new PluginSubmission().validate(manifest);   // { ok, errors }
```

The review checklist (`new PluginSubmission().reviewChecklist()`):
- manifest present with `id`/`name`/`version`
- permissions declared and minimal
- no `eval()` / `new Function`
- no network calls beyond declared `@connect`
- source passes `node --check`
- changelog entry added

## Publishing

1. Host the plugin file on a public URL (GitHub raw works).
2. Add an entry to `Userscripts/plugins/marketplace/catalog.json`.
3. Open the marketplace gallery (`index.html`) to verify it renders and installs.

## Safety

- Never read `document.cookie`, `window.top`, or use `GM_setValue` without
  declaring it in `permissions`.
- Run `v3/sandbox-preview.js` on untrusted scripts before enabling them.
- Usage is tracked locally only (`v3/plugin-submission.js` `track`) — no PII leaves
  the browser.