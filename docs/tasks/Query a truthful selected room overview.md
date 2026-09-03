---
type: Task
parent: "[[Inspect a selected room]]"
order: 10
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Query a truthful selected room overview

## Evidence

The [vertical plan's RoomOverviewDto proposal](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md) combines current room/floor data with explicit unavailable sections.

## Why it matters

The Inspector cannot distinguish empty, unsupported and failed if the query erases those states.

## Approach

Build the selected-room read path from stable Room/Zone ID, geometry-derived values, floor context, supported linked summaries and capability metadata.

## Acceptance criteria

- The DTO preserves selected ID and floor ID.
- Area derives from current geometry.
- Unsupported, empty and failed results remain distinct.
- Unreadable dependencies propagate a coded result rather than zero values.

## Risks

Aggregating convenience counts can turn partial data into apparent completeness.

## Outcome

The Inspector receives one honest projection of the selected room.

## Closing evidence

**2026-09-03**, the plan editor foundation's first increment. `buildRoomOverview`
(`src/presentation/read-models/roomOverview.ts`) and
`tests/presentation/read-models/roomOverview.test.ts` hold criteria 1 and 3: 'carries the same id
as the zone and the floor it sits on', and 'marks every future section unavailable in this
increment — none is empty, none has a count', which is `INSPECTOR_SECTIONS` as a closed union of
seven. Criterion 2 is `tests/presentation/read-models/spatialRecords.test.ts`'s derived area.

Criterion 4 is the pre-existing coded-`Result` path rather than anything this function does: the
overview is a PURE projection over an already-read zone and plan, so an unreadable dependency
refuses one layer below it (`tests/presentation/editor/planEditorFailure.test.ts`) and never
reaches here as a zero.
