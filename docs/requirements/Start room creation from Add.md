---
type: PBI
parent: "[[Spatial creation]]"
order: 10
status: Done
started: 2026-09-04
finished: 2026-09-04
horizon: "MVP"
release: "[[MVP]]"
---

# Start room creation from Add

## Actor

[[Private renovator]] creating a room without CAD knowledge.

## Preconditions

- An editable Floor (`Plan`) is open in its safe Select state.
- The Add entry point is available.

## Main flow

1. The renovator activates Add from the editor or its keyboard-accessible equivalent.
2. The plugin opens one grouped menu of homeowner concepts and focuses its recommended item.
3. The renovator chooses Room.
4. The menu closes and the temporary room-creation state opens with brief guidance.
5. No persisted data changes until the renovator completes a valid room.

## Extensions

- **1a** — Add is unavailable because the Floor cannot be edited. The action explains why.
- **2a** — The renovator searches or uses arrow keys; the same Room action remains reachable.
- **3a** — Room creation cannot start. The plugin reports the failure and remains in Select.
- **4a** — The renovator presses Escape. The temporary state closes and nothing is written.

## Guarantee

Starting Room enters at most one temporary creation flow; declining, cancelling or failing to
start leaves the Floor unchanged.

## Out of scope

- Drawing or naming the room, owned by [[Draw and name a rectangular room]] and
  [[Create a free-form room]].
- Add-menu entries outside Spatial creation.
- Repeated-creation behavior after a successful room.

## Acceptance criteria

1. Add and its keyboard route invoke one canonical Room action.
2. User-facing text says Room, never Zone, Polygon or Draw Polygon.
3. Escape before completion writes nothing and returns to Select.
4. A failed start produces no draft or persisted room.
5. Room remains reachable without pointer interaction.

## Assumptions

- VS-03 uses the existing one-shot tool lifecycle beneath homeowner-facing Room language.
- `Zone` remains the implementation mapping for a Room until an accepted model decision changes it.

## Sources

- [[Renovation Planner — First Vertical Slice Plan and Data-Model Specification]], VS-03 and WP4–WP5.
- [[Renovation Planner — Editor Interaction & Mental Model Specification]], sections 10 and 16.
- [[M02-add-menu]], Add-menu behavior and acceptance criteria.

## Amendments

**2026-09-04** — closed by the Add Room increment
(`docs/superpowers/specs/2026-09-03-plan-editor-add-room-design.md`), the vertical-slice plan's
checkpoint C2. Which test holds each criterion:

1. **One canonical Room action.** `activateCreationEntry(id, runtime)` in
   `src/presentation/editor/add/creationCatalogue.ts`, held by
   `tests/presentation/editor/add/creationCatalogue.test.ts`'s
   'activateCreationEntry is the one door: Room reaches setTool("draw-room") exactly once' for
   the behaviour, and by its two SOURCE-TEXT cases for the routing —
   "PlanEditorRoot.vue's empty-state action calls activateCreationEntry('room' and never
   setTool('draw- directly" and "AddMenu.vue's activation calls activateCreationEntry( and never
   entry.activate( or .activate(runtime directly". The behavioural half at each door is
   `tests/presentation/editor/add/addMenu.test.ts`'s 'Enter on Room starts exactly one tool and
   emits exactly one close', 'Space activates the focused available item, exactly like Enter' and
   'clicking an item works too', and
   `tests/presentation/editor/emptyStateOverlay.test.ts`'s 'activates the draw tool when the
   noZones action is pressed'.

   **The second source-text case exists because the claim was false when it was first written.**
   `AddMenu.vue` called `entry.activate(runtime)` directly — the same closure
   `activateCreationEntry` looks up, so every behavioural case passed — under a docblock in
   `creationCatalogue.ts` asserting that both doors "call this and nothing else". One door was
   the door; the other was true by coincidence. Found by review, not by a gate.

2. **Room, never Zone.** `tests/presentation/i18n/strings.test.ts`'s 'says Room and never Zone
   anywhere a homeowner reads the editor' — a regex over every `editor.*` and `empty.plan.*`
   value of BOTH locale tables, not an assertion about the strings this increment happened to
   add. `editor.zone.default-name` is deleted; `editor.room.default-name` (`Room {n}` /
   `Raum {n}`) is the one default both the room tool and the still-registered polygon completion
   use.

3. **Escape before completion writes nothing and returns to Select.**
   `tests/presentation/editor/roomCreation.e2e.test.ts`'s 'Escape clears a drafted rectangle and
   stays; a second Escape returns to Select' — the two depths in one case, with the repository
   asserted unchanged at both.

4. **A failed start produces no draft or persisted room** is VACUOUS and is recorded rather than
   ticked: activation is `runtime.setTool('draw-room')` over a registered id, which cannot
   refuse, so there is no failure arm to drive. The nearest real thing is an UNSUPPORTED
   catalogue entry, whose `activate` throws — held by `creationCatalogue.test.ts`'s 'every
   unsupported entry carries a reason and throws if activated' — and Room is not one.

5. **Reachable without a pointer.** `addMenu.test.ts`'s keyboard set: 'opens from Add, focuses
   Room, and closes on Escape with focus back on Add and nothing dispatched', 'ArrowDown moves
   focus through enabled and disabled items alike', the wrap case, 'End jumps to the last item in
   the flat, filtered list', 'typing filters by localized label and synonym', and the two Space
   cases. Past the menu, the whole room can be dimensioned and named with no pointer at all —
   `roomCreation.e2e.test.ts`'s 'the numeric route creates a room with no pointer at all, centred
   on the stage'.

Residues, each named rather than left to be re-found:

- **`DrawPolygonTool` stays registered and has NO door in the Plan Editor.** Room activates
  `'draw-room'`, and a grep for `'draw-polygon'` under `src/presentation/editor/add/` and in
  `PlanEditorRoot.vue` prints nothing. The class is still registered — the asset designer
  registers it too, and test files drive it by id — so this is a stated absence rather than a
  deletion. Trigger: [[Create a free-form room]], whose own task adapts that tool behind Room
  language and gives it a door (design spec §2.1, and §17 Method 2's Free shape choice).
- **Extension 1a — Add is not blocked in a stale or failed state** (design spec §2.9). `stale`
  feeds the warning strip and nothing else, exactly as the first increment recorded for Delete.
  Trigger: checkpoint C3, the trust path.
