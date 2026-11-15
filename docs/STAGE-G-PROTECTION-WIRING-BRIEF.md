# Stage G brief: wire protection evidence into the approve path

- **Status:** ready for implementation
- **Date:** 2026-11-15
- **Owner:** Grok implements; Muse steers, verifies by read-back, holds the merge gate; Eric reviews
- **Protocol:** GitHub files are the only shared memory (cite path + hash, never re-send content); diffs, not prose; batched decisions; one-line vetoes; one no-go vetoes
- **Target repo:** `eric847b/autonomous-github-agent` (AGA), branch `main`
- **Scoped against AGA main:** `236c453770ee164a8bac5013f5a3bce424e228de` (re-verify head before implementing; it moves)

## The gap (from the #573 audits, two independent passes)

Stage E exists and works: `.github/protection_evidence.py` fetches branch
protection and scores it as structured evidence, and its probe workflow runs
green on the self-hosted runner (run 43687490648, success, 2026-11-15).
But **nothing in the promotion path consults it**. `ai_pr_review.run()`
enables native auto-merge after the checks-green and head re-checks without
ever asking whether branch protections exist or are enforced. The only
protection awareness in the approve path is a comment posted *after*
`_enable_auto_merge` already failed.

Second gap: `enforce_admins=false` is only a soft note in
`evaluate_protection`, not a hard fail — so evidence can report `ok: true`
while admins bypass every protection.

## Exact citations (AGA main 236c4537)

- `.github/protection_evidence.py` — blob `54085c9b77012981fa86d5af9c89d0668ce84a83`
  - `fetch_protection` (~L34-61): GETs branch protection; 404/403/3xx all
    return `ok: false` with reasons, never success. Fail-closed by design.
  - `evaluate_protection` (~L63-97): hard-fail reasons today are
    `no_required_status_checks`, `no_required_pull_request_reviews`,
    `force_pushes_allowed`, `deletions_allowed`. `ok` is true only when
    readable with zero reasons.
  - `enforce_admins` soft note (~L97-98): recorded in `notes` as
    `enforce_admins_disabled`, NOT a reason. This is gap 2.
  - `main()` exit codes: 0 ok, 2 incomplete evidence (soft outcome in the
    workflow).
- `.github/ai_pr_review.py` — blob `142a3c187df61de4f9cff769b1feec61a08614ca`
  - `run()` L246-323. Approve path: consensus approve (L288) ->
    `_checks_green` (L289) -> submit APPROVE review (L293) -> head re-check
    (L294-296) -> checks re-check (L297-298) -> `_enable_auto_merge`
    (L299). **The evidence gate goes between L298 and L299.**
  - `_enable_auto_merge` L225-244: GraphQL `enablePullRequestAutoMerge`
    (SQUASH). Already fails closed on GraphQL errors.
  - `_checks_green` L216-222 / `checks_are_green` L193-214: narrow
    carve-outs (skipped dependency-review/scorecard, neutral coderabbit)
    are deliberate; do not touch.
- `.github/tests/test_no_rest_merge.py` — blob `88926ac4730cdd5bd234d66586ef87f7f959424a`
  - Regression test for #573. Must stay green. It is the tripwire against
    reintroducing a REST merge path.

## The change

1. **Gate the auto-merge call on evidence.** In `run()`, after the final
   head re-check and checks re-check and before `_enable_auto_merge`:
   call `protection_evidence.fetch_protection(owner, repo, base_branch)`
   in-process (import it; do not shell out, do not read a file). If
   evidence `ok` is false, do NOT call `_enable_auto_merge`: post a
   COMMENT review stating approve (review only) with the protection
   reasons, and return `auto_merge: false`. Unreadable evidence
   (403/404/exception) already yields `ok: false` — fail closed, no
   special-casing.
2. **Make `enforce_admins=false` a hard fail.** In `evaluate_protection`,
   move it from the soft `notes` list into `reasons`, so `ok` is false
   when admins are not enforced. Keep the reason string stable:
   `enforce_admins_disabled`.
3. **The APPROVE review still posts.** Only the auto-merge enablement is
   gated. Decision (batched, recorded): gating the approval itself was
   considered and rejected — the review is not a merge route, and
   blocking it would lose the review signal. The existing
   "approve (review only)" shape is the model for the gated outcome.
4. **Base branch comes from the PR** (`pr["base"]["ref"]`), never
   hardcoded `"main"`.
5. **No new secrets, no permission broadening.** The evidence fetch is a
   GET with the existing token. No workflow permission changes.

## Tests (required, run locally)

Add or extend tests under `.github/tests/` covering:

- evidence `ok: true` -> auto-merge call proceeds;
- evidence `ok: false` -> no auto-merge call, COMMENT posted, `auto_merge: false`;
- unreadable evidence (403) -> same as `ok: false`;
- `enforce_admins: false` -> `ok: false`.

Run locally: `PYTHONPATH=.github python -m unittest <module> -v`.
The #573 regression test (`test_no_rest_merge.py`, 2 tests) must stay
green. Hosted CI is red account-wide right now (Actions minutes exhausted
until Dec 1) — local verification is the gate; do not wait on hosted runs.

## Acceptance

- Tests green locally; #573 regression test green.
- No REST merge path introduced (the regression test is the tripwire).
- Diff reviewed by Muse by read-back (blob SHA + diff) before merge.
- Merge only on reviewer APPROVE + green, per standing law.

## Division of labor

- Grok: implement on a branch in AGA, open the PR, iterate on review.
- Muse: verify by read-back, hold the merge gate, report to Eric.
- Eric: reviewer, not router.
