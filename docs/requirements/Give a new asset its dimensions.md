---
type: PBI
parent: "[[Asset shape and dimensions]]"
order: 10
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

# Give a new asset its dimensions

## Actor

[[Private renovator]] adding an object to the catalogue whose size they already know — off a box,
a tape measure or a product page — and who wants it to count in every plan without drawing
anything.

## Preconditions

- The library folder is configured and reachable.
- The renovator knows the object's width and depth, or knows that they do not yet.

## Main flow

1. The renovator opens the new-object form from the project surface.
2. They name the object and give it a category, a unit, a unit cost and a currency; the currency
   arrives prefilled from the plugin's configured default.
3. They optionally type a width and a depth.
4. They submit.
5. The plugin creates the object's note, then writes a rectangle of those dimensions into the
   object's footprint.
6. The catalogue lists the object, and every plan referencing it can read its footprint.

## Extensions

- **3a** — The dimensions are left empty. The object is created with no footprint, which is the
  ordinary state rather than a failure; a shape is added later on [[The designer surface]].
- **4a** — A dimension is zero, negative or not finite. Submission is refused against **both**
  dimension fields at once, because neither is wrong on its own, and everything typed is kept.
- **4b** — A dimension pair is legal on its face and yields a rectangle the shape rules refuse —
  four distinct vertices whose area underflows to nothing. It is refused **before** anything is
  written, by composing the whole shape the way the command composes it, because a preflight that
  checks less than the command it precedes is a guarantee the code beside it does not keep.
- **4c** — The renovator cancels. Nothing is created.
- **5a** — The note is created and the footprint write then fails. Exactly one catalogue entry
  stands, with no footprint, and the failure is reported. The catalogue fields cannot be retyped
  into a second attempt: a vault fault must not be able to mint two entries for one object.
- **6a** — The prefilled currency is not the one a project prices in. Assigning the object there
  is refused by the cost pipeline rather than silently converted.

## Guarantee

A submission creates one catalogue entry or none. Where dimensions were given and accepted, that
entry's footprint is a rectangle of exactly those millimetres; where they were not, the entry
carries no footprint and nothing anywhere presents one.

## Out of scope

- Defining the object itself — its category vocabulary, its unit and its price basis are
  [[Asset definitions and categories]]'.
- Changing the dimensions after creation, which is [[Read and correct an object's dimensions]].
- Any use of the footprint on a plan, which is [[Asset placement]]'s.

## Acceptance criteria

1. A typed width and depth produce a footprint whose bounding box is exactly those millimetres.
2. Empty dimensions create the object and no footprint, and nothing reports one.
3. A non-positive or non-finite dimension writes nothing and is reported against both dimension
   fields.
4. The currency is prefilled from the plugin's configured default rather than from a literal, so
   the plugin never supplies a default its own cost pipeline will refuse.
5. A refused submission keeps every value the renovator typed.
6. A failed footprint write leaves exactly one catalogue entry, reports the failure, and offers no
   second creation.

## Assumptions

- A dimension read off a box or a tape is accurate enough for the MVP; canonical storage is
  millimetres (ADR-009).
- An object with no footprint is still useful, because it carries a unit and a price.

## Sources

- PRD §17 (Asset Library)
- PRD §3.5 (Progressive Complexity)
- PRD §88 (Derived data)
- ADR-009 (World coordinates in millimetres)
- ADR-0014 (Library-scoped asset geometry sidecar)
