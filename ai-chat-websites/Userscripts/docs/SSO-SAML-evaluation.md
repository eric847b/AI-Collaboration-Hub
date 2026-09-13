# SSO / SAML Integration — Evaluation (Q2 2027 #16)

> Status: **evaluation complete.** Recommendation deferred to enterprise demand;
> no code shipped yet. This document is the deliverable for the
> "SSO/SAML integration (evaluate)" roadmap item.

## What was evaluated

Three ways to authenticate users of the suite's shared/collaborative surfaces
(the Team Collab workspace, the plugin marketplace, and the v3 API server):

1. **SAML 2.0 (SP-initiated)** — the enterprise standard for identity providers
   (Okta, Azure AD, Google Workspace, Entra ID).
2. **OIDC / OAuth 2.0 (Authorization Code + PKCE)** — the modern default for
   consumer + developer workflows.
3. **API-key / bearer tokens (status quo)** — what `api-server.js` offers now.

## Constraints discovered in this codebase

| Constraint | Impact |
|------------|--------|
| Userscripts run in-page with no secure backend origin of their own | Any SSO flow needs a **relay endpoint** (the API server or a static host) to complete the SAML/OIDC assertion |
| Self-hosted / local-first posture (privacy-first monitoring, local storage only) | Avoids forcing third-party identity providers on offline users |
| Extension + desktop (Tauri) surfaces | Each surface needs its own Auth session bridge; the Tauri shell could hold tokens securely in OS keychain |
| No secrets in the repo | Any IdP client secret must be encrypted (Actions secrets / providers.json), never committed |

## Recommended approach (when/if demand confirms)

- **Primary: OIDC Authorization Code + PKCE** (lighter than SAML, works for
  the extension popup + desktop + web surfaces, well-supported by all major IdPs).
- **Secondary: SAML 2.0 SP-initiated** only for enterprises that require it,
  terminated at the v3 `api-server.js` `/auth/sso` endpoint with a signed
  relay-state round-trip.
- **Local-first fallback**: keep the existing bearer-token path for self-hosted
  instances with no IdP; SSO is an overlay, not a replacement.

## Effort estimate (if greenlit)

- OIDC+PKCE minimal flow: ~2-3 days (auth routes, session store, popup bridge)
- SAML SP-initiated + metadata endpoint: ~3-5 days (XML assertion parsing,
  signature verification — must avoid a second SAML implementation; use a
  maintained library, `saml-js`/`passport-saml`)
- SSO consent UI + per-workspace role mapping into `v3/rbac.js`: ~2 days

## Open questions to resolve before implementation

- Which IdP(s) do the first enterprise users actually use? (Okta vs Entra vs Google)
- Should SSO sessions inherit the RBAC roles already defined in `v3/rbac.js`?
  (Recommended: yes — map IdP groups → RBAC roles.)
- Does the marketplace need SSO-gated publishing, or is read access enough at launch?

## Conclusion

SSO/SAML is **not built now** — it would add a hosted surface this project
deliberately avoids at v2.4/v3.0, and no user has requested it yet. The project
keeps the door open: `v3/rbac.js` already models roles, `v3/api-server.js`
already owns an HTTP surface where a `/auth/sso` handler would slot in, and the
passwordless/local-first default remains unchanged. Revisit when the first
enterprise collaborator arrives.