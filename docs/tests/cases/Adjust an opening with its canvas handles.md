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
slide grip, two step dots and two swing chevrons — and each one is a live edit: a resize, a
slide along the host wall, a 10/100 mm nudge, or a swing flip. Every handle is drawn in the
theme's accent colour: the three drag circles as rings (accent outline, canvas-coloured fill),
the two step dots as solid accent dots, and the chevrons as accent V-shaped strokes, one beyond
each wall face.

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
   handles appear along the wall — a ringed circle at each end and one at the centre, a solid dot
   halfway between the centre and each end, and a chevron beyond each wall face, all in the accent
   colour.
2. Drag an end circle outward, then release. **Expect:** while dragging, the handles hide and the
   door redraws at the dragged width as the pointer moves; they come back once the write lands.
   The opening widens from that edge only; the other edge does not move. The width persists after
   release, and the note on disk shows the new `width` and `offset`.
3. Press Ctrl+Z (Cmd+Z on macOS). **Expect:** the previous width returns.
4. Drag the centre circle along the wall. **Expect:** the opening slides, keeping its width. Keep
   dragging past the wall's end. **Expect:** it stops with its whole width on the wall.
5. Press a solid step dot, then Shift-press it. **Expect:** the opening moves 10 mm on the first
   press and 100 mm on the Shift-press. Shift-press the centre circle. **Expect:** the door drops
   out of the selection and its handles disappear, rather than a drag starting; re-select it.
6. Press the chevron on the far side of the wall from the door's swing arc, then press the near
   one. **Expect:** the swing arc redraws on the far side, then comes back to the near one.
7. Place a plain opening (no leaf) on a wall and select it. **Expect:** there is no chevron to
   press.
8. Repeat step 2 against a curved wall. **Expect:** the handles sit on the arc, not on a straight
   chord between its ends.
9. Switch to Renovate, then to Review. **Expect:** no handles draw in either perspective.
10. Select the curved wall's door from step 8 (re-select it if step 7's plain opening is still
    selected), then zoom far out. **Expect:** the two step dots disappear first, leaving five
    handles. Keep zooming out and the two end circles disappear too, leaving the centre grip and
    the two swing chevrons — the chevrons stay at every zoom, however narrow the opening gets.
    Nothing overlaps at any zoom level in between. (On a plain opening, which has no chevrons, the
    far-zoom state is the centre grip alone.)

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Written with the increment; unrun until walked in a vault. |

## Outcome

Written after the first walk: which steps passed, and anything only a live vault showed.
