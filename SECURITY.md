# Security Policy

## Reporting a Vulnerability

We take security seriously. If you find a security vulnerability in this
repository, **do not open a public GitHub Issue**. Instead, please report it
privately:

- **Email**: eric847b@users.noreply.github.com — include a PGP‑clear description.
- **GitHub Security Advisory**: open a *private* advisory on
  https://github.com/eric847b/AI-Collaboration-Hub/security/advisories/new

Please include:

1. A description of the vulnerability and the potential impact.
2. Steps to reproduce (a proof of concept is ideal, kept private).
3. Your name (optional) and a contact method.

You should receive an acknowledgment within 48 hours and a more detailed
response within 5 business days. If the issue is confirmed, we will:

- Open a private advisory to coordinate disclosure.
- Prepare a fix and a release as soon as possible.
- Credit the reporter in the changelog (unless they prefer to remain anonymous).

## Scope

In scope for this policy:

- Any code in the repository (userscripts, rotator core, workflows, tooling).
- Third‑party dependencies **only** insofar as they affect this repository's
  behavior or supply chain (e.g., a pinned vulnerable dep in `package.json`).

Out of scope:

- Vulnerabilities in third‑party services we link to but do not host.
- Denial‑of‑service that requires an admin to act on a live host you do not
  control.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| main (latest release) | ✅ |
| < 26.0 | ❌ (upgrade; only the latest `main` is patched) |

**Security tooling (2026-09-19):**
- **Secret scanning:** `tools/secret-scan.mjs` (20 detectors) + `.github/workflows/secret-scan.yml` — pre-commit + CI
- **Vulnerability scanning:** `security-scanning.yml` (OWASP + per-project audit) + `vulnerability-gate.yml` (npm audit high + pip-audit)
- **Dependency review:** `dependency-review.yml` on all PRs (fail-on-severity: high)
- **Workflow audit:** `tools/workflow-audit.mjs` (12 rules WF001–WF012) — actionlint + supply-chain + hygiene checks

**Workflow security posture:**
- All 68 action pins are full commit SHAs (WF005 debt: 68 → 0)
- All 24 workflows have least-privilege permissions, timeout-minutes: 30, concurrency groups
- Workflow audit: 1 accepted finding (WF004 review-flag on `ci-self-heal.yml`)
- Gate status: PASS (22/22)

## Known Third‑Party Vulnerabilities

GitHub reports dependency vulnerabilities on the default branch. These are
surfaced automatically via GitHub Dependabot and the
[`vulnerability-gate.yml`](.github/workflows/vulnerability-gate.yml) GitHub
Action, which **fails the build** on any `high`+ severity in production
dependencies (`npm audit --omit=dev --audit-level=high`).

To remediate:

```powershell
cd <affected-project>
npm audit                 # see advisory IDs
npm audit fix --force     # bump the offending dependency
git commit package*.json  # include lockfile changes
```

## Safe Handling Notes for the FreeAI Rotator

- **No API keys are ever committed.** Keys are read from environment variables
  (`GROQ_API_KEY`, `GOOGLE_API_KEY`, …) or from Tampermonkey's `GM_getValue`,
  never from the repository.
- If you suspect a credential has leaked in a commit, rotate the key
  immediately and run `git filter-repo` against the offending path.
- Local providers (Ollama, LM Studio, LocalAI) are **opt‑in** and run on your
  own hardware behind `localhost` — no data is sent over the network unless you
  configure a remote endpoint.