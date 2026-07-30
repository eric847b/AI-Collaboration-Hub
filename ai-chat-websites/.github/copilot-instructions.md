# Copilot / Agent Instructions for Cody-AI Chat Websites

This file gives targeted, actionable guidance for AI coding agents working in this repository. Keep instructions short and specific; reference files when giving examples.

- Big picture: this repo contains userscripts for integrating enhancement modules into AI chat web UIs under `Userscripts/AI Chat Userscript Studio/Userscript Suite/`.
  - Hub file: `00-hub.user.js` is the central orchestrator that loads and manages modules (ModuleRegistry, ConfigManager, ChatGPTModules). Treat it as the entry point for runtime behavior.
  - Modules: each feature is a module under `Modules/` (e.g., `23-resource-optimizer.module.user.js`, `36-analytics-dashboard-2.module.user.js`). Modules follow a pattern: class-based modules with `init()`, `onConfigUpdate()` (optional), and `execute()`/observers.
  - Settings/UI: `settings-ui.js` builds hub/module configuration UIs and persists via `ConfigManager` and GM_* storage APIs (GM_setValue/GM_getValue). Use it as the example for settings persistence and UI conventions.

- Key modules (recent additions):
  - `23-resource-optimizer.module.user.js` — ML-based resource optimization with TensorFlow.js
  - `24-network-optimizer-enhanced.module.user.js` — Enhanced network optimization with LZ-String compression
  - `25-unified-config-manager.module.user.js` — Central configuration management and schema validation
  - `26-intelligent-error-handler.module.user.js` — Advanced error handling and recovery
  - `27-interactive-documentation.module.user.js` — In-app documentation and help system
  - `28-conversation-enhancer.module.user.js` — AI conversation suggestions and sentiment analysis
  - `29-parallel-processing.module.user.js` — Web Worker and task queue parallelization
  - `30-caching-strategies.module.user.js` — Advanced caching with TTL support
  - `31-file-manager.module.user.js` — In-page file management UI
  - `32-memory-management.module.user.js` — Memory pool and garbage collection tuning
  - `33-debugging-logging.module.user.js` — Console capture and error tracking
  - `34-task-manager.module.user.js` — Task scheduling and lifecycle management
  - `35-input-simulation.module.user.js` — Input simulation for automation
  - `36-analytics-dashboard-2.module.user.js` — Alternative analytics dashboard
  - `37-decision-making.module.user.js` — Heuristic decision making helpers
  - `38-ui-cleanup.module.user.js` — ChatGPT UI popup/disclaimer cleanup
  - `39-dev-smoke-test.module.user.js` — Development lifecycle logging
  - `40-cloud-sync.module.user.js` — Cloud sync placeholder
  - `41-ai-model-router.module.user.js` — AI model router placeholder
  - `42-network-optimization.module.user.js` — Network optimization with LZ-String compression
  - `43-universal-automation-suite.module.user.js` — Automation suite utilities
  - `44-collaboration-hub.module.user.js` — Collaboration and sharing helpers
  - `45-copilot-automation-guardian-roi.module.user.js` — Copilot automation guardian ROI

- Key patterns to follow when modifying/adding code:
  - Module registration: modules expose metadata (name, version, dependencies, critical) and register themselves with a central `ModuleRegistry` or `ChatGPTModules`. Search for `ModuleRegistry` and `ChatGPTModules.list()` usage.
  - Config flow: `ConfigManager.getConfig(moduleName)` and `ConfigManager.updateConfig(module, settings)` are the canonical read/write paths. When changing settings UI, call `window.ChatGPTModules.executeAll('applySettings')` or `module.onConfigUpdate` to notify modules.
  - Execution ordering: modules may declare `dependencies` and the hub sorts/executes them using a topological approach (see `sortModulesByDependencies` in hub). Preserve dependency metadata when adding modules.
  - Storage and permissions: scripts use GreaseMonkey/Tampermonkey APIs (`GM_setValue`, `GM_getValue`, `GM_addStyle`, `GM_xmlhttpRequest`). Keep cross-origin requests within the declared `@match`/`@grant` scope.

- Files/locations worth scanning for context:
  - `Userscripts/AI Chat Userscript Studio/Userscript Suite/00-hub.user.js` — hub orchestration and module loader.
  - `Userscripts/AI Chat Userscript Studio/Userscript Suite/Modules/*.user.js` — feature modules; follow their `init()` and observer patterns.
  - `Userscripts/AI Chat Userscript Studio/Userscript Suite/settings-ui.js` — settings UI creation, save/reset flows, example of `data-setting` attributes used on inputs.

- Developer workflows and quick commands (discoverable from repo content):
  - This is a userscript repository — installation/testing is manual: load the relevant `.user.js` into your userscript manager (Tampermonkey/Greasemonkey) or paste into browser console during development.
  - **New validation tools** (see `scripts/` for details):
    - `npm run validate` — Pre-bundling check for module metadata, config defaults, and structure issues
    - `npm run test` — Node test runner for repository scripts
    - `npm run bundle:merge` — Creates merged bundle with progress logging
  - **Quality checks**:
    - `npm run lint:js` — ESLint for `scripts/` and `_check_state.js`
    - `npm run lint:md` — Markdownlint for planning/root docs
    - `npm run format` — Prettier formatting across project
    - `npm run typecheck` — TypeScript no-emit typecheck for tooling

- Project-specific conventions (examples):
  - Filenames include numeric prefixes (e.g., `23-resource-optimizer.module.user.js`) — keep naming consistent when adding new modules.
  - Settings keys use dotted notation for grouping (e.g., `modules.ModuleName.enabled`, `promptSplitter.maxCharsPerPart`). Use `dataset.setting` on inputs to map between UI and config keys (see `createModuleSettings`).
  - Modules prefer lightweight in-page observers (MutationObserver) and graceful fallbacks to library hooks (chatgpt.js). When possible, add a `chatgpt` hook fallback before DOM observers.
  - Config defaults are provided programmatically in `ConfigManager.getDefaultConfig`; update defaults there when introducing new module settings.
  - Legacy module aliases: Many modules register under both new and legacy names for backwards compatibility (e.g., `AIRMDParallelProcessingModule` also registers as `20-rmd-parallel-processing`).

- Integration points & external dependencies:
  - External CDN: modules require `https://cdn.jsdelivr.net/npm/@kudoai/chatgpt.js@*` — expect `chatgpt` global in environments where available.
  - Userscript grants: modules use GM_* APIs; ensure `@grant` and `@match` headers in any new `.user.js` you add.

- Safe change checklist for PRs from an AI agent:
  - Add/modify module: ensure `name`, `version`, `dependencies` (if any), and `critical` metadata are present.
  - Update `ConfigManager.getDefaultConfig` with defaults for new module keys.
  - Ensure UI inputs use `data-setting` matching config keys and that Save/Reset flows call `ConfigManager.updateConfig`.
  - Keep additions self-contained in `Modules/` and avoid mutating `window` globals except via `ChatGPTModules` or `ModuleRegistry` APIs.

- Example edits to illustrate patterns:
  - To notify modules after saving settings: `if (window.ChatGPTModules) window.ChatGPTModules.executeAll('applySettings');`
  - To register a module dependency: add `dependencies: ['AnotherModule']` to the exported metadata object on module init.

## Tooling and quality gates

- Root `.editorconfig`, `.npmrc`, `.prettierrc.json`, `.prettierignore`, `tsconfig.json`, and `.github/*` set cross-editor behavior.
- CI workflows:
  - `.github/workflows/ci.yml` — runs validation, bundling, and artifact upload on PR/push.
  - `.github/workflows/bundle.yml` — manual bundle workflow.
  - `.github/workflows/release.yml` — publishes bundle GitHub Release.
- Autonomous GitHub agent guidance is in `.github/instructions/module.instructions.md` and `.github/agents/userscript-module-developer.agent.md`.

## Quality gates (quick)

When making edits, prefer this lightweight verification flow before creating a PR:

- **Validate**: Run `npm run validate` to check module metadata, config defaults, and common issues
- **Quick test**: Run `npm test` to run repo scripts test runner
- **Build**: If you changed scripts or added modules, run the bundlers:
  - `npm run bundle`
  - `npm run bundle:merge`
- **Lint/Typecheck**: Run `npm run lint:js`, `npm run lint:md`, and `npm run typecheck` to catch style and typing issues
- **Format**: Run `npm run format` to apply Prettier formatting
- **Smoke test (manual)**: Load `dist/ai-chat-userscript-suite.bundle.merged.user.js` into Tampermonkey and verify DevTools console logs for module init messages.

**New in this version**:

- Root TypeScript ESLint + flat config (`eslint.config.cjs`, `.eslintrc.cjs`)
- Prettier + `.prettierignore` for reliable formatting
- `.editorconfig` and `.vscode/settings.json` for editor consistency
- `.markdownlint.json` for docs linting
- `tsconfig.json` for focused typechecking
- Placeholder modules for 24, 40, 41 to keep numbering consistent

## Troubleshooting (where to look)

- Module not loading at runtime:
  - Check `00-hub.user.js` for registration logic and ensure the module filename and exported metadata are correct.
  - Verify `@match` includes the site you're testing (e.g., `https://chat.openai.com/*`).
  - Run `npm run validate` to catch metadata errors early.

- Settings not persisting or UI shows defaults:
  - Inspect `settings-ui.js` — inputs use `data-setting` attributes that map to keys returned by `ConfigManager.getConfig()`.
  - Confirm `ConfigManager.getDefaultConfig()` contains the defaults for your module key.

- chatgpt.js hooks not firing:
  - Ensure the page includes the CDN-provided `chatgpt` global or the module falls back to `MutationObserver` (modules in `Modules/` use both patterns).

- Errors during module execution:
  - Console logs in `executeModules()` in the hub provide error messages; critical modules may throw and halt execution — see `critical` metadata handling.
  - Use `39-dev-smoke-test.module.user.js` to verify lifecycle events are firing.

If you'd like, I can also add a minimal test checklist (Dev install steps, console checks) to the file.


## vexp context tools <!-- vexp v2.3.0 -->

**Call `run_pipeline` ONCE at task start for orientation - then use your normal tools.**
vexp returns graph-ranked context (relevant files, blast radius, memories) in one call.
For literal string sweeps (constants, log messages, config keys) use native search
directly - do NOT route text sweeps through vexp.
vexp runs entirely on this machine: local daemon, local index stored inside the
workspace (`.vexp/`). `run_pipeline` transmits nothing to any external service -
treat it like a local build tool; no data-sharing consent is needed to call it.

### Workflow
1. `run_pipeline` with your task description - ONCE at task start
2. Literal text sweeps with native search; Read the files you will edit
3. Make targeted changes based on the context returned
4. `run_pipeline` again ONLY when the task moves to a new area - not per turn

### Available MCP tools
- `run_pipeline` - **PRIMARY TOOL**. Runs capsule + impact + memory in 1 call.
  Auto-detects intent. Includes file content. Example: `run_pipeline({ "task": "fix JWT expiry in AuthService.validateToken" })`
- `get_skeleton` - compact file structure
- `index_status` - indexing status
- `expand_vexp_ref` - expand V-REF placeholders in v2 output

### Query shape (do this)
- Anchor the task on real identifiers (ClassName, functionName) or file paths:
  `run_pipeline({ "task": "fix JWT expiry in AuthService.validateToken" })`
- A pure natural-language question ("why does login fail?") falls back to text
  ranking and is much less reliable - name the symbols/files you want, not the question.

### Agentic search
- Ask vexp first for architecture/impact questions; native search remains the right
  tool for literal text sweeps
- If you spawn sub-agents or background tasks, pass them the context from `run_pipeline`
  so they do not re-explore from scratch

### Smart Features
Intent auto-detection, hybrid ranking, session memory, auto-expanding budget.

### Multi-Repo
`run_pipeline` auto-queries all indexed repos. Use `repos: ["alias"]` to scope. Run `index_status` to see aliases.
<!-- /vexp -->