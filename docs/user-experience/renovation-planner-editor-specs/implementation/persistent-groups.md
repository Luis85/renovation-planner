# Saved groups and grouped geometry — implementation plan

User authorization: save groups with the plan; move/rotate selected Rooms, walls and
hosted openings together; explicitly enclose a Room with walls and group the result.
This supersedes the earlier release's no-group-transform boundary. It does not change
the Project/Floor hierarchy or make every Room outline automatically own its walls.

## Model and commands

Flat groups are stored in plan geometry sidecar schema6, following opening swing5.
Each group has a stable id, name and explicit root member IDs. Root members are Room/
Area IDs, wall IDs and free element IDs. Openings are implicit wall members, so a new
Door/Window added to an existing grouped wall follows that group without a separate
membership write. Grouping selected existing groups flattens their roots; groups do
not overlap or nest. Ungroup changes only group metadata.

Rigid transforms replace one conditional sidecar document, preserving source order,
IDs, opening fields/swing, intended structure and unrelated metadata. Coincident ends
of neighbouring walls follow moved junctions through the existing topology policy.
The union bounding-box centre is frozen for rotation. Invalid geometry refuses before
any write; a peer write, including identical geometry with a new receipt, retires old
history. The command and dispatcher keep successful-write/readback recovery read-only.

A Room version spans its note and geometry entry. Group writes therefore prepare opaque
Zone version projections before the sidecar write and record the produced geometry's
versions after it succeeds. No post-write read can adopt a peer's version as our receipt.
This preserves ordinary Zone → Group → Zone Undo/Redo without weakening foreign-write
guards or writing the Zone notes again.

Calibration preserves group identity/membership while scaling its member geometry. Old
readers refuse schema6. Every geometry producer and freshness comparison must preserve
or account for groups; grouping cannot silently disappear during another edit.

## Presentation integration

SelectionStore keeps actual member IDs. Normal selection expands saved groups; explicit
deep selection can address a member. Input integration uses expandSelection/selectionMove
ports; right-click actions use the optional per-leaf CanvasGroupActions provider. Group
rotation uses an explicit transient group target and member-generation stamp, not a fake
persisted Object. Member Room preview polygons feed all-edge measurement rendering.

Enclose with walls creates missing matching edges, a boundary record and the group in one
history step. It reuses existing exact matching walls rather than duplicating them. Curved
Room/Wall enclosure will use the later schema7 arc primitives and exact arc bounds.

## Current storage follow-up

PR #110 incorporates the updated #109 and fixes demonstrated group/member-order and
name round-trip gaps. Current automated checks, reconstruction/recovery evidence and
remaining gate failures are recorded in [the delivery receipt](group-storage-delivery.md).
Manual acceptance is user-owned and pending; it does not block this storage step.
Group interaction UI and the overall editor plan remain separate work.

## Historical foundation verification

Foundation checks pass: TypeScript, whole-tree Oxlint and scoped ESLint. Four targeted
files cover33 unique passing cases across the initial run and exact reruns: the initial
31/32 result exposed only the legacy future-schema6 fixture, updated to7 because6 is
now supported; the corrected three-file run passed18/18 and the final group-model run
passed10/10 including the new namespace-collision refusal.

These checks cover older-reader refusal, fresh sidecar reconstruction, root/implicit
membership, connected endpoints, preserved opening swing, mixed Zone→Group→Zone exact
Undo/Redo, invalid membership, pre-write read failure, peer and identical-content
foreign rewrites, and one-write enclosure with existing-wall reuse. They do not yet
certify the group UI/facade, fresh full runtime, pointer cancel/readback recovery or
curved geometry. Those, the unchanged full gate, final images and native acceptance
remain pending in the next integration steps.
