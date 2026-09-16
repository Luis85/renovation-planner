---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 215
sources:
  - docs/superpowers/specs/2026-09-16-opening-handles-design.md (Handle layout)
  - docs/superpowers/specs/2026-09-16-opening-handles-design.md (Interaction)
  - docs/superpowers/specs/2026-09-16-opening-handles-design.md (Write path)
status: Ready
---

# Adjust an opening with its canvas handles

A selected door or window draws up to seven on-canvas handles — two end-drag circles, a centre
slide grip, two step arrows and two swing chevrons — and each one is a live edit: a resize, a
slide along the host wall, a 10/100 mm nudge, or a swing flip.

## Why a human is the only instrument here

`?view=plan-editor` in the browser harness runs without renovation services, so a handle press
there fails with a save error — nothing automated in this repository proves a handle WRITES. What
jsdom does check: `tests/presentation/editor/structure/openingHandlesComponent.test.ts` asserts
that drawing and hit-testing agree — a handle drawn at a geometry position is the same position hit
testing reaches for a click there. Nothing has shown the handles VISUALLY. That is why this case
exists.

Preconditions: `npm run test-build`, open this folder as a vault with the plugin enabled, and run
**Create sample project** from the command palette if the vault holds no project yet.

## Steps

1. Draw a wall, place a door on it, then select the door with the Select tool. **Expect:** seven
   handles appear — two end circles, a centre circle, two green step arrows and two orange
   chevrons.
2. Drag an end circle outward, then release. **Expect:** the opening widens from that edge only;
   the other edge does not move. The width persists after release, and the note on disk shows the
   new `width` and `offset`.
3. Press Ctrl+Z (Cmd+Z on macOS). **Expect:** the previous width returns.
4. Drag the centre circle along the wall. **Expect:** the opening slides, keeping its width. Keep
   dragging past the wall's end. **Expect:** it stops with its whole width on the wall.
5. Press a green step arrow, then Shift-press it. **Expect:** the opening moves 10 mm on the first
   press and 100 mm on the Shift-press.
6. Press the orange chevron on the far side of the wall from the door's swing arc, then press the
   near one. **Expect:** the swing arc redraws on the far side, then comes back to the near one.
7. Place a plain opening (no leaf) on a wall and select it. **Expect:** there is no chevron to
   press.
8. Repeat step 2 against a curved wall. **Expect:** the handles sit on the arc, not on a straight
   chord between its ends.
9. Switch to Renovate, then to Review. **Expect:** no handles draw in either perspective.
10. Zoom far out. **Expect:** the step arrows disappear first; keep zooming out and everything but
    the centre grip disappears too. Nothing overlaps at any zoom level in between.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Written with the increment; unrun until walked in a vault. |

## Outcome

Written after the first walk: which steps passed, and anything only a live vault showed.
