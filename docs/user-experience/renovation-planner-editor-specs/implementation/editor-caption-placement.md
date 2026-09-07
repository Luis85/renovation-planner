# Evidence pins and Room caption clearance

The fresh M14 capture showed the default centered photo pin covering the Room's area label.
The locked reference keeps numbered pins and Room identity readable independently. The
correction moves only the three-line caption when its screen bounds intersect a visible pin.
It keeps the stored pin position, circle hit target, numbering, selection callbacks, Room
geometry and camera unchanged. It does not reposition fixture data to conceal the overlap.

`evidencePins.ts` extracts the existing filtered world-position projection unchanged so both
the pin renderer and caption layout use the same positions and phases. `captionPlacement.ts`
clears intersecting pins from bottom to top in screen pixels; ZoneShape converts the resulting
offset into its existing world-coordinate layout. The clearance includes the current caption
width, all three text lines and their strokes. Hidden annotations, hidden renovation markers,
other perspectives and filtered pins leave the Room caption centered. Distant pins do not
move it. Existing layer order, identity transforms and cached geometry arrays remain intact.

## Evidence and exact scope

Base UI source `dc563c77e4fe5f563101203f52481de88719c91f` has the same complete tree as
integration source `5557385f3780c85e83b0a8338173c0378c358ea1`. The after captures and checks
use that source plus this commit's five-file M14 production change. No production changes
were made between verification and these committed artifacts. The
[manifest](evidence/editor-caption-placement/manifest.json) records SHA-256 hashes of every
changed production file and image, allowing the captured source to be checked against Git.

- [Before, light](evidence/editor-caption-placement/before-light.png) and
  [after, light](evidence/editor-caption-placement/after-light.png).
- [Before, dark](evidence/editor-caption-placement/before-dark.png) and
  [after, dark](evidence/editor-caption-placement/after-dark.png).
- [Custom accent](evidence/editor-caption-placement/after-custom-accent.png) and
  [German constrained Inspector](evidence/editor-caption-placement/after-german-constrained.png).

All four after images were inspected. Room name, area and status are separated from the
unchanged pin in the exposed canvases; the German capture verifies the constrained Inspector
and authentic loaded thumbnail. Its open drawer covers the canvas, so that image alone is
not evidence of canvas clearance. Native scene checks cover clearance through camera changes.

## Verification — 2026-09-07

- With the previous centered caption layout restored, the new native Scene test failed at
  the actual Konva text/pin rectangle intersection; the other two initial cases passed.
- Corrected source: 24 tests passed across four files in 29.72 seconds. Tests check all three
  real Text rectangles, including stroke, against two offset Circle rectangles, pan and wheel
  zoom, pin click/tap, unchanged geometry-array identity and vault bytes, stable numbering
  across an unplaced photo, and centering after phase/visibility/perspective changes. An empty
  Documents view and distant pins retain centered captions.
- Targeted coverage for the five production files passed the unchanged gates at 100%:
  71/71 statements, 30/30 branches, 29/29 functions, 43/43 lines. This is scoped evidence,
  not a full-repository coverage claim.
- Production build and types passed: 1,046 modules, Vite build 2.48 seconds. Whole Oxlint,
  scoped ESLint, Fallow dead-code/duplication checks and `git diff --check` passed.
  Existing analyzer ignores and the nonfatal hidden `.claude` warning are unchanged.
- The original `editor-planning-check.mjs --design` passed all four scenarios: 1440px light
  and dark, 1000px custom accent, 460px German, each 900px high. Node 24.20.0 and explicit
  Edge 152.0.4191.62 were used; this is not pinned Playwright Chromium or live Obsidian.
- Twelve automated axe scans had zero violations. Six scans require manual follow-up,
  including the German Photos scan; these incomplete checks are not accessibility passes.
  The four Photos scan records and original browser report are included in the evidence.

The full final runner previously passed six journeys and stopped in German Recovery at the
resize/Details-rail race. That failure is separate and owned by hardening. The final nine
journeys, eighteen reference comparisons, performance/cleanup interpretation and combined
repository gate must run after both corrections are integrated. No overall acceptance is
declared by this bounded checkpoint.
