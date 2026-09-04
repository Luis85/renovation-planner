---
type: Task
parent: "[[Consolidate the current and target editor data models]]"
order: 20
status: Done
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

## Closing evidence

**2026-09-03**, the plan editor foundation's first increment.
`tests/infrastructure/persistence/editorRoundTrip.test.ts` drives a `Project`, a `Plan` and a
Room-classified `Zone` through the real mappers and the in-memory repository stack and asserts
every first-slice field, both ids, the revision and a user-authored Markdown body survive.
The field-by-field matrix naming canonical storage and schema version is
`docs/development/consolidation/2026-09-editor-model-consolidation.md` §3; the preserve decision
for the existing `tests/vault/` and `tests/fixtures/` fixtures is §5. The report cites the test;
the test does not cite the report.
