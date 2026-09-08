# Stairs and direction arrows

The user requested native editable Stairs and Direction arrow tools. The approved scope
starts with straight stairs and adds two entries to the existing eleven Add routes.
M01's reference image was inspected: the stair projection needs a full footprint, repeated
tread lines and a directional indicator, rather than a generic box or bitmap.

## Approved schema-8 contract

- Stair: `kind: 'stair'`, exactly two ordered centreline points, plus
  `stair: { width, treads, direction }`. Width is world millimetres (1…1,000,000), tread
  count an integer (1…200), direction `up` or `down`. Run derives from the centreline.
  Initial defaults are 900 mm width, 3000 mm run, 12 treads and up.
- Arrow: `kind: 'arrow'`, two or more ordered open points. Its arrowhead derives from
  the final segment, so neither heading nor duplicate head geometry is stored.
- Existing Plan metadata owns the name. Sidecar geometry owns points and stair options.
  Rotation/group movement transforms the actual points and preserves options; calibration
  scales stair width as well as points.

Rendering, Object-tier hit testing, marquee, framing, group bounds and rotation-control
placement must use the complete derived stair footprint. Actual move/rotation commands
must retain the two-point centreline; a hit-test outline must never replace stored points.
`spatialElementFootprint` is the shared pure projection for those consumers.

## Icon catalogue evidence

Read-only inspection of Obsidian 1.13.7's bundled `app.js` on 2026-09-09 confirmed
`arrow-up-right` in its Lucide catalogue; no stair icon key exists in that bundle.
Direction arrow uses that native key. Stairs uses deliberately authored application
artwork, `rp-stairs`, registered through Obsidian `addIcon` and removed during plugin
unload. It is a stepped outline in the host's 100-unit custom-icon coordinate system.
`HostIcon` preserves the application namespace and uses `lucide-` for native keys; neither
path substitutes a missing icon. Registration/catalog regressions are authored. Actual-host
verification of the final joined build remains pending.

## Current preparation

The real group-6/curve-7 foundation `3192c463` is integrated. The existing migration chain
now extends from 7 to 8. The writer emits 8 only while a current/intended stair or arrow
exists; earlier facts retain their minimal schema. Group and curve fields survive the new
DTO. Width, tread count and direction participate in geometry equality, so a parameter-only
peer change cannot be mistaken for the captured geometry.

Creation uses the existing ElementTool and command facade, with the same Zone Shift helper.
Stairs use two clicks or the numeric dimensions form. Pending numeric edits block Finish;
the original eleven Add routes remain alongside the two additions. Selected stairs expose
width/run/treads/direction edits; Arrow vertices use native handles and the existing guarded
element movement command. Native Konva geometry, full footprint selection/framing/group
bounds, and existing rotation controls share the stored centreline and derived projections.
Names stay in the Plan metadata, never in the sidecar. Context-menu edit/rename/delete/rotate
routes use the existing typed element actions.

The verified curve UI/projection continuation `6dcb8942` is also integrated. Shared hit,
outline, framing and rotation helpers retain its analytic curve paths and the Stair footprint
projection. Canonical curve parameters and stair options remain distinct persisted facts.

## First verification checkpoint — 2026-09-09

Scoped ESLint/Oxlint and TypeScript passed. Seven files passed all 42 cases: stair geometry,
precision-preserving form parsing, schema-8 persistence/history, creation/edit/rotation and
Arrow endpoint interactions, plugin icon registration/removal, HostIcon catalogue behavior,
and the inherited curved presentation regression. These use the aligned shared runtime
dependencies. The initial lint pass caught banner sentence case and a test-only mutating
array method; both were corrected, with the corrective pass green. The initial type pass
found an unsupported harness HMR type; the harness keeps its explicit page-unload cleanup.

Existing element lifecycle, selection/framing, line constraints and stylesheet regressions
remain queued. This checkpoint does not establish the full joined gate, fresh visual
comparisons or actual-host acceptance.
