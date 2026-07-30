# Development Notes - Userscript Suite

Quick actionable developer checklist and conventions.

## Naming and placement

- New modules: create in `Modules/` with filename pattern `NN-name.module.user.js` (the numeric prefix keeps ordering stable).
- Hub file: `00-hub.user.js` is the central orchestrator. Avoid duplicating registration logic elsewhere.

## Module pattern

- Minimal module should implement:
  - a constructor with `name`, `version`, `dependencies` (array), and `critical` (boolean)
  - `init()` to attach observers and read config
  - optional `onConfigUpdate(settings)` to react to config changes
  - optional `execute()` if the hub calls it explicitly
- Register modules with `ModuleRegistry.register(instance)` or `ChatGPTModules.register(instance)`.

## Config and settings

- Use `ConfigManager.getConfig(moduleName)` and `ConfigManager.updateConfig(moduleName, settings)`.
- Settings UI inputs use `data-setting` attributes mapping to dotted config keys (see `settings-ui.js`).
- Add default values in `ConfigManager.getDefaultConfig` when introducing new config keys.

## Bundling and local testing

- Run `npm run verify` for the full local verification suite.
- Run `npm run bundle` for the concatenated bundle (`dist/ai-chat-userscript-suite.bundle.user.js`).
- Run `npm run bundle:merge` for the merged-header bundle (`dist/ai-chat-userscript-suite.bundle.merged.user.js`).
- Load the merged bundle into Tampermonkey and test on:
  - `https://chat.openai.com/*`
  - `https://chatgpt.com/*`

## Smoke test checklist

- After loading the bundle, open DevTools and verify:
  - `[DevSmokeTest] init called`
  - `[DevSmokeTest] execute called`
  - modules you changed log expected init/execute output and react to settings updates

## PR checklist

- Include module metadata: `name`, `version`, `dependencies` (if any), `critical`.
- Update `ConfigManager.getDefaultConfig` if adding configuration keys.
- Run `npm run verify` before bundling.
- Run `npm run bundle:merge` and attach the generated bundle to the PR or confirm it builds in CI.
- Manual smoke test: load the merged bundle and verify console logs for changed modules.

## Troubleshooting

- If modules do not load, search for registration errors in `00-hub.user.js` and check the console for thrown errors.
- If the `chatgpt` API is unavailable, modules should fall back to `MutationObserver` (see implementations in `Modules/`).
