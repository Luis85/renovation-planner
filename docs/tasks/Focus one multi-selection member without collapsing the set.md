---
type: Task
parent: "[[Select several parts of a plan]]"
order: 40
status: Done
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

## Closing evidence

**2026-09-08**, the plan-editor stack — landed in dfe9b2a6 (#74).

`SelectionStore.focusedId` is held apart from `selectedIds`, and one action, `focus(id)`, serves
the canvas body, the numbered badge and the M11 list row.

Criterion 1 — **focusing does not add, remove or reorder** — is
`tests/presentation/editor/selection/spatialSelection.test.ts`'s 'preserves selection order and
focus independently, deduplicates IDs and retires focus deterministically': after
`focus('record-0')`, `selectedIds` is the SAME array (`toBe`), not merely an equal one.

Criterion 2 — **badge and list row focus the same identity** — is the canvas half in 'Shift and
Alt clicks never begin a move, including on selected handles' (a plain pointerdown on a selected
member's body or badge moves `focusedId` and leaves `selectedIds` at two) and the list half in
`tests/presentation/editor/shell/multiSelectionInspector.test.ts`'s 'keeps the list reachable
after selecting, supports multi-selection without modifiers and preserves the camera' (a row
button click; `focusedId` reads `zone-kitchen`, membership and both badges unchanged).

Criterion 3 — **keyboard focus supports the same operation** — rests on the rows being native
`<button>`s, so Enter and Space reach the same click handler; that case runs axe over the mounted
inspector and expects no violation. No case presses Enter on a row: read it as held by the
platform, not by a keystroke this suite sends.

Criterion 4 — **removing the focused member chooses a deterministic remaining focus or none** — is
the same store case (`select(['record-1'])` after focusing `record-0` answers `record-1`;
`select([])` answers `null`) and the inspector's 'derives a shared type, updates after record
removal and ignores a no-longer-readable ID'.

Criterion 5 — **clearing selection clears focus** — is `clear()` answering `focusedId === null` in
the store case.
