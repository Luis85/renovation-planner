---
type: Task
parent: "[[Select several parts of a plan]]"
order: 10
status: Done
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

## Closing evidence

**2026-09-08**, the plan-editor stack — landed in dfe9b2a6 (#74, `codex/editor-implementation`).

Criterion 1 — **an identity appears at most once** — is `useSelectionStore().select` deduplicating
in insertion order: `tests/presentation/editor/selection/spatialSelection.test.ts`'s 'preserves
selection order and focus independently, deduplicates IDs and retires focus deterministically'
selects `['record-1', 'record-0', 'record-1']` and reads back `['record-1', 'record-0']`.

Criterion 2 — **add/remove matches for pointer and keyboard** — is ONE action, `selectSpatial`,
behind both routes: the same file's 'toggle adds and removes while replacement has exactly one
target' drives it directly, 'Shift and Alt clicks never begin a move, including on selected
handles' drives it from `SelectTool.pointerDown`, and
`tests/presentation/editor/shell/multiSelectionInspector.test.ts`'s 'keeps the list reachable
after selecting, supports multi-selection without modifiers and preserves the camera' drives it
from the list rows under the `multiple-selection` checkbox, which is the modifier-free route. That
checkbox is per-leaf state (`EditorRuntime.multiSelectionMode`, 381bcdc4, a review finding on #74:
closing the constrained Layers overlay had been remounting the panel and losing the mode), and
'keeps multiple-selection mode across the constrained Layers overlay closing and reopening' pins
it.

Criterion 3 — **badge numbers and list order stay stable** — is the same insertion order feeding
both: the order case above, and the inspector case counting two `.selection-badge` nodes beside two
`.rp-room-list__row`s after a second row is added.

Criterion 4 — **selection changes write nothing** — is `multiSelectionInspector.test.ts`'s
'survives constrained layout and clears back to the floor with no persisted mutation', which
compares the project store's zones before and after, and the tool case above, whose
`createMoveGesture` THROWS if a modified click ever starts a move.
