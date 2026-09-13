---
type: PBI
parent: "[[Handoff readiness and provenance]]"
order: 20
status: New
horizon: "V1"
release: "[[Mighty Dragon]]"
dependsOn: "[[Apply recipient-specific information requirements]]"
---

# Review readiness for one handoff purpose

## Actor

[[Private renovator]] deciding whether a specific package can be issued for its stated purpose.

## Main flow

1. The renovator opens Review for the handoff draft.
2. The plugin evaluates only rules applicable to its purpose, recipient and available domains.
3. It returns one of: ready, ready with open questions, needs professional input, or not ready for
   this purpose.
4. Every finding explains the rule, affected scope and canonical destination where it can be
   resolved.
5. The renovator fixes a source issue and returns with the same draft scope and review context.

## Extensions

- **2a** — A required authority is unavailable. The result is unavailable or unknown, not a
  satisfied rule or ordinary missing field.
- **2b** — A source read fails. The last valid projection may remain visible as stale, but issue is
  blocked until the read is recovered.
- **3a** — An architect consultation has open dimensions or decisions. The package may be ready
  with questions because resolving those questions is its purpose.
- **3b** — An execution package lacks required professional information. It is not ready and the
  plugin does not offer wording that implies construction approval.

## Guarantee

Handoff readiness is a deterministic, explainable projection for one purpose and never a stored
project-completion percentage.

## Out of scope

- Persisting readiness scores or findings.
- General project-health ownership, which remains with [[Project health]].
- Professional sign-off or approval.

## Acceptance criteria

1. Identical available inputs produce identical status, findings and explanations.
2. Consultation, quotation and execution purposes can reach different results from the same data.
3. Every finding routes to one canonical source or clearly requests professional input.
4. Missing, unavailable, unreadable, stale and satisfied are distinct.
5. No numeric percentage is required or stored.
6. Review preserves the draft's selected scope and compatible return context.

## Sources

- [[Review renovation readiness spatially]].
- Product Capability Map §§25 and 29.
- SDD §§35, 42, 66, 87 and 97.
