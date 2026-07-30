# AI Chat Websites

Private workspace for AI chat userscripts, modular suite development, legacy archives, and planning docs.

## Start Here

- Active collection: `Userscripts/`
- Canonical development package: `Userscripts/AI Chat Userscript Studio/Userscript Suite/`
- Current roadmap: `PHASE_2_3_4_IMPLEMENTATION_PLAN.md`
- Short planning index: `IMPROVEMENT_PLAN.md`
- Active task queue: `.todo_list.json`
- Legacy reference material: `Archive/`
- Build and validation: `scripts/`
- Module tests: `tests/`
- MCP automation: `task-mcp/`

## Recommended Development Workflow

The canonical build and test entrypoint is the nested Userscript Suite package:

```powershell
cd "Userscripts\AI Chat Userscript Studio\Userscript Suite"
npm install
npm run validate
npm run test
npm run bundle:merge
```

### Root-level scripts

The root `package.json` also exposes convenience scripts that operate on the modular source tree:

```powershell
npm run build
npm run validate:modules
npm run check:deps
```

## Repository Layout

- `.github/`: GitHub workflows, templates, and repo guidance
- `Userscripts/`: active userscript collection and docs
- `Userscripts/modules/`: modular source files for `Unified-AI-Assistant-Suite.user.js`
- `Userscripts/plugins/`: standalone plugin extensions
- `Userscripts/docs/`: user and developer docs, including history
- `scripts/`: build, validation, and dependency checking scripts
- `tests/`: shared test fixtures and templates tests
- `task-mcp/`: MCP server automation for project management
- `Archive/`: legacy scripts, notes, duplicates, and workspace snapshots
- `Docs/`: planning and consolidation docs
- `PHASE_2_3_4_IMPLEMENTATION_PLAN.md`: detailed roadmap
- `IMPROVEMENT_PLAN.md`: short planning index

## Architecture

The suite is organized around a central hub that manages modules through a registry pattern.

### Core Components

- **Hub (`00-hub.user.js`)**: Central orchestrator providing:
  - `ModuleRegistry`: Module registration, dependency resolution, and lifecycle
  - `ConfigManager`: Centralized configuration with persistence
  - `ServiceContainer`: Dependency injection with singleton support
  - `EventBus`: Decoupled event-driven communication
  - `ErrorHandler`: Retry logic, circuit breaker, and error wrapping
  - `PerformanceMetrics`: Load time and operation metrics
  - `ThemeManager`: Dark/light theme persistence
  - `PlatformAdapters`: Abstraction for ChatGPT, Claude, Poe, etc.

- **Settings UI (`settings-ui.js`)**: Accessible configuration interface with tabs, keyboard nav, and import/export

- **Modules (`Modules/`)**: Self-contained feature modules following a standard pattern with `init()`, `execute()`, and `destroy()` lifecycle methods

### Data Flow

1. Hub initializes first and provides core services
2. Modules register with `ModuleRegistry` or fallback APIs
3. Dependencies are resolved and modules initialize in order
4. EventBus enables cross-module communication
5. ConfigManager handles settings with per-module overrides

## Notes

- The top-level `Userscripts/package.json` forwards workspace commands to the canonical nested Userscript Suite package.
- Versioning is unified under suite package `2.1.0`.
- New module range validated through 41; placeholders added for 24, 40, 41.
- The `modules/` tree is the source of truth for the built userscript; `scripts/build-userscript.js` assembles it.
- `scripts/validate-modules.js` and `scripts/check-dependencies.js` provide module-level validation.
- `tests/` and `task-mcp/` are merged from the broader Userscripts workspace for autonomous validation.
