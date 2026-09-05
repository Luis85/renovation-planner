---
type: Task
parent: "[[Draw and name a rectangular room]]"
order: 30
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Verify reversible and accessible room creation

## Evidence

M03 requires numeric non-pointer input and focus recovery; VS-04 requires cancellation, undo,
redo and reload to preserve one completed intent.

## Why it matters

Canvas success alone excludes keyboard users and can conceal fragmented history or draft writes.

## Approach

Create end-to-end tests for cancel, create, undo, redo, reload, invalid input and write failure.
Drive both drag and form-only routes, scan the form for accessibility, capture light/dark states
and add a live-vault journey for actual canvas focus.

## Acceptance criteria

- Cancel writes nothing; create adds one history entry.
- Undo removes all effects and redo restores them once.
- A Room can be dimensioned and named without pointer-only controls.
- Failure never leaves a phantom Room.

## Risks

jsdom cannot validate layout, drag feel or visible focus; browser and vault checks remain necessary.

## Outcome

Rectangular Room creation is trustworthy across input methods, history and failures.

## Closing evidence

**2026-09-04**, the Add Room increment. `tests/presentation/editor/roomCreation.e2e.test.ts`
carries most of it — seven cases through the real mounted editor, real repositories and a real
Konva stage.

Criterion 1 — **cancel writes nothing; create adds one history entry** — is 'Cancel leaves the
task in one gesture and writes nothing' and 'drags a rectangle, names it, and Create writes it,
selects it and ends the task', the second reading the repository rather than the canvas.

Criterion 2 — **undo removes all effects and redo restores them once** — is 'undo removes the
room and redo restores the SAME id': the id is compared, not the count, so a redo that minted a
fresh id would fail rather than pass on a room being back.

Criterion 3 — **dimensioned and named without pointer-only controls** — is 'the numeric route
creates a room with no pointer at all, centred on the stage', plus
`tests/harness/accessibility.test.ts`'s four axe scans over the form with a valid draft, the form
with a refused width, the banner with its Finish, and the constrained Inspector drawer. All four
came back with zero violations on their first run; each has a presence assertion above `axe.run`,
because a scan of nothing passes vacuously.

Criterion 4 — **failure never leaves a phantom Room** — is 'a detonated save leaves no phantom
room', described at [[Persist and reload rectangular rooms]].

The light/dark captures this task's Approach asks for are `npm run harness-shot`'s
`plan-editor-add-room` (1280) and `plan-editor-add-room-narrow` (460), taken with the PINNED
Chromium and read by eye — which is how the one layout defect of the increment was found. The
live-vault journey for actual canvas focus is [[Add a room]] step 6: jsdom proves the two
unmounting surfaces CALL `.focus()`, and only Electron says whether it lands.
