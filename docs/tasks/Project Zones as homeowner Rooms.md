---
type: Task
parent: "[[View rooms in the Standard Plan View]]"
order: 10
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Project Zones as homeowner Rooms

## Evidence

The [compatibility model](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md) maps a room-classified Zone to `RoomDto` with the same ID and geometry-derived area.

## Why it matters

Users need Room language without a premature entity rename or second source of truth.

## Approach

Define the approved Room/floor read projection over existing Plan and Zone queries, preserving stable IDs, unreadable counts and capability availability.

## Acceptance criteria

- Every Room DTO preserves its source Zone ID and floor association.
- Area is derived from sidecar geometry.
- Read failures and unreadable records are not flattened into empty results.
- No schema or entity rename is introduced.

## Risks

A presentation adapter can accidentally conceal unsupported or malformed source data.

## Outcome

The editor can speak Room and Floor while reading the current canonical model faithfully.

## Closing evidence

**2026-09-03**, the plan editor foundation's first increment. `src/presentation/read-models/spatialRecords.ts`
is the projection and `tests/presentation/read-models/spatialRecords.test.ts` holds every
criterion: 'keeps the ZoneId as the record id and calls a Room zone a room' and 'is the plan under
its homeowner name, beside its project' are criterion 1; 'derives area from the points rather than
reading a stored figure' and 'answers 0 for a degenerate polygon rather than throwing' are
criterion 2 — the area is computed from sidecar geometry at read time and is stored nowhere;
'marks every count partial when some zones were unreadable, carrying the number' and
'distinguishes a floor with no rooms from one whose rooms could not be read' are criterion 3.
Criterion 4 is `tests/infrastructure/persistence/editorRoundTrip.test.ts` — no entity, key or
schema version moved, and ADR-0016 says why.
