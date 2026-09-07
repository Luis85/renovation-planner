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

After integrating Root `f3067d82` as `03057f63`, current types, whole Oxlint and scoped source
ESLint passed. The first strengthened recapture passed the post-selection/resize phase and six-
identity assertions. Its actual Light image shows six photos/pins and the caption inside Kitchen.
It stopped because the visibility probe measured the `display: contents` shell wrapper, which
has no bounding box. The probe now measures the real Inspector aside. Pixel inspection also
showed the selected Work metadata cut at the bottom, so the thumbnail cap was reduced from
88 to 80 pixels, retaining all card text/actions. The next recapture must validate both changes.

The next run at `28878a5d` reached the real visibility assertion: heading, filter, Add and six
cards fit, but the selected metadata card still exceeded the Inspector bottom. Its existing
14-pixel padding and 10-pixel grid gaps are now tightened to 8 and 4 pixels only for the metadata
list immediately following the photo gallery. Text, image size, controls and their order stay
intact. Visibility failures now report the measured rectangles as well as the selector.

Root's subsequent review of the locked image clarified that visibly repeating all metadata on
every thumbnail was an implementation preference, not a user requirement. The gallery now uses
the existing visually-hidden utility for its descriptive titles and duplicate metadata while
retaining descriptive accessible button names and full visible selected-photo metadata. Missing
file and thumbnail-error notices remain visible; when a thumbnail is unavailable, its file
metadata remains visible too. Preview images return to a natural 4:3 composition capped at
140 pixels. This product presentation follows the reference's image emphasis; it is not a
screenshot-only override. Current runtime/pixel verification of this revision remains pending.

## Current verified journey — bb77de0f

The complete strengthened planning design run passed in all four scenarios on
`bb77de0f95cc353e8b77407d6edab278505f239e`. During remains active after selection and resize,
six dated photo identities retain their order, and the selected date/Work and Room context
remain correct. Full-layout M14 and all-clear M17 content passed measured Inspector bounds;
all four scenarios passed their automated accessibility scans. German's narrower drawer uses
ordinary scrolling. Current types, whole Oxlint, scoped ESLint and 18 related overview/Review
native tests also passed. Earlier 34 Evidence/phase/Review native cases passed.

All eight current gallery/Review captures were visually inspected against M14/M17. The gallery
image hierarchy, active selection and complete selected metadata are now coherent. **One visual
gap remains:** at the custom theme's 5% canvas zoom, the Kitchen caption overlaps its 4 m
dimension label; the Light/Dark 9% scenes do not. This needs a bounded renderer correction and
fresh capture. The four-theme journey pass is not final M14/M17 or all-eighteen-screen acceptance.

The current images, full runner report, accessibility reports, verification logs and hashes are
in [verified-journey](evidence/editor-gallery-selection/verified-journey/). M17's additional
issue-rich state, matching overview captures and the uninterrupted nine-journey final run remain
outstanding. No failed/interrupted outputs are combined into a passing final matrix.
