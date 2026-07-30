Patch: Utilities consolidation (proposal)

Goal: Ensure a single canonical utilities module and provide adapter stubs for archived duplicates.

Canonical: `AI Chat Userscript Studio/Userscript Suite/Modules/00-utilities.module.user.js`
Archived duplicate: `Utilities/ComprehensiveUserscript.user.js` (moved to `_auto_archive_2026-03-29`)

Proposed non-destructive actions (safe):

1. Create an adapter stub at `Utilities/README_LINK_TO_CANONICAL.md` pointing to canonical utilities and documenting API surface.
2. For consumers that import or reference the old path, create `Utilities/ComprehensiveUserscript.stub.user.js` with a short header that indicates this script was consolidated and references canonical module path.

Example stub content (Utilities/ComprehensiveUserscript.stub.user.js):
// ==UserScript==
// @name ComprehensiveUserscript (stub)
// @description Consolidated. See: AI Chat Userscript Studio/Userscript Suite/Modules/00-utilities.module.user.js
// @run-at document-start
// ==/UserScript==

/* This file is a stub maintaining the old filename for tooling compatibility.
Implementation moved to: AI Chat Userscript Studio/Userscript Suite/Modules/00-utilities.module.user.js
*/

3. Update `AI Chat Websites/Userscripts/README.md` and any index files to replace references to the moved duplicate with the canonical path.

Validation:

- Run `node --check` on changed files.
- Manual smoke test in the browser if desired.

If approved, I will create the adapter stub and update READMEs now. If you prefer, I can instead copy core utilities code into `Utilities/` (destructive) — I recommend the stub approach first.
