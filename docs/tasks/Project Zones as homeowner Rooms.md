---
type: Task
parent: "[[View rooms in the Standard Plan View]]"
order: 10
status: New
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
