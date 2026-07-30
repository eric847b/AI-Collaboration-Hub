Patch: Copilot consolidation (proposal)

Goal: Ensure Copilot logic exists in one canonical file and remove duplicate handlers from the Studio module.

Canonical: `Copilot Scripts/Copilot Automation - Guardian + ROI v16.0.user.js`
Archived duplicate: `AI Chat Userscript Studio/Userscript Suite/Modules/01-automation.module.user.js` (moved to `_auto_archive_2026-03-29`)

Proposed steps (safe-first):

1. Create `Copilot/README_LINK_TO_CANONICAL.md` documenting canonical Copilot script and listing removed duplicates.
2. Inspect `Copilot Automation - Guardian + ROI v16.0.user.js` for public helper functions that may be duplicated in the Studio module; create a single "exports" region (commented) to indicate public API.
3. If Studio module contains unique helper code, extract it into the canonical Copilot file or into `Modules/00-utilities.module.user.js` as appropriate.
4. Update Studio module to import/use canonical Copilot functions (or add a small stub that references canonical Copilot).

Validation:

- Run `node --check` on updated scripts.
- Run a browser smoke test on Copilot domain (`https://copilot.microsoft.com/*`).

If approved, I will create the README stub and proposed in-repo patches for review. I will not delete or overwrite anything without an explicit confirmation step.
