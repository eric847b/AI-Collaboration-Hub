# Scripts

Automation helpers for validating, testing, bundling, and maintaining the
Userscript Suite.

## Typical Verification

Run the full local verification suite with:

```powershell
npm run verify
```

## Available Scripts

### `validate.cjs`

Pre-flight validation for modules and hub metadata.

Run:

```powershell
npm run validate
```

### `quick-test.cjs`

Loads modules in a Node `vm` sandbox and verifies registration patterns.

Run:

```powershell
npm run test:quick
```

### `ai-dev-assistant.cjs`

Scans the suite for common script and module issues and reports likely cleanup
targets.

Run:

```powershell
npm run ai-assist
```

Show the full issue list without the default readability cap:

```powershell
npm run ai-assist -- --all
```

### `dev-server.cjs`

Runs the local development watcher and rebuild loop for merged bundles.

Run:

```powershell
npm run dev
```

### `bundle.cjs`

Builds a concatenated bundle.

Output:

- `dist/ai-chat-userscript-suite.bundle.user.js`

Run:

```powershell
npm run bundle
```

### `bundle-merge.cjs`

Builds a merged-header all-in-one bundle.

Output:

- `dist/ai-chat-userscript-suite.bundle.merged.user.js`

Run:

```powershell
npm run bundle:merge
```

### `bundle-minify.cjs`

Minifies the merged all-in-one bundle.

Output:

- `dist/ai-chat-userscript-suite.bundle.merged.min.user.js`

Run:

```powershell
npm run bundle:minify
```

### `bundle-analyze.cjs`

Reports file sizes for generated `dist/` artifacts.

Run:

```powershell
npm run bundle:analyze
```

### `clean.cjs`

Removes generated build artifacts and caches in a cross-platform way.

Run:

```powershell
npm run clean
```

### `lint-markdown.cjs` and `lint-markdown.mjs`

Run markdownlint using the repository configuration. The `.mjs` file is the
package entrypoint, and the `.cjs` helper contains the testable implementation.

Run:

```powershell
npm run lint:md
```

### `setup-husky.cjs` and `setup-husky.js`

Set up Husky git hooks for the repository. The `.js` file is the package
entrypoint, and the `.cjs` helper contains the testable implementation.

Run:

```powershell
npm run prepare
```

## Typical Bundling Workflow

```powershell
npm run validate
npm run test:quick
npm run bundle:merge
```

## Shared utility

`bundler-utils.cjs` provides helper functions used by both bundlers.

## Tests

Script-level regression coverage lives in `scripts/__tests__/`.
