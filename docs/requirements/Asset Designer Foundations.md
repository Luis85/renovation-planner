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
drawing is The designer surface's refinement and never the entry fee (§3.5). Width and depth
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

# The designer surface

A spec sheet is at 1:20 and the plans the object will be placed into are at 1:100, so the shape  
is drawn somewhere of its own: a per-object workspace surface (ADR-0015), opened on one [Asset](app://obsidian.md/Asset)  
and keyed by its id, carrying its own background, its own calibration and its own origin. That  
separation is the point rather than an implementation detail — a product where tracing an oven  
could disturb the scale of the bathroom is a product whose numbers cannot be trusted anywhere.

Its toolbar is exactly what the surface can do: pan, trace a footprint, trace a clearance  
boundary, set an anchor, set a facing direction, calibrate, undo and redo. **There is no  
selection tool**, and that is a decision with a record rather than an omission — see  
[The designer offers no selection, because nothing there was selectable](app://obsidian.md/The%20designer%20offers%20no%20selection,%20because%20nothing%20there%20was%20selectable), whose work is  
[Select part of an object's shape](app://obsidian.md/Select%20part%20of%20an%20object's%20shape). There is no layers panel either, for a reason that will not  
change: a single object has nothing to layer.

This feature owns the surface and the gestures on it. It does not own what a plan then does with  
what was drawn — depicting a footprint on a plan, flagging an overlap between two clearances and  
any fit test belong to [Plan editor](app://obsidian.md/Plan%20editor) and [Asset placement](app://obsidian.md/Asset%20placement), and the epic explicitly does not  
promise them. So this feature ships shapes nothing on a plan yet draws, and that is the sequence  
rather than a gap.

## Outcome

A renovator traces an object's true shape over that object's own technical drawing, at that  
drawing's scale, and no plan's scale moves.

A renovator gives an object its real size in seconds and every plan referencing that object knows
it, without opening a drawing surface at all.
