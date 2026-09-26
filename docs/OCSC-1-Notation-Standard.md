# OCSC-1 Notation Standard

**Status:** `PROPOSED` — implements the metalanguage/declaration split from the Zero–One refinement (§4) and the "=" marking convention recommended there. It becomes doctrine only if Eric declares it. Until then, it is a drafting standard for the records.

## The three levels

Every statement in the records lives on one level:

- **Level 0 — Metalanguage.** Ordinary English and common-meaning mathematics. Here "=" means common equality, words mean what they commonly mean. The common-meaning rule governs.
- **Level 1 — Declarations.** D-locked statements: operators and laws fixed by declaration (I, Σ₃ₐ, Σ₃ᵦ, the anchor laws, the charter). Here "=" between a declared operation and its output denotes the *declared result* — valid inside the declared system, not a claim about common arithmetic.
- **Level 2 — Derivations.** Statements derived from Level 1 via allowed transformations (Verification Protocol). Inherit the level of their premises.

## The "=" convention

- `=` **unadorned, Level 0:** common-meaning equality. Example: "2 + 2 = 4" as an ordinary claim.
- `:=` **Level 1:** declaration/definition of an operator. Example: `O₃ₐ(1,2) := Σ₃ₐ(I(1,2))`.
- `Σₓ(I(a,b)) = result` **Level 1:** a declared result. The "=" is D-locked. Example: `Σ₃ₐ(I(1,2)) = 3` is true *inside the declared system*; it is not an assertion that common-meaning division of 1 by 2 yields 3.

## Rules

1. **Tag the level.** Every formula in framework docs carries its standing: `DECLARED`, `DERIVED`, or unmarked common (Level 0).
2. **No bare export.** A Level-1 "=" may never be quoted as a Level-0 arithmetic claim. `Σ₃ₐ(I(1,2)) = 3` does not license "1/2 = 3" in common meaning.
3. **Override rule.** Common meaning is the default; structural law overrides explicitly and only where declared. Each override is tagged `DECLARED` at the point of use.
4. **Projections disambiguate.** When ambiguity threatens, write the projection: `Πclass` for the common-arithmetic reading, `Π₃` for the non-classical reading, `Σall` for the unfiltered state-space.

## Worked example

- Common (L0): `Πclass(I(1,2))` contains `Σ÷(I(1,2)) = 0.5`.
- Declared (L1): `Σ₃ₐ(I(1,2)) = 3` — `DECLARED`.
- The two do not contradict: they are different segmentations of I, selected by different Σ. The contradiction only appears if the L1 "=" is smuggled into L0 — which Rule 2 forbids.

## Provenance

Derived from the Zero–One refinement §4 (Eric's brainstorm 2026-09-26; Muse's and Copilot's independent answers). Proposed 2026-09-26.
