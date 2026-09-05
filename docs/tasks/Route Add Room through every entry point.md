---
type: Task
parent: "[[Start room creation from Add]]"
order: 20
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Route Add Room through every entry point

## Evidence

M02 requires pointer and keyboard access, while M05 routes its Add rooms choice into the same
path. The repository rule is one action for every input.

## Why it matters

Parallel entry implementations drift in availability, errors, focus and tool lifecycle.

## Approach

Wire the editor Add menu, command/keyboard route and Floor start choice to the canonical Room
activation. Preserve focus, close the menu before activation and return a start failure through
the shared error surface. Test each route by spying on the canonical action.

## Acceptance criteria

- Every entry invokes the canonical action exactly once.
- A refused start leaves Select active and reports why.
- Focus is restored predictably after refusal or menu cancellation.

## Risks

Event bubbling can activate both menu and canvas; tests must include real keyboard and pointer grammar.

## Outcome

Room creation starts consistently wherever the homeowner asks for it.

## Closing evidence

**2026-09-04**, the Add Room increment.

Criterion 1 — **every entry invokes the canonical action exactly once** — is held at each door and
across all of them. `tests/presentation/editor/add/addMenu.test.ts`'s 'Enter on Room starts
exactly one tool and emits exactly one close' (a spied `setTool` asserted
`toHaveBeenCalledTimes(1)`), 'Space activates the focused available item, exactly like Enter' and
'clicking an item works too: Room activates and closes'; and
`tests/presentation/editor/emptyStateOverlay.test.ts`'s 'activates the draw tool when the noZones
action is pressed', which asserts on the store because that door has no injectable spy. That they
are the SAME action rather than two agreeing ones is
`tests/presentation/editor/add/creationCatalogue.test.ts`'s two source-text cases — and one of
the two doors was not going through it until a review round said so.

Criterion 2 — **a refused start leaves Select active and reports why** — has no producer for Room
and is recorded rather than ticked: `setTool` over a registered id cannot refuse. The neighbouring
real behaviour, a tool that refuses once active, is
`tests/presentation/editor/toolRefusalSurfaces.test.ts`.

Criterion 3 — **focus restored predictably** — is `addMenu.test.ts`'s 'opens from Add, focuses
Room, and closes on Escape with focus back on Add and nothing dispatched' for the menu's own
cancellation, and, once the task is running, the two unmounting surfaces recovering focus for
themselves: `tests/presentation/editor/shell/newRoomInspector.test.ts`'s 'Create through the
form: the room is created, and focus does not fall to body' and
`temporaryToolBanner.test.ts`'s 'Finish creates the room through the same action as the form, and
focus lands on the canvas'. jsdom proves `.focus()` was CALLED; step 6 of [[Add a room]] is the
instrument for whether Electron honours it.

**M05's three-way floor start is not one of the entry points**, and that is a scope statement
rather than a gap: this increment re-routed the no-rooms empty state's one existing button and
built no start screen. [[Choose how to start a floor]] owns that.
