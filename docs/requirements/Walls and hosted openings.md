---
type: PBI
parent: "[[Zones and spatial objects]]"
order: 50
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Walls and hosted openings

Rooms are sufficient for fast spatial planning, but precise renovation work also needs the
boundaries between them and the doors or windows those boundaries host. A wall and an opening
are domain spatial objects with stable identities; they are not canvas segments or decoration
stored only in a renderer.

The three Tasks beneath this PBI form one independently schedulable domain slice because none is
useful as a separate product capability. [[Persist a wall as one spatial identity]] establishes
the stable identity, valid world geometry, canonical round trip and non-canvas read path.
[[Host and restore an opening on its wall]] adds an opening's own stable identity, its single
explicit host-wall reference and host-relative placement.
[[Keep wall and opening references safe through change]] then carries that relationship through
wall edits, deletion, undo and reload.
Together they establish one invariant: wall and opening identities, geometry and hosted
relationship agree after every successful command and reload, and no invalid placement, partial
write, geometry edit or delete is allowed to present an orphaned opening as coherent saved data.
Invalid host placement writes neither opening metadata nor geometry. A missing host is reported
as unresolved rather than silently detached or reassigned. A wall move or resize preserves a
valid hosted placement or reports its impact before refusing or applying a defined resolution;
deletion cannot leave a dangling opening. Compensation or recovery keeps a failed logical write
from appearing complete, and accepted changes remain reversible and reload as one coherent
wall/opening state.

Their order is stricter than the parent links alone can express. The accepted spatial-object
schema decision must choose the wall and opening geometry representation before the first Task
implements it; this PBI requires the invariant rather than choosing a sidecar shape. Hosting
depends on persisted wall identity, and reference-safe change depends on the hosted relationship,
so the three domain Tasks do not run in parallel. The editor PBIs may design connected-wall
drafting, snapping, room detection, selection and presentation in parallel only against the
accepted contracts; they consume this slice and do not replace its persistence or host-integrity
rules.

Wall assemblies, finish layers, demolition quantities, structural analysis, trade assignment,
execution status and as-built geometry remain outside this slice. Its source is the locked wall
workflows [[Draw connected walls and create an enclosed room]],
[[Add and safely edit a wall opening]], [[Edit a selected wall precisely]],
[[Delete a selected wall safely]] and
[[Inspect a selected wall]], together with M04 Draw Walls, M07 Wall Selected, the editor
implementation plan Phase 5, the first vertical slice plan ADR-SO seam, PRD §15, §34, §60 and
§64, and SDD §17, §26, §39–42 and §57.

## Outcome

A wall and its hosted openings survive reload as canonical spatial objects, and no edit or delete
can silently break their relationship.
