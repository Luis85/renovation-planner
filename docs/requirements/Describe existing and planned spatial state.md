---
type: PBI
parent: "[[Existing and planned state foundations]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Describe existing and planned spatial state

## Actor

[[Private renovator]], while turning a surveyed room or object into a renovation intention.

## Main flow

1. The renovator chooses a canonical spatial object.
2. They record one Existing description of what is present now.
3. They record a separate Planned outcome describing what should be true afterwards.
4. Where the planned outcome changes an existing item, the outcome keeps a stable source link.
5. The application derives an unchanged, remove, modify or add comparison from the two records.
6. Both records remain independently readable and available to canonical work.

## Extensions

- **2a** — Existing information is incomplete. The partial record remains valid and is not
  presented as a completed survey.
- **3a** — The planned outcome adds something with no existing source. It is valid and explicitly
  classified as added.
- **4a** — A source link names a missing or unreadable record. The outcome is reported unresolved;
  no source is invented.
- **5a** — Only one side can be read. Comparison is unavailable rather than equal.

## Guarantee

Existing and Planned are separate canonical records on one spatial identity. Neither overwrites
the other, neither copies the subject's geometry, and neither reuses the spatial object's work
progress status.

## Out of scope

- In-progress, installed and as-built records.
- Visual line styles, canvas layers and Inspector navigation.
- Work dependencies, scheduling, trade assignment or execution tracking.
- Alternative renovation scenarios.

## Acceptance criteria

1. Saving a Planned record leaves the Existing record byte-identical.
2. Each record carries the same stable spatial target identity without copying its geometry.
3. Added, removed, modified and unchanged comparisons are derived reproducibly on read.
4. A Planned outcome may link to its Existing source and remains valid without one when it is an
   addition.
5. Missing, empty, unreadable and equal states are distinguishable.
6. Reload restores both records and their relationship without introducing an as-built state.

## Assumptions

1. The accepted ADR-EPW decision will choose whether these are state records or a related domain
   entity; this PBI fixes their semantics and separation.
2. Existing information may be incrementally incomplete.

## Sources

M08 Existing Room Details and M09 Planned Room Details; the editor implementation plan Phase 7;
the first vertical slice plan ADR-EPW and §15; PRD §30, §34–35 and §60.
