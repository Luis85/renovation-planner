---
type: PBI
parent: "[[Spatial creation]]"
order: 20
status: Done
started: 2026-09-04
finished: 2026-09-04
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Start room creation from Add]]"
---

# Draw and name a rectangular room

## Actor

[[Private renovator]] who knows a room approximately or by width and depth.

## Preconditions

- An editable Floor (`Plan`) is open.
- Room creation was started from Add.

## Main flow

1. The renovator drags a rectangular Room (`Zone`) preview on the Floor.
2. The preview shows live width, depth and derived area.
3. The renovator optionally enters exact width or depth through numeric fields.
4. The renovator chooses a room type and enters a meaningful name.
5. The renovator confirms creation.
6. The plugin commits one reversible room creation, returns to Select and selects the Room.
7. Reopening the Floor restores the same Room identity, metadata and geometry.

## Extensions

- **1a** — The rectangle has invalid or zero dimensions. Completion is refused without a write.
- **3a** — Numeric input is invalid. The draft remains and the field explains the problem.
- **5a** — The renovator cancels. The draft disappears and nothing is written.
- **6a** — Persistence fails. No phantom Room is shown as saved and partial effects are recovered.

## Guarantee

The Floor contains either one complete, reloadable Room created as one reversible user action,
or exactly the persisted state it had before creation began.

## Out of scope

- Arbitrary polygons, owned by [[Create a free-form room]].
- Wall-first room detection.
- Existing/Planned renovation-state details.

## Acceptance criteria

1. Dragging and numeric dimensions converge on the same creation command.
2. Metadata and geometry share one stable identity across reload.
3. Area is derived from geometry rather than stored independently.
4. Cancel writes neither a note nor geometry.
5. Undo removes all completed creation effects and redo restores them once.
6. Creation and naming are possible through a non-canvas numeric/form route.

## Assumptions

- Homeowner-facing Floor maps to the existing `Plan`; Room maps to a room-compatible `Zone`.
- Domain geometry validation remains owned by the existing model and is not restated here.

## Sources

- [[Renovation Planner — First Vertical Slice Plan and Data-Model Specification]], VS-04 and scenarios A–C.
- [[Renovation Planner — Editor Interaction & Mental Model Specification]], section 17.
- [[M03-add-room]], complete room-first creation flow.

## Amendments

**2026-09-04** — closed by the Add Room increment
(`docs/superpowers/specs/2026-09-03-plan-editor-add-room-design.md`). Which test holds each
criterion:

1. **Dragging and numeric dimensions converge on the same creation command.** This is a fact
   about the code's SHAPE before it is a test's assertion: one store
   (`src/presentation/editor/add/room-draft-store.ts`) is written by the canvas drag and by the
   two numeric fields alike, and one action (`createRoomFromDraft`) turns its `geometry` getter
   into one `ReversibleCreateZoneCommand` — there is no second path to converge. The assertion
   is `tests/presentation/editor/add/roomCreation.test.ts`'s 'the numeric route and a drag of
   the same size produce identical geometry', with the end-to-end half in
   `tests/presentation/editor/roomCreation.e2e.test.ts` cases 1 and 6.
2. **One stable identity across reload.** `tests/infrastructure/persistence/editorRoundTrip.test.ts`'s
   'round-trips a rectangle created through `CreateZoneCommand` as a polygon under one id' —
   built through the real command rather than a fixture, and asserting the note's own
   frontmatter (`zone-type: room`) beside the sidecar's four points. The e2e undo/redo case
   asserts the SAME id comes back, which is the other half of one identity.
3. **Area derived from geometry, never stored independently.** The store's `areaMm2` getter is
   `width × depth` over the live rect, and the persisted side stores no area at all — the
   round-trip case reads `Zone.area()` back as 15,960,000 mm² from the four points, and asserts
   the note carries none of `width`, `depth` or `room` as keys.
4. **Cancel writes neither a note nor geometry.** e2e case 4, 'Cancel leaves the task in one
   gesture and writes nothing', beside case 3's two Escapes.
5. **Undo removes all effects and redo restores them once.** e2e case 2, 'undo removes the room
   and redo restores the SAME id'.
6. **A non-canvas numeric/form route.** e2e case 6, 'the numeric route creates a room with no
   pointer at all, centred on the stage', and the accessibility scans over the form, a refused
   field and the constrained drawer in `tests/harness/accessibility.test.ts`.

Extensions: 1a and 3a are `roomDraftStore.test.ts`'s refusal cases plus
`newRoomInspector.test.ts`'s 'a refused width shows inline, keeps the text, and clears on
correction'; 6a is e2e case 5, 'a detonated save leaves no phantom room' — the surface is the
save-state badge and NOT a toast, because `affectsSaveState` reads a `Persistence` refusal as
write-affecting and slice 17 forbids one failure reported through two widgets, so the case
asserts the badge AND that `Notice.shown` did not move.

Narrowings and deferrals, recorded rather than ticked:

- **"Out of bounds" is numeric sanity, not Floor bounds** (design spec §2.7). ADR-0017's Plan has
  no extent and a background is optional, so there is nothing for a rectangle to be outside of.
  The refusals are `parseMetres`'s three — not a number, not positive, longer than
  `MAX_ROOM_SIDE_MM` (1,000,000 mm, a kilometre). Recorded in
  [[Announce live Room dimensions without repetition and refuse out-of-bounds input]].
- **No resize handles on the draft.** M03's "handles" belong to
  [[Edit a selected room shape and dimensions]]; re-dragging replaces the rectangle and the
  fields refine it, keeping the min corner.
- **No snapping.** `draw-room` is deliberately absent from `CONSTRAINING_TOOLS`: the rectangle is
  axis-aligned in world space, so Shift constrains nothing and the status bar would otherwise
  advertise a key that does nothing. [[Grid and snapping]] owns it.
- **No room KIND is stored.** "Choose a room type" is a row of suggestion buttons that set the
  NAME, which is what this PBI's own task actually requires ("Confirmation persists the visible
  name, not a translation key or internal type"). The model question is registered as gap #6 and
  deferred ADR-RK in `docs/development/consolidation/2026-09-editor-model-consolidation.md`.
- **Metres are hard-coded** in one module, `presentation/editor/shell/formatLength.ts`, so that
  [[Switch the measurement unit in the plan editor]] replaces both functions in one edit.
