---
type: Task
parent: "[[Select several parts of a plan]]"
order: 40
status: Active
horizon: "MVP"
release: "[[MVP]]"
---

# Focus one multi-selection member without collapsing the set

## Evidence

M11 requires selecting a numbered badge or list row to focus one member without discarding the
ordered multi-selection.

## Why it matters

Collapsing the set when inspecting one member makes shared actions fragile and forces the user to
rebuild selection after every detail check.

## Approach

Represent focused member separately from membership. Route badge and list focus through one
stable-ID action that leaves the ordered selected set unchanged.

## Acceptance criteria

- Focusing a selected member does not add, remove or reorder membership.
- Canvas badge and list row focus the same stable identity.
- Keyboard focus supports the same operation.
- Removing the focused member chooses a deterministic remaining focus or none.
- Clearing selection also clears member focus.

## Risks

Single-selection APIs may replace the shared set when reused for focus.

## Outcome

The renovator can inspect one selected target while preserving the batch scope.


## Implementation update — 2026-09-05

SelectionStore.focus is shared by selected canvas-body/badge clicks and M11 list rows. Membership is unchanged; removal picks the first surviving member and clear resets focus. spatialSelection.test.ts and multiSelectionInspector.test.ts exercise these paths.
