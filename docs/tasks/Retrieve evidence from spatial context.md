---
type: Task
parent: "[[Link evidence to spatial targets]]"
order: 20
status: New
horizon: "V1"
release: ""
dependsOn: "[[Attach vault evidence to a spatial target]]"
---

# Retrieve evidence from spatial context

## Evidence

Planning-depth V1 needs contextual viewing from M14, but not the later photo-pin, delivery or
execution workflows.

## Why it matters

A relationship that can only be found from the evidence file does not answer the renovator's
question about the selected room or wall.

## Approach

Add an authority-owned query by spatial target, return canonical evidence identities and minimal
relationship metadata, and preserve empty, unreadable and failed outcomes.

## Acceptance criteria

- Every linked target resolves the same canonical evidence identity.
- Querying writes nothing and requires no canvas.
- Empty, unreadable, missing and failed evidence are distinct.
- Opening a result uses the ordinary Obsidian file/note route.

## Risks

Thumbnail generation or canvas numbering would pull later presentation scope into the domain
query; return only authority-owned relationship data.

## Outcome

Not started.
