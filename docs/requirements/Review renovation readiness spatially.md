---
type: PBI
parent: "[[Renovation semantics]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn:
  - "[[Turn a planned outcome into actionable work]]"
  - "[[Project health]]"
---

# Review renovation readiness spatially

## Actor

[[Private renovator]], before committing to or sequencing renovation work.

## Main flow

1. The renovator switches from Renovate to Review for a floor containing rooms or changes.
2. The editor derives readiness findings per spatial target from the authority-owned Existing,
   Planned, work, decision, evidence, cost and project-health results currently available.
3. The canvas and equivalent list identify rooms that are ready or need attention using a label
   and marker, not colour alone.
4. The renovator selects a finding and reads its explanation and source.
5. They may generate and open a vault-backed Markdown review summary linking to the reviewed
   sources.
6. They follow a finding to the actionable canonical record in Renovate.
7. Returning to Review restores the prior spatial selection and viewport.

## Extensions

- **1a** — No readiness inputs are available. Review is unavailable, not failed and not a
  floor declared ready.
- **2a** — A later capability such as cost or evidence has not landed. Its rule is omitted and
  disclosed as unavailable; absence is not counted as a readiness failure.
- **2b** — An expected authority fails to read. The affected result is unknown and reported; it
  is neither ready nor an ordinary missing-information finding.
- **4a** — A finding describes a missing or incoherent input. It remains a derived readiness
  finding and is not persisted as an [[Issue]].
- **5a** — Summary export fails. Review remains read-only and its current derived result stays
  visible; no partial summary becomes a readiness authority.
- **6a** — The target record has since disappeared. Renovate shows the current missing target
  state and provides a route back; Review does not redirect repeatedly.

## Guarantee

Readiness is deterministic, explainable and derived from current authority-owned data. A finding
is not a persisted Issue, and an unavailable or unreadable capability can never make a room look
ready or manufacture a failure. An exported Markdown summary is a read-only snapshot of derived
findings, not a canonical renovation record or another source of readiness truth.

## Out of scope

- Defining the project-wide health model, owned by [[Project health]].
- Creating Issues, approvals, collaboration or sign-off semantics.
- Editing geometry or creating canonical renovation records in Review. The explicit Markdown
  review-summary export is allowed because it records links to derived findings without becoming
  an Issue, persisted readiness finding or renovation authority.
- Persisting readiness scores or findings.

## Acceptance criteria

1. The same available inputs produce the same readiness status, finding set and explanation.
2. Every finding names its rule and routes to one actionable canonical source.
3. Readiness status uses text or shape in addition to colour and has a complete list route.
4. Review exposes no geometry-editing or canonical record-creation controls; its only write
   control generates the explicit Markdown review-summary export.
5. A derived finding can be displayed without creating or mutating an Issue note.
6. Unavailable, unreadable, missing and satisfied inputs produce distinct outcomes.
7. Review-to-Renovate-to-Review preserves compatible selection and viewport context.
8. A generated summary opens as a vault-backed Markdown note containing links to reviewed
   authority-owned sources and is not read as an Issue, persisted finding or geometry mutation.

## Assumptions

1. Spatial readiness is a projection of [[Project health]] inputs, not a competing health
   authority.
2. Rules are capability-aware: only rules whose required authority exists may evaluate.
3. Review markers are stable within one result set but are not persisted identities.

## Sources

M17 Review Perspective, with M08–M10 as its actionable sources; the mental-model specification
§§28–32, 55, 73–76 and 81; UX research §§18, 20, 23 and 28; the component library §§3–5,
8–9 and 12; implementation-plan Phase 8, Increment C and harness journey 7; first
vertical-slice plan §§3.3, 5.3 and 15.
