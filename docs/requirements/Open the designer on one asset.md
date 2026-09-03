---
type: PBI
parent: "[[The designer surface]]"
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

# Open the designer on one asset

## Actor

[[Private renovator]] who wants to draw or correct the shape of one particular object.

## Preconditions

- The vault holds at least one object in the catalogue, or the renovator can create one.

## Main flow

1. The renovator reaches the designer by one of three doors: the new-object action, the project
   surface's own header, or the command palette's `open-asset-designer` with a fuzzy picker over
   the whole vault's catalogue.
2. They choose an object.
3. A workspace surface opens on that object alone, keyed by the object's id, so several objects
   can be open at once in different tabs.
4. The surface draws the object's own background, its shape and its inspector. With no background
   it says so and offers to choose one; with a background and no shape it says so and offers to
   trace one.
5. Closing and reopening Obsidian restores the surface on the same object.

## Extensions

- **1a** — Two doors are used in the same instant, or one is double-clicked. One surface opens,
  not two: a leaf takes time to exist, so the request is held while it is being created.
- **2a** — The catalogue is empty. The picker offers nothing, and the way in is to create an
  object first.
- **3a** — The object a restored surface names no longer exists. The surface says so and offers a
  way out; **nothing redirects on its own**, because an automatic redirect records a history entry
  nobody asked for.
- **3b** — The object's note is edited by hand, copied in, or arrives by sync while the surface is
  open. The surface re-reads rather than going on drawing a stale object.
- **5a** — Obsidian restores the surface before the catalogue has been scanned. The surface waits
  for the scan to have **run** rather than for it to have found anything, so an empty answer does
  not destroy the very object the restore was about.

## Guarantee

A designer surface is about exactly one object for its whole life, and which object that is
survives a restart and a settings change.

## Out of scope

- A layers panel. A single object has nothing to layer, and this is a decision rather than an
  omission.
- The plan editor's own surface and everything keyed by a plan id.
- Creating the object, which is [[Give a new asset its dimensions]].

## Acceptance criteria

1. All three doors reach the designer.
2. The surface is keyed by the object's id, and two surfaces on two objects coexist.
3. Which object is open survives a restart.
4. An object that is gone draws a statement with a way out, and no redirect.
5. Two activations in one instant open one surface.
6. The surface's four regions are all drawn, and none is silently empty.

## Assumptions

- A renovator designing an object is doing it deliberately, so a picker over the whole catalogue
  is better than guessing from whatever note is active.

## Sources

- PRD §17 (Asset Library)
- SDD §11 (Workspace views)
- SDD §12 (Per-view Vue application)
- ADR-0015 (Asset designer workspace surface)
