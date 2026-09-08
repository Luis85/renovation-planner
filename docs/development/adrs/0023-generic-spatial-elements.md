# ADR-0023 — Generic spatial elements in the floor sidecar

## Single Object rotation extension — 2026-09-08

One selected current `object` in Plan/Select can rotate by pointer handle, signed relative
degree input or either quarter-turn action. The polygon centroid is frozen at draft start.
Each preview transforms immutable baseline world-mm points; Shift uses the existing 15-degree
angular policy, while numeric input is exact and accepts decimal point/comma. A visible angle
reports the pointer preview. Release or Apply produces one existing guarded element command;
Cancel/Escape/tool retirement produces none, and zero/full-turn no-ops preserve exact points.
Undo/Redo restores the original/committed sequences through the shared ledger. IDs, Markdown
labels, links and independently stored intended geometry are preserved. No orientation schema,
new transform store or per-vertex snapping is introduced. Rendering and targeting share the
screen-sized handle geometry. Other spatial kinds and group transforms keep their separate
contracts. Verification is recorded in
[the release ledger](../../user-experience/renovation-planner-editor-specs/implementation/release-2026-09-08.md).

Status: Implementation in progress, 2026-09-07. Final combined verification and host acceptance remain open.

## Context

The full editor request includes the M02 Object, Path, Fence and Measurement doors. Interaction specification §5.6 explicitly describes Object as a generic placeable entity, with richer specializations later. §60 includes exterior Path and Fence. §82 describes a first coherent subset; it does not remove these doors from the full-plan scope. SDD §57 already establishes the temporary tool lifecycle and the existing Plan geometry sidecar owns floor geometry.

## Decision

Extend the existing current/intended `Structure` with optional `elements: readonly SpatialElement[]`. Each element has a stable `element-` ID, an explicit kind (`object`, `path`, `fence`, `measurement`), ordered world-millimetre points. Objects have an implicitly closed polygon with at least three finite points under the existing polygon contract. Paths and fences have at least two points and non-zero consecutive segments. A measurement has exactly two distinct points. Coordinates share the spatial ±1000 km bound. Self-intersection and winding normalization retain the SDD's accepted deferrals.

Path/fence/measurement length is derived from the points. Object footprint area is derived through Core geometry. These values are not a second stored quantity authority. A generic object does not silently reference a mutable Asset designer shape or create a new catalogue. Asset specialization can later use its explicit placement/revision contract.

Editable names are canonical metadata in optional Plan `spatialElements: readonly {id,name}[]`, stored in Plan Markdown frontmatter as `spatial-elements`. Geometry carries no names or descriptive facts. The presentation joins both by stable ID as `NamedSpatialElement`.

The existing `PlanGeometrySidecar`, `RenovationCommand` conditional two-document transaction, shared write ledger and dispatcher own writes, compensation, history and projection refresh. An explicit optional `spatial` input supplies current geometry and labels; omission preserves those fields, while an empty array intentionally removes labels. Existing `StructureCommand` wall operations preserve the element array. Current facts and intended facts stay independent. No new note, store or persistence service is introduced. Every unrelated wall/opening/Room/reference edit must preserve elements; comparison, scaling, target validation, deletion references and material source measurement must explicitly include them.

The sidecar writes schema v4 only when current or intended element data is non-empty. Older files keep their prior persisted versions. In-memory migration validates with v4; Undo removing the first element can restore the prior version. Old readers refuse v4 before parsing, avoiding silent loss through unknown-key stripping. Plan metadata writes v6 when non-empty spatial labels exist, after shared-record v5. It preserves shared links and all prior note fields; Undo can restore the prior version. Requirement provenance adds explicit `element-length` and `object-area` rules, using the existing quantity engine and preserving manual overrides. Those two rules write Requirement v3; existing source rules retain v2 and absent sources retain v1. These schema changes incorporate the UI shared-link checkpoint before publication.

## Presentation and ownership

Elements use the common temporary tool lifecycle, one versioned baseline per draft, visible preview, explicit Finish/Cancel, numeric coordinates and stable selection after creation. Saved elements appear in the existing spatial list and hit testing, with explicit kinds rather than wall fallbacks. Selection, numeric editing, movement, deletion, framing and connected renovation actions must use the same IDs as the sidecar. Room associations are explicit planning context, not inferred geometric ownership.

Finalization owns domain/schema/history/scaling, shared runtime/selection/rendering and Path/Fence/Measurement routes. The existing UI task owns generic Object creation/presentation after its preceding verified checkpoint. Integration must preserve its target-context and shared-record amendments.

## Verification

New domain and real-sidecar command cases cover shape validation, exact scaling, comparison, current/intended independence, schema version transitions, old-reader refusal, mixed Room/wall history and peer-write refusal. The foundation run passed 101 tests across 17 files, including production Path/Fence/Measurement creation, editing, deletion, undo/redo, retained drafts and read-only recovery. Combined types and full lint also pass. Final combined coverage, Object integration, visual and live-host acceptance remain pending.

Shared draft API: `runtime.elementTask` exposes `draft` (kind, name, points, cursor, loading, busy, conflict, error), `blocked`, `canFinish`, `setPoints`, `addPoint`, `undoPoint`, `finish` and `available`. It registers `place-object`, `draw-path`, `draw-fence` and `measure`. Object presentation uses the same `setPoints` preview and `finish` command as pointer input. Saved elements use `runtime.elementActions.edit/remove/move` and its root-owned preview. Movement carries the gesture-start element into the guarded action and refuses a changed kind or point sequence even after a peer edit has refreshed the leaf. Initial baseline recovery uses generation-guarded `needsRead/retry` without clearing the draft; captured baselines are not silently replaced. Element edit dialogs use the existing `DraftRecovery` read-only retry/source actions while retaining local text. Repeating an unchanged compensated creation attempt reuses its command and identity.

Mixed current-spatial deletion uses one existing RenovationCommand proposal for selected generic elements, walls and openings. It includes hosted openings in current/intended snapshots, preserves independent Room outlines, and refuses unresolved material or renovation references before confirmation. It preserves selection and captured-baseline guards across delayed reads and confirmation; compensation and Undo/Redo use the existing shared ledger. This is the `elementActions.removeMany` continuation, verified in the 117-test integration checkpoint at `88b9ee3d`.
