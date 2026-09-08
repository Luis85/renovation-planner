---
type: Task
parent: "[[Select several parts of a plan]]"
order: 10
status: Active
horizon: "MVP"
release: "[[MVP]]"
---

# Maintain an ordered multi-selection identity set

## Evidence

[M11](../user-experience/renovation-planner-editor-specs/screens/M11-multi-selection.md) requires additive canvas/keyboard selection and stable numbered badges linked to list rows.

## Why it matters

Duplicate or unstable identities make aggregates and batch actions target the wrong records.

## Approach

Extend shared selection to an ordered unique set of typed stable IDs, with identical add/remove actions from canvas and list.

## Acceptance criteria

- An identity appears at most once.
- Add/remove behavior matches for pointer and keyboard paths.
- Badge numbers and list order remain stable for the current set.
- Selection changes write nothing.

## Risks

Sorting by mutable labels can renumber badges unexpectedly.

## Outcome

Several selected parts have one deterministic identity representation.


## Implementation update — 2026-09-05

The selection store now deduplicates IDs in insertion order. Canvas/list toggles share selectSpatial. Numbered canvas badges and M11 rows use the same order. spatialSelection.test.ts and multiSelectionInspector.test.ts cover membership, order, duplicates, modified clicks without a move gesture, and unchanged projected room data.
