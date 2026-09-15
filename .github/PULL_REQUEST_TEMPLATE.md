## What

<!-- One-paragraph summary. Link the issue or ROADMAP item this closes. -->

## Why

<!-- Problem / motivation. Which `docs/ROADMAP.md` item does this serve? -->

## How tested

- [ ] `npm run gate` passes locally (or `node --check` + `actionlint` for tool/workflow-only PRs)
- [ ] Docs updated (`docs/ROADMAP.md` / `docs/STATUS.md`) if workspace state changed
- [ ] Fleet mirrors: `node tools/sync-parity.mjs check` still reports parity (if standalone repos touched)

## Checklist

- [ ] No secrets committed (keys live in provider settings / Actions secrets)
- [ ] No other agent session's unstaged work included
- [ ] `tools/*.ps1` derive paths from `$PSScriptRoot`
- [ ] No bare `:` in new workflow step names; no `npx` in hooks
