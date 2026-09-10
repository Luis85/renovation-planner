# ADR-0025 — Spatial rotation through existing guarded commands

Status: implementation in progress, 2026-09-08. The user confirmed the expanded entity scope;
integrated verification and native acceptance remain pending.

## Scope and selection

Every free spatial item can rotate individually: Room, Area, Object, Path, Fence and Measurement.
Walls rotate with their hosted doors/windows/openings. Selecting an opening offers a clearly
labelled Rotate host wall action and retains the opening's selected identity. No opening is
detached or given an independent orientation. Reference plans retain their existing preparation
rotation and lock contract. Catalogue editing and group transforms are outside this action.

After being shown PR #93's new Opening-first prose at `56b4b906`, the user explicitly reconfirmed
Object → Opening → Wall → Room, with handles first and Alt overlap cycling. That latest decision
governs this release. PR #93 remains independently owned and untouched; this records the current
release contract without taking ownership of its closeout or review threads.

## Command and state ownership

A leaf-owned rotation action coordinates the existing source-specific paths. Rooms/Areas use
their conditional Zone geometry command and ledger, generic elements use the existing Renovation
command and element input, and walls use StructureCommand and its reviewed impact. It creates no
repository, persistent transform state, hierarchy, new identity or orientation schema. Markdown
metadata, links and independently stored intended geometry remain under their existing owners.
Preview is transient rendering state; it is never a second canonical geometry.

The pivot is frozen at draft start: polygon centroid for Room/Area/Object, length-weighted centre
for Path/Fence, midpoint for Measurement and wall. Every preview transforms the immutable initial
points. Pointer feedback can accumulate bearing deltas across the atan2 seam, but vertices never
accumulate transforms. Positive relative degrees turn clockwise in the downward-y world. Numeric
input accepts decimal point/comma; Shift uses the existing 15-degree snap policy. There is no
independent vertex snapping that could distort a rigid shape.

Release or Apply commits one guarded action. Zero/full-turn no-ops, invalid input, cancellation,
tool/selection retirement and disposal do not write. A version conflict refuses overwrite; a
confirmed write stays successful even when readback fails, and retry only reads. Undo/Redo restore
the exact original/committed geometry through the existing conditional history. Current perspective
edit permissions remain authoritative: Review is read-only, and generic current elements retain
their Plan-only boundary while existing Room/Area/wall editing permissions remain available.

## Walls and hosted openings

A wall turn rotates both endpoints about its frozen midpoint. Exactly coincident endpoints of
connected neighbours follow the corresponding junction. Opening IDs, kind, host IDs, offsets,
widths, heights and sills stay unchanged; their rendered position follows the host. Intersections,
degenerate walls and opening containment are validated before a write. The impact is previewed and
requires Apply, including quarter-turn presets. Independent Room outlines are not synchronized or
rotated implicitly. Selecting an opening makes the affected host visible and names it in the action.

## Handle and accessible alternatives

The handle uses a distinct circular-arrow symbol, a visible stem and a screen-sized grab region
of at least 44 px. Its placement avoids Room dimension labels and corner handles; rendering and
targeting use the same metrics and viewport conversion. The pivot and angle explain the draft.
Busy actions cannot advertise a handle that will discard its gesture. The Inspector provides the
same signed degree and clockwise/counterclockwise quarter-turn routes, with EN/DE text and usable
constrained layouts. No essential action depends on canvas input alone.

## Evidence and limits

The [release ledger](../../user-experience/renovation-planner-editor-specs/implementation/release-2026-09-08.md)
records exact revisions and source-specific tests, fresh persistence, final captures, native host
observations and unperformed physical-device/screen-reader checks. Existing axis-aligned Room size
forms remain bounded; rotated outlines retain coordinate editing. The accepted independent Room,
straight-wall, hosted-opening and no-durable-crash-journal boundaries remain unchanged.
