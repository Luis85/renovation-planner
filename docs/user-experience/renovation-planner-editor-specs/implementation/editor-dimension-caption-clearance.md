# Caption clearance around native dimensions

Source-only draft; no verification or visual acceptance is claimed by this document.

The six fixed During pins fit around the three-line Room caption at the observed 9% zoom,
but at 5% their combined clearance moves the caption above the Room onto its native width
control. The correction keeps every pin, font, status line, dimension control and world point.

RoomDimensionLabels owns one ResizeObserver over its overlay and current dimension anchors.
An animation-frame callback coalesces layout updates, including position changes and native
button/inline-form replacement. Actual DOM rectangles reserve four pixels for focus outlines
and convert through the shared screenToWorld boundary. Equal rectangle/viewport snapshots do
not publish again. Removed anchors are unobserved; unmount cancels pending work, disconnects
the observer, clears its targets and clears the published display-only snapshot.

PlanCanvas passes that snapshot through ZoneLayer to ZoneShape, beside the unchanged shared
Evidence-pin projection. The existing 182 by 56 pixel caption envelope first clears obstacles
upward. If that result clips the measured canvas vertically, the nearest clear downward
position is used instead. Either placement may lie outside the Room, retaining its horizontal
anchor. An unchanged offscreen Room caption is not pulled back into view.

There is no clear vertical placement when controls cover the entire available canvas column
at the retained horizontal anchor. In that impossible case, the original caption remains
rendered; overlap can remain, rather than hiding text or moving geometry. Horizontal placement
and other floating panels are outside this bounded correction.

Verification prepared, not run:

- dimensionCaptionPlacement.test.ts mounts the production editor and compares all three real
  Konva Text rectangles against six pin hit targets and measured native dimension rectangles
  at 5%/9%, through pan and inline editing, plus the y=48 clamped-form downward fallback.
  jsdom has no CSS layout: placeAt supplies explicit DOM rectangle measurements while the
  real production dimension positions and native controls remain mounted. This file imports
  no new production helper, allowing a predecessor-production RED run to fail on overlap.
- dimensionObstacles.test.ts checks one observer, coalesced callbacks, equality, replacement,
  coordinate conversion, hidden controls, cancellation, clearing and disconnect.
- captionViewportFallback.test.ts records fully occluded and offscreen behavior.

Actual browser layout, four-scenario recapture, native inline-form focus, full performance and
the unchanged repository gates remain to be run by the integrating task.

## Initial measured regression results

The independent mounted test was run against the predecessor renderer (`242bfa33`, five tracked
production files temporarily restored and then restored to HEAD in `finally`). All three cases
failed for the expected real reasons: 5% dimension overlap, 9% inline-form overlap and a clamped
caption at y=−46.4 outside the canvas. Six native pin targets and all three Text nodes were required.

The current renderer at `5154504f` passed 25 tests across the new integration/lifecycle/fallback
files and existing scene/evidence-caption tests. Current types passed. Oxlint identified the pure
`sameBox` function nested unnecessarily; it has been moved to module scope without behavior change.
Remaining scoped lint, Room-dimension lifecycle regressions and actual browser checks are pending.

The browser preparation reads actual Konva Text/pin rectangles and native control rectangles
relative to the real Stage container, independently of the published obstacle snapshot. It uses
native middle-button pan, opens/cancels normal and top-clamped inline dimensions, and reverses
the pan. It checks three retained caption texts/font sizes, six fixed pin world positions, unchanged
world points/vault contents and visible, non-overlapping captions. No store writes or synthetic
production obstacle injection are used by that browser helper. Syntax checks passed; execution
awaits the next heavy slot.
