---
type: PBI
parent: "[[Handoff readiness and provenance]]"
order: 10
status: New
horizon: "V1"
release: "[[Mighty Dragon]]"
---

# Label handoff facts by provenance and verification

## Actor

[[Private renovator]] reviewing the reliability of information before another person uses it.

## Main flow

1. The package projection reads each included fact and its canonical source.
2. It labels the fact as observed, homeowner-measured, app-derived, assumed,
   supplier/manufacturer-provided, professional-issued or unknown.
3. Where meaningful, it shows capture date, source document, calculation inputs, units and stated
   accuracy or tolerance.
4. The renovator follows the label to the authority or calculation that produced the fact.
5. Corrections are made at that authority and the draft package refreshes from it.

## Extensions

- **2a** — Provenance cannot be established. The fact is unknown, not homeowner-measured or
  professional-issued by inference.
- **3a** — A derived value depends on stale or unreadable input. The value is marked unusable for
  handoff until the source recovers; the last visible result does not become current evidence.
- **5a** — The package has already been issued. Correcting the source leaves that issue unchanged
  and contributes to the next issue's delta.

## Guarantee

No handoff fact appears more authoritative than the source and calculation history support.

## Out of scope

- Certifying homeowner measurements.
- Inferring professional approval from a filename, author field or attachment type.
- Duplicating calculation inputs inside a second handoff data authority.

## Acceptance criteria

1. Every material handoff fact has one provenance state or explicit unknown state.
2. Derived quantities link to their visible calculation inputs.
3. Professional-issued status requires a linked professional source.
4. Stale and unreadable sources cannot produce a current-ready fact.
5. Editing a fact routes to its canonical authority rather than editing the package projection.
6. Issued package provenance remains historically unchanged.

## Sources

- PRODUCT.md principles 1–3 and Evidence on Hand.
- SDD §§3.6, 42, 50, 52, 66 and 87.
- [[Handoff readiness and provenance]].
