---
type: Task
parent: "[[Draw and name a rectangular room]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Persist and reload rectangular rooms

## Evidence

The vertical-slice specification requires Room metadata in Markdown and matching geometry in the
Plan sidecar, restored under one stable ID after reload.

## Why it matters

A rectangle visible only until the view closes is not renovation data, and a split identity
creates ghost or unselectable Rooms.

## Approach

Exercise the existing note-plus-sidecar write sequence through repository contracts and fixture
vaults. Verify compensation, user-body preservation, revision conflicts, reload mapping and
derived area. Add migration coverage only if an accepted schema change is necessary.

## Acceptance criteria

- Reload restores name, type and geometry under one ID.
- Partial write failure leaves no half-created Room.
- Existing valid fixtures continue to load or follow a tested migration.

## Risks

Metadata and geometry failures occur at different steps; tests must detonate each boundary.

## Outcome

Completed rectangular Rooms survive time and failure as one coherent entity.
