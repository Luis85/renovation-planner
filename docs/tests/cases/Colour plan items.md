---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 99
sources:
  - Plan colours everywhere design spec §2 (drawing), §3 (commands and UI)
status: Ready
---

# Colour plan items

Every plan thing takes a preset or custom colour, singly or several at once. `docs/superpowers/specs/2026-09-15-plan-colors-everywhere-design.md`
is the design and `docs/superpowers/plans/2026-09-15-plan-colors-everywhere.md` the plan.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and a floor with a walled room,
a door, a path and a drafting text.

## Why a human is the only instrument for these

Every write, undo and refusal below is driven in `tests/presentation/editor/itemColors.test.ts`; drawing is asserted
node by node in `itemColorRendering.test.ts`, `zoneColorWash.test.ts` and `structure/wallColorPass.test.ts`. Outside all of it:

1. **Whether the operating system's colour picker opens from Details inside Obsidian** and writes once on close.
2. **Whether tints, inks and the room wash read on a themed vault**, not only on the harness's default colours.

## Steps

| # | Do | Expect |
| --- | --- | --- |
| 1 | Select the room. Details › Color › Blue. | A light blue wash over the room; the plan under it still reads. "Color · Blue". |
| 2 | Select a wall. Choose Rose. | The wall body turns light rose; its door symbol is unchanged. |
| 3 | Select the path. Details › Custom color; drag through several colours, then close the picker. | The path turns the final colour once; one Undo returns it to Default. "Color · #…" names the hex. |
| 4 | Right-click the drafting text. | The menu shows Default and six presets, and no custom picker. |
| 5 | Select the room, the wall and the path together. | Details and the menu read "Color · Mixed" with nothing checked. |
| 6 | Choose Green. Undo. | All three turn green; one Undo restores all three previous colours. |
| 7 | Switch to Renovate. | No palette anywhere; colours stay visible. |
| 8 | Still in Renovate, open a renovation record on the coloured room, enter a description and save. | It saves, with no "changed elsewhere" refusal. |
| 9 | Switch theme between light and dark. | Every colour stays legible; name any that is not. |
| 10 | Open the plan's geometry sidecar in a text editor. | `"schemaVersion": 16`, with `"color"` on the room entry, the wall and the path. |

## Runs

| Date | Build | Result |
| --- | --- | --- |
| — | — | Not yet run in a vault. |
