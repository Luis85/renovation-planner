---
type: Task
parent: "[[Upload an image to be used as background]]"
order: 70
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Run the six additional editor interaction drivers]]"
---

# Verify reference plan scaling and photo search

## Evidence

Pull request #109 enlarged the reference calibration viewport and #108 added image search and
import to Photo creation; both are on `main`. `remaining-plan.md`'s row *P1 – Referenzskalierung
und Foto-UX* (in `docs/user-experience/renovation-planner-editor-specs/implementation/`) asks for
checks the visual matrix does not name:

- the image size actually painted;
- pan, zoom and fit controls that can be reached;
- A/B measurement coordinates holding under zoom and pan;
- narrow views compared with the size the earlier CSS rendering painted;
- photo search in a folder full of non-image files.

The reference journey passed in the matrix at `22772267`, but the summary
`scripts/editor-reference-check.mjs` returns names preparation, measurement, review, accent, PDF
replacement, reflow, PDF commit and storage — nothing about painted size, camera actions or photo
search. Those checks are therefore unverified.

The photo half would also read under [[Capture and retrieve evidence from spatial context]]. This
note sits under reference setup because four of its five checks concern the reference viewport.

## Why it matters

A calibrated reference whose A/B points drift off their image coordinates under pan or zoom
corrupts every later measurement without saying so. A photo search that stalls in a large vault
folder blocks capture.

## Approach

On `main`, once the six additional drivers have run and current images exist, measure the painted
image and control geometry in a browser at 1440 px and 460 px, drive pan, zoom and fit around a
calibrated reference, and time photo search over a folder seeded with many non-image files.

## Acceptance criteria

1. The image and its controls are large enough and reachable without overflow, at 1440 px and at
   460 px.
2. Pan, zoom and fit change no calibration, and the A/B points keep their image coordinates under
   zoom and pan.
3. The narrow-view painted size is compared with the earlier CSS-rendered size, with both numbers
   recorded.
4. Photo search stays bounded and responsive in a folder with many non-image files. The file count
   and the timing are recorded.

## Risks

- A measurement read off a fixed layout box reports the same number whatever the canvas paints;
  perturb the view and re-measure before trusting it.
- Search timing depends on the machine, so the machine is recorded with it.

## Outcome

Reference scaling and photo search have measured evidence on the merged build, rather than an
inference from a passing journey.
