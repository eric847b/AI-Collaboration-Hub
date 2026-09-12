# Migration Guide — v2.x → v3.0.0

Covers the v3.0.0 architecture changes and how to migrate existing modules and
plugins. Review the entire checklist before upgrading.

## What changed in v3.0.0

| Area | v2.x | v3.0.0 |
|------|------|--------|
| Module format | CommonJS/IIFE `module.exports` + `window.UnifiedSuite` | ES modules via Vite (still emits IIFE build) |
| Storage | `GM_*` only | `GM_*` + localStorage with in-memory fallback |
| Orchestration | manual provider pick | `background.js` `MODEL_LADDER` auto-routing |
| Collaboration | none | `collab.js` `CollabManager` (WebSocket) |
| Build | manual concatenation | `Userscripts/build` (Vite/Rollup) |

## Migration checklist

1. **Modules** — convert `(function (global){ ... module.exports = X })(window)`
   to `export const X = ...` when using the Vite ES build. The IIFE build
   (`dist/unified-suite-v3.js`) remains available for userscripts.

2. **Storage** — wrap `GM_setValue`/`GM_getValue` calls. New modules use the
   localStorage + in-memory fallback pattern (see `v3/` modules) so they work
   in Node and browser.

3. **Providers** — the extension popup's **Auto** mode replaces hard-coded
   provider selection. Manual selection still works; `payload.provider` may now
   be `'auto'`.

4. **Plugins** — update the manifest to include `downloadUrl`. Validate with
   `v3/plugin-submission.js` before submitting to the marketplace.

5. **Permissions** — run `v3/permission-minimizer.js` on your scripts to
   produce the minimal `@grant`/`@match`/`@connect` set.

6. **CSP** — run `v3/csp-validator.js` on your extension CSP before publishing.

## Breaking changes to watch

- `handleGenerateScript` now requires a `prompt` (empty prompt returns an error).
- `ViewColumn.B` was removed in the VS Code extension in favor of
  `ViewColumn.Beside`.
- Empty array `permissions: []` is valid; omitting the field is not.

## Rollback

Keep a tag of your last v2.x commit. The v3 bundle is additive — the old
`modules/` IIFE files still load unchanged.