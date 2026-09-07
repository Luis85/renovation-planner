# M14 — real gallery capture and observed correction

The native planning design journey at `a59a0ec3c0ea9011016d755dc8fc55b972bed0a2`
completed in light, dark, custom accent and German constrained layouts using Edge 152.0.4191.62.
All original actions and accessibility assertions passed. Six distinct synthetic PNG inputs were
linked through real production forms in reverse creation order with explicit dates and Work.

**Visual result: blocked.** Direct comparison of all four current captures with
`images/M14-room-evidence.png` found that selecting the third photo cleared During phase.
The screenshots therefore contain seven cards and seven pins, including the original Before
photo. The initial script checked the six-card filter before selection, not after it. It also
allowed native focus to scroll the selected metadata into view while the heading, filters and
Add action moved above the viewport. A passing journey did not establish visual fidelity.

The original four screenshots, runner report/log and hashes are retained in
[the initial capture evidence](evidence/editor-gallery-selection/initial/).

## Bounded correction, still WIP

- Root owns the semantic phase fix and native thumbnail/pin/row/out-of-phase navigation cases.
  The capture must not work around that behavior by reapplying the filter.
- UI reduces existing card padding and title spacing, caps thumbnails at 88 pixels, and gives
  the existing creation button a primary appearance and localized Add photo/document/note label.
  Every title, file path, date, phase and action remains present; no control or content is hidden
  for a screenshot and no pin position is changed.
- The capture now checks the active During filter and six ordered identities after selection
  and after resize. In full layouts it measures the heading, filters, Add action, first/last
  card and selected metadata against the visible Inspector bounds. Constrained layouts retain
  normal scrolling and all content. Actual corrected captures remain pending.
- A source calculation of the existing caption-placement algorithm explains the misplaced
  Kitchen caption: the erroneous centered seventh pin chains upward shifts to about −134 px;
  the unchanged six During pins need only about −20.6 px, leaving the caption inside Kitchen.
  This is a diagnosis to verify by recapture, not a new renderer change or a visual pass.

Only script syntax and source/diff checks have run on this correction. Types/lint and the
corrected native/browser state must be checked after Root's semantic checkpoint is integrated.
