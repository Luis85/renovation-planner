---
type: Task
parent: "[[Consolidate the current and target editor data models]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Prove editor persistence round trips

## Evidence

The [locked data-model specification](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md) records split Room/Zone state: Markdown metadata and same-ID `.rpgeo` geometry, plus known fields that may not round-trip.

## Why it matters

A screen contract is unsafe if reload loses a field or note and sidecar no longer describe one logical record.

## Approach

Trace representative Project, Plan and room-classified Zone values from entity through mapper, note/sidecar, repository and read model; verify IDs, revisions, user body and unknown allowed fields; classify every omission as intentional, defect or proposed change.

## Acceptance criteria

- A field-by-field round-trip matrix names canonical storage and schema version.
- Existing-vault fixtures have preserve or migrate decisions.
- Every first-slice persisted value has a runnable contract-test scenario.

## Risks

Happy-path fixtures can conceal compensation, parse-lag and unreadable-note behavior.

## Outcome

Feature A has evidence that its approved fields and geometry survive save, reload and failure boundaries.
