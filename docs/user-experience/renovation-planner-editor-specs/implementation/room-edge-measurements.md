# Room edge measurements and free-form discovery

Baseline: combined `21ce3b3e`. User requirement on 2026-09-08: measurements remain visible for
every Room edge, including non-rectangular outlines, rotation and point editing. This replaces
the earlier axis-alignment-only display limitation. The numeric rectangle editing boundary in
SDD §20 and M03 remains: a rotated or irregular outline must not be replaced by its world bounds.

| Requirement | Implementation | Verification |
|---|---|---|
| Every current Room edge | Actual segment distances, including closing edge, with outward labels and connecting guides | Rectangle, rotated rectangle and concave outline cases |
| Measurements follow edits | Selected Room reads the transient polygon before persisted geometry | Rotation and point preview; no repository/history mutation |
| Draft measurements | Rectangle's existing two editable lengths plus its opposite edges; free-form placed/proposed segments | Numeric rectangle and free-form task switch |
| Valid numeric routes | Existing width/depth controls remain for axis-aligned rectangles; every other outline retains Edit corner coordinates | Existing inline and outline suites |
| Discover free-form Room | Visible Draw a free-form room action in Add Room banner and Inspector; shared guarded switch preserves name and draft points | Constrained workspace with Details closed |
| Preserve rotation placement | Every native edge caption participates in the existing dimension/rotation obstacle observer | Existing observer and forthcoming combined image checks |

The free-form sketch remains open while corners are being placed: measurements describe the
placed segments and the proposed next segment, rather than inventing a closing edge before
completion. Closed persisted/preview polygons include their last-to-first segment. Labels use
the shared metre formatter and expose a localized edge number and length; they are read-only
text, so they do not promise orientation-changing axis edits. The existing Inspector coordinate
form remains the precise irregular-outline route. Rendering changes no schema, commands or data.

Source verification passed: production vue-tsc, scoped ESLint and Oxlint for every changed
TypeScript/Vue file, and Node syntax for `scripts/editor-room-edge-check.mjs`. Seven targeted
files cover 23 unique cases: actual segment geometry, mounted rotation/point/draft previews,
free-form creation, native inline dimensions, outline editing, obstacle observer ownership and
caption clearance around dimensions/pins. The initial six-file batch passed 19/20; an exact
positive-zero versus negative-zero normal comparison was corrected to numerical closeness.
The affected three unit cases plus three native caption-clearance cases then passed 6/6.

Whole Oxlint initially also found three unrelated creation-baseline issues in
`DraftRoomDimensions.vue` and `RoomDraftSketch.vue`; their owner supplied `2fa68a8f` for parent
integration. Those fixes are not duplicated in this topic. The new four-scenario browser script
is authored and syntax-checked but **unrun** here. It checks four rectangle lengths during an
actual pointer rotation, Escape without writes, the visible free-form route and six completed
concave Room edges. Parent serializes fresh combined capture. No native-host, physical-device
or screen-reader acceptance is inferred from component tests.

## Bounded curve proposal for integration review

No curve persistence is implemented in this topic. Current SDD §§22–26 and Zone geometry model
use straight Polygon points. A curved Room needs a versioned domain geometry contract; a smooth
canvas path alone would make saved geometry, measurements and quantities disagree.

Start with **circular arcs on individual Room edges**. Retain endpoints and add a signed bulge
(`tan(sweep/4)`) per curved edge, with zero meaning straight. Present one bend handle and precise
radius/sweep entry. Keep this user model distinct from connected Wall/opening geometry. Stable
edge identity and insert/delete/split semantics must be specified before persistence migration.

Integration points:

- Core: finite arc validation, bounds, exact arc length, area and centroid contributions,
  projection/hit testing and self-intersection checks. Rendering may tessellate with a declared
  error tolerance, but persistent coordinates and cost quantities must not use display sampling.
- Domain/application: a versioned Room boundary type, guarded edit command and geometry-change
  events; preserve exact Undo/Redo, peer-generation refusal and readback recovery.
- Infrastructure: sidecar schema migration, old-reader refusal and round-trip tests. Existing
  straight Rooms retain exact coordinates and identities.
- Editor: shared curved rendering/selection/preview, edge measurement labels, bend handle and
  non-drag numeric route. Point insertion/removal must explicitly preserve or replace arcs.
- Transform/quantities: translation, rotation and uniform scaling retain the arc; nonuniform
  scaling must be refused unless ellipses become a supported domain type. Area/perimeter driven
  quantities, readiness and review-note summaries consume the same analytic geometry.

The latest user also superseded the always-visible labelled rotation control with small curved
arrows on hovered item edges. That follow-up retains generous hit targets, click-to-angle and
the guarded gesture, and requires coordination with parent-owned box/group selection before
changing target resolution. The earlier `5853827a` presentation is a verified predecessor,
not final user acceptance.
