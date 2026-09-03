# AI Chat Websites - Legacy Archive

This folder stores legacy scripts, notes, exports, and workspace snapshots kept for reference only. Nothing here is considered the current source of truth.

## Current Source of Truth

- Active repository roadmap: `../PHASE_2_3_4_IMPLEMENTATION_PLAN.md`
- Active collection workspace: `../Userscripts/`
- Historical March 2026 planning notes: `../Userscripts/docs/history/2026-03-consolidation/`
- Historical March 2026 archive artifacts: `../Userscripts/archive/2026-03-consolidation/`

## Structure

- `snapshots-and-notes/`: text exports, research notes, and legacy planning fragments
- `legacy-scripts/`: old userscripts, loose JavaScript files, and code snapshots
- `workspace-config/`: workspace files and misc local config artifacts
- `packages/`: zipped exports and packaged downloads
- `duplicates/`: exact duplicates retained only for provenance
- `userscript-bin-2026-09/`: loose root files and inert placeholders archived on 2026-09-26

## Dated Archive Bins

Bins prefixed with a date (e.g. `userscript-bin-2026-09/`) hold files swept from repo roots during cleanup sweeps. Files are moved with `git mv` to preserve history, and inert placeholders keep original names discoverable.

## Duplicate Handling

The following exact duplicates were separated during cleanup:

- Canonical note kept in `snapshots-and-notes/1 - Prompt Splitter - AI RMD - 10.05.2024.txt`
- Duplicate filename variant moved to `duplicates/1- Prompt Splitter - AI RMD - 10.05.2024.txt`
- Canonical text snapshot kept in `snapshots-and-notes/ChatGPTJS.txt`
- Exact duplicate copy moved to `duplicates/Untitled-3.coffee`

## Archive Rules

- Do not build, release, or validate from this folder.
- Keep original filenames unless a move is needed to avoid collisions.
- Put new legacy material into the closest matching category instead of the archive root.
