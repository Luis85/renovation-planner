---
type: PBI
parent: "[[Asset shape and dimensions]]"
order: 20
status: Done
started: 2026-08-30
finished: 2026-09-03
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
release: "[[MVP]]"
---

# Record how tall an object is

## Actor

[[Private renovator]] recording how tall an object is so that a drawing and an export can say so.

## Preconditions

- The object exists in the catalogue.

## Main flow

1. The renovator opens the object and reads the height field beside its dimensions.
2. They type a height.
3. The plugin stores it in the object's **note frontmatter**, beside the definition, and not in
   the geometry sidecar — the note carries the scalars and the sidecar carries the space.
4. The height is shown wherever the object is inspected, and it round-trips with the note as
   plain Markdown.

## Extensions

- **2a** — The height is cleared. The object carries none, which is the ordinary state, and
  nothing presents a value.
- **2b** — The height is zero, negative or not finite. It is refused and the previous value
  stands.
- **3a** — The write fails. The previous height remains authoritative and the failure is reported.

## Guarantee

A stored height is one positive, finite measurement in canonical millimetres, held in the
object's own note frontmatter, shown wherever the object is inspected — and read by no
calculation anywhere in the product.

## Out of scope

- **Any calculation reading the height.** No clearance check, no fit test and no vertical answer
  anywhere in the product reads it. *Does the worktop clear the window sill* is a question this
  epic does not answer and this item does not claim: displaying a number and computing with one
  are different acts, and only the second is refused.
- Elevations, sections and any 3D depiction.

## Acceptance criteria

1. A positive height round-trips through the object's note as plain frontmatter, readable with the
   plugin uninstalled.
2. A cleared height leaves the object with none and nothing displays a value.
3. A non-positive or non-finite height is refused and changes nothing.
4. No calculation, clearance check or fit test in the product reads the stored height — checked by
   reading the consumers, because no gate here can see a category claim of that shape.

## Assumptions

- Height is a single scalar. An object whose height varies across its footprint is outside the
  MVP's vocabulary.

## Sources

- PRD §17 (Asset Library)
- PRD §88 (Derived data)
- ADR-009 (World coordinates in millimetres)
- ADR-0014 (Library-scoped asset geometry sidecar)
