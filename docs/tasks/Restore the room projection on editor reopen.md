---
type: Task
parent: "[[Reload the editor without losing room data]]"
order: 20
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Restore the room projection on editor reopen

## Evidence

Scenario C requires the reopened canvas, room list, and Inspector to agree after hydration.

## Why it matters

Correct repository bytes can still be lost at store or presentation rehydration.

## Approach

Drive close/reopen and workspace-restore paths through real queries. Compare canvas, list, and
Inspector IDs and derived values; verify transient draft state is absent and Select is safe.

## Acceptance criteria

- Reopen shows the last successful room state in every projection.
- No transient draft is restored as a room.
- A missing prior selection does not hide valid rooms.

## Risks

A test can mount a fresh fixture instead of reopening the written one; assert the same stable ID.

## Outcome

Editor hydration reconstructs one coherent room projection.

## Closing evidence

**2026-09-05**, the trust path increment. Three cases in a new `reopening a floor` describe in
`tests/presentation/views/planEditorReopen.test.ts` — split out of `planEditorView.test.ts` when
that file reached its cap — each mounting `PlanEditorView` twice over REAL in-memory repositories
rather than a static fixture literal, which is the point this task's own Risks paragraph names: a
fixture literal cannot tell a reopen that re-read from one that replayed a constant, and the
second case has to be able to change what the vault holds between two mounts.

Criterion 1 — **reopen shows the last successful room state in every projection** — is
'reopening the same plan shows the same room', comparing the canvas, the room list and the
Inspector's own reading. Both potentially vacuous comparisons are guarded (the row list really has
length 2 and the compared Inspector reading really is the room's name, type and floor), so it
cannot pass by two empty readings agreeing.

Criterion 2 — **no transient draft is restored as a room** — is the describe's THIRD case, 'a room
draft abandoned by closing the leaf is not persisted and not restored'. It drives Add → Room, a
real pointer drag and a typed name, closes the leaf with Create never pressed, and asserts the
reopened leaf has no form, no banner, no rectangle and opens in Select, with the repository
unchanged. **Leaf A is asserted to hold all of it FIRST**, so the absences are assertions rather
than a description of a leaf where nothing ever happened — `RoomDraftStore` is per leaf and dies
with it, and a draft that survived would be a draft something persisted.

Criterion 3 — **a missing prior selection does not hide valid rooms** — is 'a leaf reopened onto a
floor whose room is gone opens in Select with every remaining room drawn'. **It is written from
the REOPEN side because the other side cannot be written as the plan stated it**: a restored
`setViewState` carries a plan id and nothing else, and a selection dies with the leaf's Pinia, so
"a restored view state naming a deleted zone" has no subject at a reopen. The case's docblock says
plainly what it does not reach and points at `selectionRetirement`'s own suite for the
within-a-leaf half.

**One fake was HARSHER than the real thing, and it cost a whole projection.**
`unavailablePlanEditorCommands()` refuses `zoneInspector` too — which is a READ, grouped with the
commands it shares a selection with — so selecting a room in the reopen case drew an empty
Inspector body until that one member was made real. `planEditorRig` already records that trap from
one direction; this is it met from a second. The write side stays the refusal bundle.
