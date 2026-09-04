---
type: PBI
parent: "[[Asset shape and dimensions]]"
order: 30
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

# Delete an asset without stranding its shape

## Actor

[[Private renovator]] removing an object from the catalogue that they will not use again.

## Preconditions

- The object exists in the catalogue. It may or may not have been designed.

## Main flow

1. The renovator deletes the object.
2. The plugin removes the object's note **and** its geometry document together.
3. The catalogue and every picker stop offering it.

## Extensions

- **2a** — The object was never designed and has no geometry document. The deletion succeeds: an
  absent sidecar is the ordinary state, not a failure.
- **2b** — The geometry document cannot be removed. The note is not left gone with the file
  behind.
- **2c** — The document at the derived path positively declares a **different** object. It is left
  alone and the deletion is refused rather than destroying another object's design — two ids
  differing only in case derive one path on a case-folding filesystem, which is exactly the state
  where a path derived from an id lies.
- **2d** — The document is too corrupt to declare any object at all. It is removed with the note,
  because refusing here would strand a mangled file permanently.
- **3a** — A later move of the library carries nothing orphaned: no geometry document survives
  whose object is gone.

## Guarantee

After a successful deletion neither a note nor a geometry document remains for that object's id,
so a **reused** id cannot load a deleted object's design onto a new one. That guard is the point
rather than tidiness: a stranded document defeats the read-side check that refuses a mismatched
id, because a reused id makes the two agree.

## Out of scope

- Undoing a deletion.
- References from a plan, which cannot exist while [[Asset placement]] does not.
- Deleting the technical drawing the object referenced. The document belongs to the vault and is
  never a copy the object owns.

## Acceptance criteria

1. Deleting a designed object removes its geometry document.
2. Deleting an undesigned object succeeds with no geometry document present.
3. A failed geometry removal does not leave the note gone and the file behind.
4. A geometry document declaring a different object is never removed by this object's deletion.
5. A move of the library after a deletion carries nothing orphaned.

## Assumptions

- An id is a user-editable frontmatter field, so id reuse is reachable by hand editing and is
  treated as ordinary rather than exceptional.

## Sources

- PRD §17 (Asset Library)
- PRD §3.2 (Plain Markdown round trip)
- PRD §83 (Library folder)
- ADR-0014 (Library-scoped asset geometry sidecar)
