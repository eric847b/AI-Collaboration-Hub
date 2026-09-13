# Unified AI Assistant Suite — API Reference

> Generated-style API reference derived from JSDoc annotations in the modules
> (roadmap item #116: "Generate API documentation from JSDoc annotations").
> TypeScript declarations (`.d.ts`) ship alongside each v3 module for opt-in TS users.

## Core suite (Userscripts/modules)

| Module | Exports | Notes |
|--------|---------|-------|
| `config.js` | CONFIG | Central config + magic strings |
| `state.js` | state | Runtime state |
| `utilities.js` | helpers | Formatting, hashing, validation helpers |
| `storage.js` | storage | GM/localStorage layer with fallback |
| `providers.js` | providers | OpenAI/Anthropic/Gemini/Ollama providers + local fallback |
| `templates.js` | templates | 10 built-in prompt templates, CRUD, import/export |
| `plugin-api.js` | PluginAPI | Legacy plugin system (v1.6.0) — superseded by `v3/plugin-api-stable.js` |
| `analytics.js` | AnalyticsModule | `trackGeneration`, `getSummary`, `getProviderRankings`, `getUsagePatterns` |
| `theme.js` | theme | Dark/light theme with CSS variables |
| `validator.js` | validator | Script validation + generation score |
| `versioning.js` | versioning | Script version history + diff |
| `sync.js` | sync | Cross-device sync |
| `autoupdate.js` | autoupdate | Self-update check + conflict UI |
| `i18n.js` | i18n | Translation framework base |
| `performance.js` | performance | Load-time + success-rate metrics |
| `debugger.js` | debugger | Debug pane |
| `auth.js` | auth | Session-only key storage (no persistence) |
| `context.js` | context | Context window builder |
| `index.js` | suite | Entry that wires modules into the suite |

## v3 accelerator (Userscripts/v3)

| Module | Class / Export | Key methods |
|--------|----------------|-------------|
| `conversations.js` | `ConversationStore` | `addTurn`, `transcript`, `toMessages`, `contextSummary` |
| `nl-editor.js` | `NLEditor` | `apply(source, nlDirective)` — rename/remove/extract/tune |
| `voice.js` | `VoiceInput` | Speech-to-text capture + transcript |
| `webhooks.js` | `WebhookDispatcher` | `dispatch`, queue, retry w/ backoff |
| `rbac.js` | `RBAC` | `addMember`, `can(role, resource, action)` |
| `audit-log.js` | `AuditLog` | `record`, `query`, `verify` (hash chain) |
| `csp-validator.js` | `CSPValidator` | `validate(policy)` — rejects `*`, `unsafe-eval` |
| `sandbox-preview.js` | `SandboxPreview` | `analyze(source)` — flags dangerous patterns |
| `permission-minimizer.js` | `PermissionMinimizer` | `analyze(header)` → minimal `@grant` set |
| `optimizer.js` | `ScriptOptimizer` | `analyze(source)` → suggestion list |
| `plugin-submission.js` | `PluginSubmission` | `validate(manifest)` → `{ ok, errors }` |
| `monitor.js` | `Monitor` | `sample`, `summary`, `dashboard()`, `captureError`, `getErrors` |
| `locale-bundles.js` | `LocaleTemplateBundles` | `forLocale(locale)`, `locales()` |
| `translation-framework.js` | `TranslationFramework` | `submitPack`, `t(key, locale)` |
| `api-server.js` | `validateScript` | Lightweight REST-ish validator |
| **`plugin-api-stable.js`** | **`PluginAPIv3`** | **`register`, `activate`, `invoke`, `resolveDependencies`, `runHook`, `snapshot`** |
| **`fine-tuning.js`** | **`FineTuningManager`** | **`createDataset`, `createJob`, `exportDataset`, `estimateCost`, `evaluate`** |
| **`template-exchange.js`** | **`TemplateExchange`** | **`search`, `rate`, `importJson`, `exportJson`, `share`, `feed`** |

### Plugin API v3 (stable, deny-by-default)

```js
const { PluginAPIv3, PERMISSIONS } = require('./v3/plugin-api-stable.js');
const api = new PluginAPIv3();

api.register({
  id: 'my-plugin',
  version: '1.0.0',
  name: 'My Plugin',
  description: 'Does a thing',
  author: 'you',
  permissions: ['storage:local'],
  dependencies: [{ id: 'some-lib', version: '^1.0.0' }]
}, {
  onInstall(ctx) { ctx.storage.set('installed', true); },
  main(ctx, arg) { return ctx.storage.get('installed') ? 'ready:' + arg : 'no'; }
});

api.activate('my-plugin');
api.invoke('my-plugin', 'main', [42]); // 'ready:42'
```

- **Versioning**: semver constraints (`1.0.0`, `^1.0.0`) enforced on dependencies.
- **Capabilities**: only the permissions you declare are exposed on `ctx` (`storage:local`,
  `http:fetch`, `ui:panel`, `clipboard:*`, `notifications`).
- **Lifecycle**: `onInstall`, `onActivate`, `onDeactivate`, `onUninstall`, `onUpdate`.

### Fine-Tuning Manager

```js
const { FineTuningManager } = require('./v3/fine-tuning.js');
const ft = new FineTuningManager();
ft.createDataset({ id: 'd1', entries: [{ text: 'Translate "hola"', completion: '"hello"' }] });
const job = ft.createJob({ dataset: 'd1', baseModel: 'gpt-4o-mini', hyperparams: { epochs: 3 } });
ft.startJob(job.id); ft.completeJob(job.id, { loss: 0.08 });
ft.estimateCost(job.id, 0.002); // { tokens, totalTokens, epochs, estUsd }
ft.exportDataset('d1', 'jsonl'); // upload-ready training file
```

### Template Exchange

```js
const { TemplateExchange } = require('./v3/template-exchange.js');
const gallery = new TemplateExchange();          // 50+ seeded templates
gallery.search('login', { category: 'security' });
gallery.rate('sec-01', 5, 'user-1');             // per-user ratings, avg + count
const bundle = gallery.exportJson();             // share everything as JSON
const theirs = new TemplateExchange();
theirs.importJson(bundle);
```

## Extension (Userscripts/extension)

| File | Purpose |
|------|---------|
| `background.js` | MV3 service worker; message router; provider API shims (OpenAI/Anthropic/Gemini/Ollama); **orchestrate()** model ladder |
| `popup.html/js` | Generate/Config/History tabs; mobile breakpoints |
| `content-script.js` | Platform detection (ChatGPT/Claude/Gemini) + DOM injection |
| `options.html` | API key/provider/base URL persistence |
| `collab.js` | CollabManager — WebSocket session sync, presence, offline queue |
| `service-worker.js` | PWA caching (extension install prompt) |
| `manifest.webmanifest` | PWA manifest (standalone, icons, theme) |

## v3 aggregate self-test

```bash
node Userscripts/v3/index.js --selftest   # all v3 modules smoke-tested
node Userscripts/tests/v3-extras.test.js  # plugin-api v3 + fine-tuning + template-exchange
node Userscripts/tests/regression.mjs     # full suite regression (syntax + v3 + marketplace)
```