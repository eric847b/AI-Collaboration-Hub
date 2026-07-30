Consolidation Index — 2026-03-29

Purpose

- Central index of canonical userscripts, archived duplicates, and compatibility stubs created during the consolidation sweep.

Clusters and canonical mappings

- chatgpt-hub-modules
  - Canonical: AI Chat Userscript Studio/Userscript Suite/00-hub.user.js
  - Archived duplicates: AI Chat Userscript Studio/Userscript Suite/_archive/
  - Stub(s): (none required)

- global-wildcards
  - Canonical (feature): Advanced Features/AI-Powered Universal Automation Suite.user.js
  - Notes: Narrow @match rules where possible; keep a single global security script.

- copilot
  - Canonical: Copilot Scripts/Copilot Automation - Guardian + ROI v16.0.user.js
  - Archived duplicates: AI Chat Userscript Studio/Userscript Suite/Modules/01-automation.module.user.js (moved)
  - Stub(s): AI Chat Userscript Studio/Userscript Suite/Modules/01-automation.module.user.js (compatibility stub)

- utilities
  - Canonical: AI Chat Userscript Studio/Userscript Suite/Modules/00-utilities.module.user.js
  - Archived duplicates: Utilities/ComprehensiveUserscript.user.js (moved)
  - Stub(s): Utilities/ComprehensiveUserscript.stub.user.js

Artifacts created

- duplicate_clusters_2026-03-29.json (full cluster metadata)
- duplicate_clusters_2026-03-29.csv (CSV mapping)
- _auto_archive_2026-03-29/ (moved duplicates)
- archive_report_2026-03-29.json
- archive_duplicates_2026-03-29.ps1 (archiver)
- generate_archive_report_2026-03-29.ps1 (report generator)
- Adapter stubs:
  - Utilities/ComprehensiveUserscript.stub.user.js
  - AI Chat Userscript Studio/Userscript Suite/Modules/01-automation.module.user.js

Recommended next steps

1. Verify runtime behavior for critical domains (e.g., chat.openai.com, copilot.microsoft.com) with the canonical scripts enabled and archived duplicates removed from the active folder.
2. Optionally perform full merges of utility functions into the canonical utilities module, then remove stub placeholders.
3. Update release notes and mark the consolidation in project CHANGELOG.

Contact

- If you want me to proceed with full merges or runtime smoke tests, reply with "merge" or "smoke test".
