# AI Guardian Suite — Operator & Maintainer Guide

> Handoff doc for the AI Guardian expansion: quota-saving stack, idle compute, attention economics,
> go/no-go cost decisioning, tool routing, the dense all-in-one bundle, and the gated tooling chain
> with push-triggered CI. Authored at end of the session that produced `Modules/21–26` + `dist/`
> bundle + CI.

## 1 · The product vision (what this session was building toward)

This was never "a tool for chat websites." It is a **resource-sovereignty layer for AI-era
browsing**:

> Your tokens, attention, and idle compute are finite, valuable assets. The AI Guardian Suite
> accounts for every one of them — conserves, earns, taxes, judges, and returns them to OWNERSHIP of
> the user, not the platform. It runs on **every** page (`@match *://*/*`), not on any one chat-AI
> site.

Free-tier AI quotas are not unlimited; the suite treats that scarcity as the whole point and makes
every interaction priced, budgeted, and _worth it_.

## 2 · The nine actions the suite performs

| Action                | Pillar               | Module / API                                 | Ctrl+Alt |
| --------------------- | -------------------- | -------------------------------------------- | -------- |
| **Account**           | Token Quota Guard    | `21-Quota-Saving/901` · `window.tqg_api`     | —        |
| **Conserve (input)**  | Prompt Compressor    | `21/902` · `window.pcp_api`                  | `A`      |
| **Conserve (input)**  | Duplicate-Send Guard | `21/903` · `window.dsg_api`                  | —        |
| **Conserve (output)** | Response Budgeter    | `21/904` · `window.rlb_api`                  | `B`      |
| **Earn**              | Idle Dev Miner       | `22-Idle-Compute/001` · `window.dcp_api`     | —        |
| **Tax**               | Attention Tollbooth  | `23-Attention-Toll/001` · `window.atoll_api` | `T`      |
| **Total / Judge**     | Supreme Court        | `24-Supreme-Court/001` · `window.sc_api`     | `D`      |
| **Decide**            | Cost Advisor         | `25-Cost-Advisor/001` · `window.advice_api`  | `G`      |
| **Route**             | Tool Router          | `26-Tool-Router/001` · `window.router_api`   | `R`      |

Supporting runtime: `Modules/00-Core/000-site-adapter.module.user.js` (`window.UniversalSite`).

## 3 · The dense bundle

`dist/AI-Guardian-Suite.user.js` — hand-tuned single-file delivery of all pillars: quota guard,
compressor, duplicate-guard, budgeter, miner, tollbooth, advisor, router, and the Supreme Court
(which now totals routing spend too). One install. Public APIs on `window.*`; test internals on
`window.__gs_internals` (**testing only**). Densification is where silent regressions hide — the
harness suite is mandatory.

### The Global Wallet (storage layer — bundle v2026.08.27.13+)

All ledger, budget, and toll state persists through one wallet kernel. When
`GM_getValue`/`GM_setValue` are available (the bundle grants them) every write goes to GM storage
and reads are GM-first with **read-through LS→GM migration** — existing localStorage ledgers carry
over automatically and key-agnostically, then LS is left untouched. Without a GM context (e.g. the
Node harnesses) it runs byte-identical localStorage mode. `gs_api.meta().storage` reports `'gm'` or
`'local'`. Because GM grants sandbox the script, the public APIs are mirrored to `unsafeWindow` so
page-context consumers and sibling scripts still reach them. The read path uses explicit null
checks, not falsy coercion — a stored `0` (Response Budgeter OFF) reads back as `0`, not as the
default cap.

## 4 · Verification & gates

| Command                | Proves                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run validate`     | all userscripts parse + repo configs                                                                                                                                                                                                                                                                                        |
| `npm run check:suite`  | eight regression harnesses green (`scripts/suite-check.cjs`)                                                                                                                                                                                                                                                                |
| `npm run build:bundle` | dense bundle honors every module contract (`scripts/build-bundle.cjs`)                                                                                                                                                                                                                                                      |
| `npm run release`      | chained release gate (`scripts/release.cjs`) — exit 0 only if all pass                                                                                                                                                                                                                                                      |
| **CI**                 | monorepo-root `.github/workflows/ai-guardian-suite-ci.yml` — runs `build:bundle → check:suite → validate` on every push/PR touching `ai-chat-websites/Userscripts/**` (the suite-local `.github/workflows/suite-ci.yml` is a portable copy — inert inside a monorepo, where GitHub only reads workflows from the repo root) |

### The harnesses (`scripts/__tests__/`)

`_quota` · `_idle-miner` · `_response-budget` · `_tollbooth` · `_supreme-court` · `_advisor` ·
`_router` · `_guardian` (dense-bundle contract test, 104 assertions — includes the Global Wallet: GM
routing, LS→GM migration, unsafeWindow mirroring). All boot a mock DOM/localStorage in a `vm` and
assert on the public API. Adding a module → add a harness → list it in `suite-check.cjs`.
