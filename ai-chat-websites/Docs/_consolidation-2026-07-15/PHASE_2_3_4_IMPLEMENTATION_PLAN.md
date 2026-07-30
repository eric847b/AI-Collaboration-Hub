# AI Chat Websites - Phase 2, 3, and 4 Implementation Plan

## Current State

- Phase 1 structure and documentation cleanup is complete.
- March 2026 proposal, merge, refinement, and archive sweep notes are now historical material.
- The primary active codebase is `Userscripts/AI Chat Userscript Studio/Userscript Suite/`.
- Repository workflows exist in `.github/workflows/`.
- `Userscripts/package.json` now acts as a thin wrapper around the nested Userscript Suite package.

## Canonical Sources

- Detailed roadmap: `PHASE_2_3_4_IMPLEMENTATION_PLAN.md`
- Executive summary: `IMPROVEMENT_PLAN.md`
- Action queue: `.todo_list.json`
- Historical planning material: `Userscripts/docs/history/2026-03-consolidation/`
- Historical archive artifacts: `Userscripts/archive/2026-03-consolidation/`

## Phase 2 - Build, Testing, and CI Stabilization

### Goal

Make the advertised development workflow real, repeatable, and easy to understand.

### What Exists Today

- [x] The nested Userscript Suite package has working scripts for validation, tests, bundling, linting, formatting, and release tasks.
- [x] CI-related workflow files exist at the repository level.
- [x] The top-level `Userscripts/package.json` scripts now forward to the canonical nested suite.
- [x] Root-level documentation now points to the canonical build entrypoint.
- [x] Husky git hooks configured for pre-commit, commit-msg, pre-push, and rebase protection.
- [x] Bundle stats generation and artifact upload added to CI workflow.

### Success Criteria

- [x] `npm run validate` works from the documented canonical directory.
- [x] CI only calls scripts that actually exist.
- [x] README and planning docs point to one clear build/test entrypoint.
- [x] Git hooks automate quality checks.

## Phase 3 - Configuration and Versioning Cleanup

### Goal

Reduce ambiguity between the collection-level package and the nested Userscript Suite package.

### Current Gaps

- The collection package uses version `2026.03.28.1`.
- The nested Userscript Suite uses version `1.1.0`.
- Ownership of changelog, release cadence, and compatibility guarantees is not clearly documented.

### Immediate Work

1. Decide which package owns releases and semantic meaning for version numbers.
2. Document how collection-level docs and suite-level releases relate to each other.
3. Define which configuration lives at collection scope versus suite scope.
4. Add a short migration note for contributors so version bumps happen in the right place.

### Success Criteria

- One release owner is documented.
- Changelog and release steps are not split across competing sources of truth.
- Contributor docs explain where to change version numbers and why.

## Phase 4 - Advanced Features and Hardening

### Goal

Only resume feature expansion after the build/test/version foundation is trustworthy.

### Keep in Scope

- Security hardening tied to real scripts and modules
- Performance tooling that can be verified in CI or local validation
- Documentation updates for supported advanced features

### Defer Until Phase 2 and 3 Are Stable

- New deployment complexity
- Additional release automation
- Broad platform claims that are not backed by maintained scripts
- Large feature workstreams with no validated build/test path

## Recommended Order

1. Fix the tooling contract at `Userscripts/`.
2. Align CI and release workflows to the real command surface.
3. Unify versioning and configuration ownership.
4. Refresh user-facing docs around the now-stable workflow.
5. Re-open feature expansion and hardening work.

## Exit Conditions for This Plan

This plan is complete when the repository has:

- one canonical development entrypoint,
- one documented release/version owner,
- one maintained set of workflow commands,
- and the March 2026 cleanup history preserved without cluttering active folders.
