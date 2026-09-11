---
adr: 20
title: Connected walls and hosted openings
status: Accepted
date: 2026-09-06
area: spatial
---

# ADR-0020: Connected walls and hosted openings (ADR-SO)

The first non-polygon entity triggers SDD ADR-SO. Add a `structure` section to plan sidecar
schema v2, alongside the unchanged polygon `objects`. The application port exposes domain
points and millimetres. Existing Zone IDs, polygon entries, note ownership and reference
appearance stay intact. No wall is a polygon or a Zone. Walls/Openings contain spatial facts
only, owned by this sidecar; there are no redundant Markdown notes for these measurements.
Room names and classification continue to belong to existing Zone notes. Renovation records,
wall construction text, work/material/cost/evidence links and their future note ownership are
outside this decision and unavailable in this contribution.

Wall: stable `wall-` ID, start/end centre-line points, thickness and height. Opening: stable
`opening-` ID, door/window/opening kind, host wall ID, distance from host start to opening start,
width, height and sill. All units are mm; y points down. Exact numeric inputs use the existing
metre parser and whole-mm rounding; untouched pointer geometry keeps its precision. Coordinates
are bounded to ±1e9 mm; wall lengths and positive dimensions to 1…1e6 mm. This bounds precision,
not building safety. Straight walls only. Exact coincident endpoints define connectivity.
Crossings, T junctions, duplicate/reversed segments and collinear overlap are refused; users
must end/start separate segments at junctions. No implicit splitting or polygon repair.

Pointer snapping prioritizes endpoints within 8 screen pixels (capped at 100 mm in world space),
then axis alignment within the same tolerance. Numeric coordinates are exact and do not snap.
An explicit closing point creates a loop. Only a simple nonzero closed chain can offer a Room;
walls plus the optional existing Zone creation are one compensated history operation.

Room boundaries store room ID and the creating wall IDs as provenance/adjacency context.
They are not a second canonical Room outline and do not introduce a new Room entity (ADR-0016).
Later wall changes preview affected Room names and explicitly keep Room outlines unchanged.
Room size edits likewise do not move walls. Removing a wall removes its boundary association,
retaining the Room; deleting a Room removes its associations. Room deletion Undo restores the
association with the original IDs through a conditional validated sidecar write; a failed
relationship restore compensates the restored Room. No automatic synchronization.

Wall length edits anchor the start and preserve direction; the end junction and every exactly
coincident endpoint move together. Pointer endpoint edits use the same edit/validation/command
path and require the same impact confirmation. Openings retain absolute host offsets, width,
height and sill. Horizontal opening intervals may touch but never overlap, even at different
sill heights. Containment includes wall ends and height. Invalid edits are refused without
clamping, moving or detaching openings. Wall deletion explicitly includes hosted openings and
boundary associations; opening deletion affects only that opening.

All writes use the existing versioned sidecar store and dispatcher. Composite operations must
compensate using versions produced by their own writes and report uncompensated failure.
History must refuse changed snapshots and peer changes. Calibration rescales wall endpoints,
thickness/height and all opening measurements around world origin, together with polygons.
The v1→v2 migration is pure and idempotent; reads never rewrite notes or sidecars. Future
versions are refused. No durable crash journal is added: abrupt host/process termination
between a Room note write and compensation remains the existing ADR-0019 recovery limitation.

Acceptance evidence and remaining gaps are recorded with Phase 5, separately from this contract.


## Room on the inner faces — 2026-09-11

A Room offered by a closed wall loop is created on the walls' inner faces: its outline is the
loop's centre lines moved inward by each wall's half thickness, mitred at the corners. It was
the centre lines, which counted half of every wall as floor. A loop whose inner faces cannot
meet is refused with `spatial.wall-offset`. Explicit enclosure follows the same rule from the
other direction (ADR-0026's amendment).

## Opening swing and point-placement extension — 2026-09-08

The user-approved opening-usability concern adds optional host-relative `Opening.swing`
(`hinge: start|end`, `side: left|right`, finite `angle: 0..180`) to current/intended geometry
sidecar schema5. The migration changes the discriminator in memory; only saved swing fields
require version5. Legacy absence remains absent and renders Door90°/Window0° defaults; plain
Openings have no leaf. Host rotation/calibration preserve these relative facts. No Plan-note
schema, independent opening endpoint or new repository is introduced.

Pointer placement projects the clicked opening centre onto its existing host and bounds the
complete width. Stored offset retains its leading-edge meaning. Move-to-point uses the same
reviewed fresh-baseline structure edit and reversible command as numeric opening edits.
[Opening-usability evidence and remaining acceptance](../../user-experience/renovation-planner-editor-specs/implementation/opening-usability.md)
records the exact persistence, geometry and runtime checks.
