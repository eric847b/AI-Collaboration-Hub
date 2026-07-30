Consolidation Proposal — 2026-03-29

Completed so far
- Archived duplicate files into `_auto_archive_2026-03-29`.
- Generated `duplicate_clusters_2026-03-29.json` and CSV report.
- Created archiver script (`archive_duplicates_2026-03-29.ps1`) and archive report.

Canonical decisions (selected)
- chatgpt-hub-modules: `AI Chat Userscript Studio/Userscript Suite/00-hub.user.js` (modules = source, `dist` = release)
- global-wildcards: `Advanced Features/AI-Powered Universal Automation Suite.user.js` (narrow matches where possible)
- copilot: `Copilot Scripts/Copilot Automation - Guardian + ROI v16.0.user.js` (canonical Copilot)
- utilities: `AI Chat Userscript Studio/Userscript Suite/Modules/00-utilities.module.user.js` (canonical utilities)
- generator: `AI Chat Userscript Studio/Userscript Suite/Modules/06-userscript-generator.module.user.js` (canonical generator)

Recommended next actions (safe, reversible)
1) Update repo docs to reference canonical files and note archived duplicates (non-destructive) — I can apply this now.
2) Create small adapter stubs for any archived duplicate paths that should remain importable (simple header files that point to canonical code).
3) Merge code where true duplication exists (utilities and Copilot): produce patch files, run syntax checks, and commit.
4) Narrow `@match` for global wildcard scripts; keep a single global security script.

Commands I will run if you approve merge patches
- Create README updates and adapter stubs.
- Produce merge patches and run `node --check` for changed user scripts.

Approval options
- Approve docs+stubs only (safe): I will update READMEs and create adapter stubs for archived paths.
- Approve full merges: I will apply merge patches, run syntax checks, and commit patches (I will prompt before each destructive change).

If no reply, I will proceed with the safe option (docs + adapter stubs) and produce the patches for review.
