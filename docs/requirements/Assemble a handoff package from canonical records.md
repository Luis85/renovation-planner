---
type: PBI
parent: "[[Versioned handoff packages]]"
order: 10
status: New
horizon: "V1"
release: "[[Mighty Dragon]]"
dependsOn:
  - "[[Choose a handoff purpose and recipient]]"
  - "[[Label handoff facts by provenance and verification]]"
---

# Assemble a handoff package from canonical records

## Actor

[[Private renovator]] selecting the project information another person should receive.

## Preconditions

- A handoff draft has a purpose and recipient profile.
- At least one project, room, work item or question is in scope.

## Main flow

1. The plugin resolves selected scope through stable project, plan, spatial, work, requirement,
   cost, decision and evidence identities.
2. It assembles a draft table of contents using the recipient's information requirements.
3. Shared project context is included once; room and work sections retain their own spatial links.
4. Quantities and costs include their stage and calculation provenance rather than unexplained
   totals.
5. Attachments remain ordinary vault files referenced by a manifest; bytes are not embedded into
   a new canonical store.
6. The renovator can follow every generated section back to its source before issue.

## Extensions

- **1a** — A selected source is missing or unreadable. The draft records the failure and cannot
  silently omit it as if it were out of scope.
- **2a** — One fact appears through several relationships. It is rendered once with all relevant
  context links, not copied into conflicting sections.
- **5a** — An attachment has moved. The canonical evidence relationship is resolved first; a
  stale path is not exported as a valid attachment.

## Guarantee

The handoff draft is a projection of canonical identities and files, not another editable source
of renovation truth.

## Out of scope

- Editing canonical records inside generated package content.
- Copying attachments into a proprietary document store.
- Inventing unavailable aggregates, professional drawings or specifications.

## Acceptance criteria

1. Every generated section identifies the canonical records from which it was derived.
2. Shared context is not duplicated into conflicting authorities.
3. Quantity and cost values retain stage, unit and provenance.
4. Missing, unreadable and excluded records are distinct.
5. Attachments remain ordinary vault files represented in a manifest.
6. The same source snapshot and profile produce the same package content ordering.

## Sources

- PRODUCT.md principles 1–3 and 5.
- SDD §§35, 38–43, 50–55, 83 and 87.
- PRD §§37, 43 and 58–60.
