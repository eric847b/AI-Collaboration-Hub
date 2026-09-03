# PLAN MAP — "Where Are You Now?"

**Updated:** 2026-09-26
**Purpose:** One index that maps every plan, roadmap, todo, and progress file in this repository, declares its status, and cross-references its siblings so no plan ever gets lost, duplicated, or conflicting again.

---

## How to Read This Map

- Every tracked file has a row below. `STATUS` tells you whether it is the live plan to follow (`ACTIVE`), a finished/superseded record (`SUPERSEDED`), or reference material (`HISTORICAL`).
- `SCOPE` names which product/area that file governs.
- `SEE ALSO` names the sibling files you should look at next (relative to that file's own folder).

---

## ACTIVE Plans (follow these)

| # | File | Scope | Status | See Also (relative) |
|---|------|-------|--------|---------------------|
| 1 | `Userscripts/AI Chat Userscript Studio/Userscript Suite/ROADMAP.md` | **Userscript Suite** module feature queue (386 items, 357 modules on disk, 75 done) | ACTIVE — single source of truth for suite modules | `../ROADMAP.md` header → `PLAN_MAP.md` at repo root (`../../../PLAN_MAP.md`①, `NEXT_100_SUGGESTIONS_ARCHIVED.md` (superseded list) |
| 2 | `next_year_roadmap.md` | **Unified AI Assistant Suite** trajectory v2.1.0 → v3.0.0 (2026-07 → 2027-07) | ACTIVE | `Userscripts/docs/INDEX.md`、`Userscripts/README.md`、`.todo_list.json` |
| 3 | `.todo_list.json` | **Unified AI Assistant Suite** action queue (task-level) | ACTIVE | `next_year_roadmap.md`、`Userscripts/docs/INDEX.md` |
| 4 | `Userscripts/docs/INDEX.md` | **Unified AI Assistant Suite** docs & architecture index | ACTIVE | `../next_year_roadmap.md`、`../README.md` |
| 5 | `Userscripts/README.md` | **Userscripts folder** entry/landing | ACTIVE — folder landing | `docs/INDEX.md`、`docs/OVERVIEW.md`、`AI Chat Userscript Studio/Userscript Suite/README.md` |
| 6 | `CHANGELOG.md` (repo root`) | Unified AI Assistant Suite changelog | ACTIVE — living record | `Userscripts/CHANGELOG.md` (duplicate copy — see note) |
| 7 | `Userscripts/CHANGELOG.md` | Unified AI Assistant Suite changelog | ACTIVE — living record | `../CHANGELOG.md` (duplicate copy — see note) |

> **NOTE (duplication):** `CHANGELOG.md` exists at both repo root and `Userscripts/` with same content (7694/7696 B). One of the two should eventually be deleted andthe other pointed-to; this map records the duplication so it is not silently lost.

---

## SUPERSEDED Plans (do not follow)

| # | File | Scope | Was Replaced By |
|---|------|-------|------------------|
| 8 | `Userscripts/AI Chat Userscript Studio/Userscript Suite/NEXT_100_SUGGESTIONS_ARCHIVED.md` | original 100-suggestion list | `ROADMAP.md` (restructured + marked-off version) |
| 9 | `Userscripts/docs/Focus_Chain_List_v1.2.0.md` | v1.2 implementation chain | Complete per CHANGELOG;historical |
| 10 | `Userscripts/docs/Focus_Chain_List_v1.4.0.md` | v1.4 implementation chain | Complete per CHANGELOG;historical |
| 11 | `Userscripts/docs/IMPROVEMENTS_v1.1.0.md` | v1.1 improvements recap | Historical record |
| 12 | `next_improvement_prompt.md` | v1.3 "next improvements" checklist | Mostly complete per `next_year_roadmap.md`;kept as history |
| 13 | `.todo_list.json` entries for v1.4/2.1 work | task records | Superseded by `.todo_list.json` current `next_actions` |

---

## HISTORICAL Reference (read-only)

| # | Location | Contents |
|---|----------|---------|
| 14 | `Docs/_consolidation-2026-07-15/` | July 2026 root cleanup: `PHASE_2_3_4_IMPLEMENTATION_PLAN.md`, `IMPROVEMENT_PLAN.md`, `motivational-prompt.md` |
| 15 | `Archive/_userscripts-misc-2026-07-15/docs/history/2026-03-consolidation/` | 12 files — March 2026 consolidation proposals/summaries/plan |
| 16 | `Userscripts/docs/history/2026-03-consolidation/` | same 12 files — **duplicate copy** of #15 |
| 17 | `Userscripts/AI Chat Userscript Studio/Userscript Suite/CONSOLIDATION_REPORT.md` | suite hub delegation consolidation report |
| 18 | `Userscripts/AI Chat Userscript Studio/Userscript Suite/IMPROVEMENT_SUMMARY.md` | suite improvement recap |
| 19 | `Userscripts/AI Chat Userscript Studio/Userscript Suite/FUTURE_MODULES_README.md` | future-modules generation guide |
| 20 | `Userscripts/AI Chat Userscript Studio/Userscript Suite/Modules/ARCHIVE_SUMMARY.md` | module archive cleanup record |

> **NOTE (duplication):** #15 and #16 hold the same March 2026 files in two places. Keep both (one is the archive-of-record, the other is the working history folder); this map records the overlap.

---

## Version Claims Reconciliation

The Unified Suite version claims conflicted across files. Authoritative trajectory: `next_year_roadmap.md` = **v2.1.0**.

| File | Old Claim | New (aligned) |
|------|-----------|------------------|
| `Userscripts/README.md` | v1.2.0 | **v2.1.0** |
| `Userscripts/docs/INDEX.md` | v1.9.0 | **v2.1.0** |
| `.todo_list.json` | v2.1.0 | v2.1.0 (consistent) |
| `next_year_roadmap.md` | v2.1.0 | v2.1.0 (authoritative) |

---