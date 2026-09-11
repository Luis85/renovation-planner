# ADR0026: Saved spatial groups and explicit Room enclosure

Status: Accepted for implementation from the user's explicit2026-09-08 direction.

The user requires saved groups, one-operation movement/rotation of Room-wall-opening
assemblies and an explicit Enclose with walls action that groups the result. This
supersedes the release's earlier exclusion of group transforms, while retaining the
Project/Floor hierarchy, seven canvas layers and independent spatial identities.

Store flat, disjoint groups in plan geometry sidecar schema6, following opening swing5.
A group contains stable root IDs for Zones, walls or free elements. Openings belong to
their wall and follow it implicitly, including openings added later. Grouping existing
groups flattens membership; ungrouping preserves every spatial item.

Group transformations are rigid and use immutable initial geometry and a frozen union
bounds centre. One conditional sidecar replacement changes all member geometry and
connected wall ends. It preserves intended geometry and existing metadata. Explicit
Room enclosure creates or reuses matching walls and adds its group in the same history
entry; this is not continuous automatic synchronization of independently edited outlines.

Zone histories also observe geometry. Prepare opaque Zone versions from note snapshots
before the group write, derive the produced versions from the exact written geometry,
and record both Zone and Plan receipts. Never use a post-write read as our write receipt.
This keeps mixed individual/group history cooperative while retaining foreign-write guards.

Amended 2026-09-11 at the user's direction: enclosure places each wall OUTSIDE the Room,
its centre line half a thickness beyond the edge so the inner face is the outline (mitred
corners, concentric curves). An edge another Room shares exactly, or one a wall is already
centred on, keeps a centred wall both Rooms reuse. An outline whose moved edges cannot meet is
refused (`spatial.wall-offset`), never repaired. Walls stay centre-line data; nothing migrates.

Implementation and evidence are tracked in
[the group implementation plan](../../user-experience/renovation-planner-editor-specs/implementation/persistent-groups.md).
Foundation tests have passed; UI, curve compatibility and final release acceptance remain
separate pending work. Schema7 is reserved for the user's curved boundaries and8 for
Stair/Arrow elements, each based on its verified predecessor.

Deleting an individual member prunes that root ID from its group and removes an empty
group. Hosted openings remain implicit: deleting an opening does not ungroup its wall;
deleting the wall removes its openings through the existing structure path. Zone deletion
captures and restores group membership with Room boundary history in the existing
compensated reference-deletion sequence. A changed affected group refuses restoration;
unrelated groups retain peer changes. Structural commands restore their original group
catalogue through the same version-guarded Undo/Redo path. Member order is preserved.
This does not introduce bulk group deletion or a new transaction mechanism.
[Implementation and verification](../../user-experience/renovation-planner-editor-specs/implementation/group-member-deletion.md)
record the deletion and compensation coverage separately from group interaction UI.
