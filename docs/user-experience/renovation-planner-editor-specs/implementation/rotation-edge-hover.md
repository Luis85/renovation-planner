# Edge-hover rotation controls

Baseline: `e0feef74`, including the all-edge measurement continuation. The user's later
2026-09-08 decision replaces `5853827a`'s always-visible labelled control with small curved
arrows on hovered item edges. That earlier implementation remains historical tested evidence,
not accepted final design. The click-to-angle, drag threshold, frozen pivot/geometry, snapping,
guarded source commands and Inspector alternatives remain required.

## Bounded interaction plan

- Hover changes no selection. Show up to four small curved-arrow icons on clear edge positions;
  each keeps an unobstructed 44×44 CSS-pixel target. Native measurements and resize vertices
  take precedence in placement. Prefer longer edges and positions away from midpoint labels.
- Hovering an arrow reveals centre and click/drag guidance. No persistent Rotate label or
  oversized circular button remains. Press and drag retain one frozen control; other arrows
  disappear during the gesture.
- Pressing an unselected item's arrow selects that item and then reacquires its fresh target
  and generation before starting. A click opens the same precision form, and a deliberate drag
  rotates. No unselected item changes merely because the pointer crosses it.
- Hovering a selected group member preserves the current group. Root supplies the explicit
  group target/member facade; no fake Object identity or group persistence is introduced here.
- Alt retains normal overlap cycling and suppresses rotation. Input agent owns blank-canvas
  marquee, body selection, Pan and keyboard/context-menu routing; this topic edits only rotation
  admission helpers and its branch before body/member handling.

## Verification checkpoint

Production vue-tsc, scoped ESLint/Oxlint and both browser-script syntax checks passed. The targeted suites cover 98 unique cases across nine files:
rotation geometry and gestures, explicit group bounds, actual DOM-pointer hover/precision,
Konva glyphs, existing Object/Wall runtime guards, Inspector routes and overlap selection.
The initial eight-file run passed 92/96; two fixtures used an invalid element ID prefix, one
off-centre free-angle assertion demanded exact cardinal rounding instead of exact preview/commit
agreement, and one old Room paint test had no hover precondition. Those fixtures were corrected.
The three affected files then passed 36/37 before the Room precondition was placed in the correct
test; the final full Object runtime plus new group presentation file passed 24/24. No conditional
Konva-root workaround was retained. After extracting the selection admission helper to meet
the complexity budget, final scoped lint/types and 15 affected gesture/DOM-pointer cases passed.
Whole-project and native gates remain parent's responsibility.

The browser probes now read an actual entity coordinate to begin native hover before querying
the visible edge control. The Object rotation and Room-edge drivers use arrow hover/click
semantics, not the rejected permanent label. These updated browser drivers are **unrun** at this
checkpoint; no new screenshot, host, device or screen-reader acceptance is claimed.

## Group integration seam

`RotationShape` has an explicit `group` kind and optional aggregate `visible`. Its pivot is the
centre of the union bounds; handles use the group's envelope rather than connecting unrelated
member vertices into a false polygon. Hidden geometry remains in the transform. A group has
canvas controls only when its descriptor explicitly says it is visible; Inspector availability
is separate. Root's callback also checks that the hovered member itself belongs to a visible
source layer.

`Runtime.groupRotationTarget(memberId)` may resolve a saved group before selection or the current
transient `selection-group`. Arrow admission uses input's shared `expandSelection(id, deep)`
port before reading the fresh selected descriptor; only actual member IDs enter SelectionStore.
The shared `SelectionInteractions.ts` dependency is copied verbatim from input `2f2e99c3`; parent
integration retains input's complete port extension and its own marquee/body-move behavior.

Root still supplies member-generation validation, group preview/rotation commands and member
preview polygons for all-edge measurements. In particular, group command dispatch must precede
the singleton facade's local-generation check: a root-provided member-generation stamp is not
the singleton's local selection counter. Schema6 and curve schema7 remain separate concerns.
