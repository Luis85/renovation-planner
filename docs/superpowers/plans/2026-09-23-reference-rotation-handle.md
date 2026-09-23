# Reference rotation handle

**Goal:** in the plan editor's reference setup dialog (Prepare step), the user rotates the
reference image by dragging a handle on the preview canvas, not only by typing degrees, so a
scan can be aligned by eye. The number field stays and stays in sync (it is the keyboard path).

**Decided:** the handle lives on `ReferencePreview.vue`'s 2D canvas inside the setup dialog. The
main Konva canvas is NOT touched (the reference there is display-only; no new command).

## Global constraints

- Rotation stays `ReferenceAppearance.rotation`, degrees, valid range `[-180, 180]`
  (`validReferenceAppearance`). A dragged value is normalised into that range and rounded to
  0.1°. Holding Shift while dragging snaps to multiples of 15°.
- The handle is interactive ONLY in the Prepare step (`step === 1`) and not while `paused`.
  In steps 2–3 the preview draws no handle and behaves exactly as today.
- Rotation is measured as the pointer's angle about the image's ON-SCREEN CENTRE (centre of the
  crop rectangle after rotation, through the current viewport) — so it does not matter that the
  preview refits (`fit`) on every rotation change: `fit` centres the rotated bounding box, so the
  image centre stays put while the scale may change.
- Pure geometry lives in `src/presentation/editor/reference/referenceViewport.ts` and is tested
  in node; the component only wires pointer events to it. No new files in `src/` unless needed.
- UI text goes through `tr()` with keys added to BOTH `locales/en/referenceViewport.ts` and
  `locales/de/referenceViewport.ts`. Sentence case. No literals in templates.
- Colours in canvas drawing come from `getComputedStyle` as the existing `draw()` does; no
  hard-coded colours anywhere (CSS colour check fails the build).
- Definition of done for each task: `npm run check:fast -- <touched test paths>` green, plus
  `npx eslint <touched .vue files>`. Full `npm run check` runs in CI.

## Task 1: rotation geometry helpers

File: `src/presentation/editor/reference/referenceViewport.ts`, tests in
`tests/presentation/editor/referenceViewport.test.ts` (extend the existing file).

Add three exported pure functions:

- `referenceScreenCentre(view: ReferenceViewport, appearance: ReferenceAppearance): Point` —
  the crop rectangle's centre in preview-screen coordinates: `referencePoint(cropCentre,
  appearance, view.scale)` offset by `view.x, view.y` (same transform `draw()` uses for points).
- `rotationHandlePoint(centre: Point, rotation: number, radius: number): Point` — the knob sits
  at `radius` from `centre` in the direction of the image's rotated "up" (rotation 0 → straight
  above the centre: `{ x: centre.x, y: centre.y - radius }`; rotation 90 → to the right).
- `dragRotation(startRotation: number, centre: Point, start: Point, current: Point, snap: boolean): number`
  — `startRotation + (atan2(current−centre) − atan2(start−centre))` in degrees, normalised into
  `[-180, 180]`, then snapped to the nearest 15° when `snap`, else rounded to 0.1°. Returns
  `startRotation` unchanged if either pointer is within 1px of `centre` (angle undefined).

Tests (node): centre with and without rotation/crop offset; handle at 0/90/−90/180; drag of a
quarter turn clockwise gives +90; wrap-around (170 + 20 → −170); snap (37.4 with snap → 30,
without → 37.4); degenerate pointer at centre returns start unchanged. Watch at least one test
fail before implementing.

## Task 2: wire the handle into the setup dialog

Files: `ReferencePreview.vue`, `ReferenceSetupForm.vue`, `ReferencePrepare.vue`,
`locales/{en,de}/referenceViewport.ts`, `styles/editor-reference-viewport.css`, and a jsdom test
(extend `tests/presentation/editor/referenceViewportControls.test.ts` or a new sibling).

- `ReferencePreview` gets prop `rotatable: boolean` and emits `rotation: [degrees: number]`.
  `ReferenceSetupForm` passes `:rotatable="step === 1 && !paused"` and sets
  `appearance.rotation` from the event.
- When `rotatable`, `draw()` additionally draws: a line from the image centre to the knob and a
  knob circle (radius ~7px) at `rotationHandlePoint(centre, rotation, R)` with
  `R = min(width, height) / 2 − 16`. While a rotate drag is in flight, also draw a horizontal and
  a vertical guide line through the centre across the whole preview (the alignment aid).
  Colours from computed styles, like the existing marker drawing.
- `pointerdown` within 12px of the knob (and `rotatable`, button 0) starts a ROTATE gesture
  instead of a pan: pointer capture, record start rotation, centre and start point. `pointermove`
  emits `dragRotation(...)` with `snap = event.shiftKey`. `pointerup`/cancel ends it and
  suppresses the following click, as the pan gesture does. Hovering the knob sets a class that
  gives `cursor: grab` (`grabbing` while rotating) in the CSS partial.
- Keyboard: when `rotatable`, `[` / `]` on the focused canvas emit rotation −1° / +1°
  (Shift: 0.1°), normalised into range. Add this to the hint text: a new key
  `editor.reference.gestures-rotate` shown when `rotatable` (en: "Drag the round handle to
  rotate; Shift snaps to 15°. [ and ] nudge by 1°. Drag elsewhere to pan. Scroll to zoom. F fits
  the image." — de equivalent).
- `ReferencePrepare`'s rotation `<input>` gets `step="any"` so a dragged 12.3° does not fail the
  form's native validation.
- jsdom test: mount the preview (see how the existing viewport-controls test mounts it) with
  `rotatable`, dispatch pointerdown on the knob position and pointermove a quarter turn → emits
  ~90; pointerdown away from the knob → no `rotation` emit (pans instead); `]` key → emits
  start+1; not `rotatable` → knob press pans, keys emit nothing.
