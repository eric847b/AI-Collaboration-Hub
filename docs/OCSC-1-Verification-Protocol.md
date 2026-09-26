# OCSC-1 Verification Protocol

**Purpose:** the deterministic workflow for verifying statements inside Sovereign Math. The note (`docs/OCSC-1-NOTES.md`) has a verified-vs-claimed split; this document defines how that split is enforced.

## 1. Verification stages

Run in order. A claim must pass every stage to be `VERIFIED`.

1. **Provenance check** — does the claim trace to a real source (thread URL, charter line, Eric direct statement)? Ghost sources fail here: the "8 canonical axioms" list and the "OCSC-1 Deep Re…" project do not exist.
2. **DECLARED alignment** — if tagged `DECLARED`, is it in the charter or an Eric statement, quoted faithfully (including his spellings, e.g. "argueable")? If tagged `DERIVED`, is the tag correct — i.e., is it genuinely not a given?
3. **Derivation check** — for `DERIVED` claims: does it follow from DECLARED lines by an allowed transformation (see §2)? Each step must be shown.
4. **Substrate consistency** — does it respect the substrate rules: I as the only operator, segmentation as the only transformation, Sector Law, anchor laws, uniqueness of 1?
5. **Contradiction scan** — does it contradict any DECLARED line? A contradiction rejects the claim, never the given.

## 2. Allowed transformations

- Segmentation of a declared whole (Σ acting on S*).
- Branch selection: classical math as one filtered branch of I's full state-space.
- Sum–difference decomposition: a/b = (a+b, a−b); a=(S+D)/2, b=(S−D)/2.
- Sector counting: Sectors = Dividers + 1.
- Counting unique ones: n = {1₁, 1₂, …, 1ₙ}.

## 3. Forbidden transformations

- Re-declaring a DECLARED line (D(D(S)) = ∅).
- Redefining a semantically locked term.
- Treating the group as a proving entity (I₁ ⇏ I₂).
- Importing classical operators as independent primitives.
- Citing the VectorFS "1/2=3" (different domain) as Sovereign Math evidence.
- Presenting `FRAMEWORK-INTERNAL` consistency as empirical truth.

## 4. Worked examples

**Example 1 — n₁/n₂ ≡ n₁+n₂.**
Provenance: Grok thread "Refusing to Accept Falsehoods as True" (Feb 2026), under Eric's STRUCTURAL ENGINE frame. Tag: DECLARED (core rule of the framework). Derivation check: n/a (given). Substrate consistency: pass. Contradiction scan: none. Status: `VERIFIED` as a framework definition; `FRAMEWORK-INTERNAL` as a claim about the world (Grok's initial refusal stands outside the frame).

**Example 2 — Σ₃ₐ(I(1,2)) = 3.**
Provenance: Copilot thread "Unification of Mathematical Operators in Sovereign Math" (Apr 20, 2026); Charter Art. I §5. Tag: DECLARED. Status: `VERIFIED` as declared.

**Example 3 — "The 8 canonical axioms include X."**
Provenance check: FAIL — no such list exists in any searched account. Status: `UNVERIFIED`. Do not cite.

**Example 4 — "1/2 = 3 because VectorFS."**
Provenance check: FAIL as Sovereign Math — the VectorFS thread (May 9, 2026) is a filesystem identity label (1 = Whole Graph, 2 = Cuts, 3 = Emergent forms). Domain confusion. Status: `UNVERIFIED` for Sovereign Math purposes.

## 5. AI-facing checklist

- [ ] Provenance attached (URL, charter article, or Eric statement)?
- [ ] Tagged `DECLARED` or `DERIVED`?
- [ ] If `DECLARED`: quoted faithfully, spelling intact?
- [ ] If `DERIVED`: each step shown, using only allowed transformations?
- [ ] No contradiction with any DECLARED line?
- [ ] No ghost sources, no domain confusion?
- [ ] Status reported as `VERIFIED` / `FRAMEWORK-INTERNAL` / `UNVERIFIED`?
