# OCSC-1 API for AI

**Purpose:** the protocol spec for AI collaborators (Muse, Grok, Copilot, and others) interacting with the Sovereign Math / OCSC-1 knowledge layer in this repo. This is an interface, not doctrine — it tells collaborators how to read, write, and verify against the layer. Doctrine itself lives in `docs/Declaration-of-Sovereign-Math.md`; background in `docs/OCSC-1-NOTES.md`.

## 1. Input format — how to present a claim

Every claim submitted to the layer must carry three fields:

1. **Statement** — the claim in plain language, with terms used exactly as defined in the glossary (`docs/OCSC-1-NOTES.md` Appendix B / `docs/OCSC-1-Glossary-Extended.md`).
2. **Tag** — `DECLARED` (a given, fixed in meaning at first writing) or `DERIVED` (follows from givens by an allowed transformation). No claim may be untagged.
3. **Provenance** — where it comes from: a thread URL, a charter line, an Eric direct statement, or "new — proposed by <agent>".

Example:

> **Statement:** Σ₃ₐ(I(1,2)) = 3
> **Tag:** DECLARED
> **Provenance:** Copilot thread "Unification of Mathematical Operators in Sovereign Math" (Apr 20, 2026); Charter Article I §5.

## 2. Output format — how to answer from the layer

1. Tag every substantive line `DECLARED` or `DERIVED`.
2. State provenance for every `DECLARED` line (charter article, thread, or Eric statement).
3. End with a **verification status**: `VERIFIED` (matches the protocol in `docs/OCSC-1-Verification-Protocol.md`), `FRAMEWORK-INTERNAL` (consistent with the system, not independently checkable), or `UNVERIFIED` (cannot be checked).
4. Never present a `FRAMEWORK-INTERNAL` or `UNVERIFIED` claim as established fact.

## 3. Allowed queries

- "What does the layer declare about X?" → answer from DECLARED lines with provenance.
- "Does Y follow from the givens?" → run the verification protocol; answer `VERIFIED` / not.
- "Is claim Z consistent with the substrate?" → contradiction scan against DECLARED lines.
- "What is the history of concept C?" → answer from `docs/OCSC-1-Development-History.md`.

## 4. Error modes

- **Contradiction with a DECLARED line:** the claim is rejected. DECLARED lines are never revised; the claim must be re-tagged or withdrawn.
- **Undefined operator:** any operator other than I, segmentation, or their declared modes is undefined in the substrate. Classical operators are segmentation-modes of I, not independent primitives.
- **Substrate violation:** division by zero as "undefined," re-declaration of a DECLARED line (D(D(S)) = ∅), or treating the group as a proving entity.
- **Domain confusion:** the VectorFS "1/2=3" (a filesystem identity label: 1 = Whole Graph, 2 = Cuts, 3 = Emergent forms) is a different domain. Never cite it as Sovereign Math evidence.
- **Ghost sources:** the "8 canonical axioms" list and the "OCSC-1 Deep Re…" project do not exist in any searched account. Never cite them.

## 5. Cross-repo hooks

Other repos consume this layer read-only:

- Reference concepts by glossary term + charter article (e.g., "per Charter Art. I §4, Sectors = Dividers + 1").
- Do not duplicate doctrine into other repos; link back to this repo's `docs/`.
- If a repo needs a new DECLARED line, it must be declared by Eric first (one-time, non-repeatable), then recorded here — never invented by a collaborator.

## 6. Standing rules for collaborators

1. The verified-vs-claimed split in `docs/OCSC-1-NOTES.md` is load-bearing. Never blur it.
2. Copilot's/Grok's in-conversation enthusiasm ("brand-new," "proven") is conversational validation, not verification. Record it as the model's claim, not as fact.
3. Eric's direct statements are the highest authority in the layer; AI formalizations are faithful elaborations, explicitly labeled as such.
4. When in doubt, cite provenance and mark `UNVERIFIED` rather than smoothing over a gap.
