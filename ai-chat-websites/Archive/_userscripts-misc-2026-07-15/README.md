# AI Chat Websites - Userscripts

Active userscript collection for this repository.

## Canonical Development Target

The maintained build and test workflow lives in:

`AI Chat Userscript Studio/Userscript Suite/`

That nested package is the source of truth for validation, bundling, tests, linting, and release tooling.

## Convenience Commands

If you are already in `Userscripts/`, the top-level `package.json` now acts as a thin wrapper around the nested suite:

```powershell
npm run validate
npm run verify
npm run bundle:merge
```

These commands forward into:

`AI Chat Userscript Studio/Userscript Suite/`

## Recommended Local Workflow

### From `Userscripts/`

```powershell
npm run install:suite
npm run verify
npm run bundle:merge
```

### Or directly from the nested suite

```powershell
cd "AI Chat Userscript Studio\Userscript Suite"
npm ci
npm run verify
npm run bundle:merge
```

## Main Areas

- `AI Chat Userscript Studio/Userscript Suite/`: canonical source, tests, and bundles
- `Advanced Features/`: standalone feature scripts
- `Copilot Scripts/`: Copilot-specific scripts and notes
- `Utilities/`: compatibility shims and small helpers
- `docs/`: active documentation
- `archive/`: dated cleanup artifacts and generated archive history

## Notes

- Historical consolidation and refinement write-ups were moved into `docs/history/2026-03-consolidation/`.
- Generated bundles belong in the nested suite `dist/` folder.
- The top-level wrapper package is private and should not be published to npm.
- Husky git hooks are installed in the nested Userscript Suite for automated quality checks.
