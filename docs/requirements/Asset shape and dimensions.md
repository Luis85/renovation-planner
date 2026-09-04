---
type: Feature
parent: "[[Asset designer]]"
order: 10
status: Active
started: 2026-08-30
finished: ""
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

# Asset shape and dimensions

An [[Asset]] definition arrives from [[Asset definitions and categories]] with a unit and a price
basis and nothing at all about its size. This feature gives it one: a footprint polygon that is
the only stored geometry of record, a clearance boundary, an anchor, a facing direction and a
height — held with the shared catalogue rather than with any plan, so a footprint corrected once
is corrected everywhere it is referenced.

It is deliberately usable before any drawing surface exists. Typing 120 x 80 writes a rectangle
into the footprint and every plan referencing that object knows its size; tracing a technical
drawing is [[The designer surface]]'s refinement and never the entry fee (§3.5). Width and depth
are always a reading of the footprint's bounding box rather than fields stored beside it, so
there is one number to correct and no second answer to what the object measures.

Where the shape lives is ADR-0014's: one geometry sidecar per object under the library folder's
own `Geometry/`, keyed by the asset's id, beside the note whose frontmatter carries the height.
Neither scope ADR-011 offers would do — a footprint that many plans across many projects
reference cannot live inside any one of their sidecars without breaking the correct-it-once
guarantee this epic exists for.

**The epic's recoverability condition is open beneath this feature, and no item here ticks it.**
The sidecar is a single mutable document: its revision identifies the latest write and retains no
earlier state, so editing a footprint overwrites in place, which is the opposite of *recoverable
rather than overwritten in place*. Nothing is lost today, and that is a fact rather than a
defence — placement does not exist, so no plan references a shape, and [[Plan revisions]] does
not exist to have approved one. The trigger is named so this cannot land quietly: the first
increment that lets a placement reference a shape, or [[Plan revisions]] itself, whichever comes
first, owes retained history before it ships.

## Outcome

A renovator gives an object its real size in seconds and every plan referencing that object knows
it, without opening a drawing surface at all.
