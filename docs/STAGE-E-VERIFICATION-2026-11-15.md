# Stage E verification — 2026-11-15 (Muse read-back)

Independent verification of the stage-E report and the overnight results,
checked against live GitHub state by Muse (the lane that did not produce
them). All claims below were verified by API read-back, file fetch, or
local reproduction — not by trusting the report.

## Verified: the stage-E report is accurate

| Claim | Evidence |
|---|---|
| Protection evidence run 43687490648 succeeded on self-hosted | Run API: `completed / success`, head 236c4537, 06:55:06Z |
| The probe returned 403 fail-closed | `docs/AUTONOMY_NORTH_STAR.md` L49–66 (commit 643c4365) records the exact JSON: `http_status: 403`, `ok: false`, `readable: false`, `reasons: ["protection_unreadable_403_fail_closed"]` |
| #581 regression test landed on main | Commit 63c4e3c9, `.github/tests/test_sigma_extensions.py` +26/-0 — the same file and diff size as PR #581 |
| North-star doc updated with the live result | Commit 643c4365, `docs/AUTONOMY_NORTH_STAR.md` +22/-2 |
| Hosted minutes exhausted, prefer self-hosted | Confirmed; PR #582 (reroute) merged 11:28Z |

## Correction: the E → F/G blocker is the token's scopes, not the plumbing

The report frames the blocker as "need a read path that can see protection
(e.g. classic PAT / admin-read scope)". That read path is **already the
configuration**:

- `protection_evidence.py` `_token()` returns `GH_FULL_PAT` first,
  `GITHUB_TOKEN` only as fallback.
- `protection-evidence.yml` passes both into the job env.
- Both files are **byte-identical** at 236c4537 (the run's ref) and at
  current main — the 403 came from `GH_FULL_PAT` itself.

`GH_FULL_PAT` is a classic PAT, and it 403s on the branch-protection read.
So the next step is not "get a classic PAT" — it is to fix the token:

1. **Regenerate/verify `GH_FULL_PAT` with full `repo` scope**
   (which covers administration read). This is Eric's step — the token
   is his. Note it closes two gaps in one regeneration: the same token
   is already proven to lack `notifications` scope (Inbox Auto Cleanup
   403s), so one new token with `repo` + `notifications` fixes both.
2. **Or** mint a dedicated fine-grained PAT with `Administration: read`
   on `autonomous-github-agent` only, used just for this probe
   (least privilege; the probe is read-only).

Until one of those lands, re-running the probe will keep returning 403 —
the plumbing is proven correct, the credential is the whole gap. Do not
treat the 403 as a green light; the north-star doc's interpretation
(fail-closed, autonomous promote stays off) is correct.

## Verified: overnight results

- **AGA PR #582 merged** 11:28Z (merge commit b9a12527). All four main
  blobs match the reviewed PR blobs byte-for-byte. The moved checks:
  Verilog Parity SUCCESS, Synthesis Parity SUCCESS, Autonomy Security
  FAILURE — see the zizmor note below.
- **VectorFS PR #60 merged** 11:30Z (merge commit 9fb30bee).
  `cas/node_identity.{h,cpp}` are on main.
- **AGA PR #581 is now redundant** (still OPEN): its test landed on main
  directly as 63c4e3c9. His lane to close, same pattern as #577/#578.
- **AGA main is now 643c4365.** Three commits landed 11:28–11:33Z:
  #582 merge, the #581 test, the stage-E evidence doc, plus
  `docs(autonomy): define zero-cost self-funding contract (#570)`.

## Zizmor: diagnosed and fixed (PR #584)

The Autonomy Security `workflow-security` job failed deterministically on
the self-hosted runner (runs 43689463312, 43709465934 attempts 1–2): the
`Audit workflows` step ran **0 seconds** — zizmor never started. A re-run
of the failed jobs reproduced the same 0s failure, so it is not transient.

Ruled out by local reproduction (zizmor 1.32.0, the exact version the
action's lockfile pins, exact CI flags, exact main-tree files): **exit 0,
zero findings** at medium/medium. All 12 pinned action SHAs were verified
against their tags and the 3 uncommented SHAs resolve, so the online
`artipacked` audit is clean too. The failure is in the action's setup:
`zizmor-action` installs via `python3 -m pip download`, and this runner
already shows `python3 -m pip` is unreliable here (`green-pr-merger.yml`
tolerates its failure with `|| true`; `ci.yml` uses `python -m pip`).

**Fix — AGA PR #584** (Muse, reviewed by read-back, merge on green):
replace the action step with a direct run of the zizmor 1.32.0 release
binary, SHA-256-verified, same audit settings, `GH_TOKEN` passed for
online audits. Also fixes a real YAML syntax error in the dormant
composite action (`.github/actions/autonomous-agent/action.yml:47` —
a plain scalar containing `: `), which made zizmor warn and skip the
file. The PR's own `workflow-security` run is the live test.

## What remains for F/G

1. Token scopes (Eric's step — see above). Nothing else unblocks the
   `ok: true` protection read.
2. PR #584 green, then merged — restores the zizmor check.
3. Stage-G implementation from `docs/STAGE-G-PROTECTION-WIRING-BRIEF.md`
   (Grok's lane; brief live on main since PR #929).
4. PR #581 closed as redundant (his lane).

## Method note (for the next verification)

- The connector token 403s on job logs and check-runs; step-level timing
  from the jobs API (`started_at`/`completed_at` per step) is what
  exposed the 0s failure. When a step fails in 0s, the tool never ran —
  look at setup, not findings.
- A local zizmor run needs the same version the action's lockfile pins
  (`support/locks/zizmor-latest.txt` in `zizmor-action` at the pinned
  SHA), or the comparison is meaningless.
