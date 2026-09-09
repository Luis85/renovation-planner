# Deleting individual saved-group members

User-authorized lifecycle correction, 2026-09-09. Existing individual deletion failed
because groups retained references to removed Zone, wall or free-element geometry.

- The Zone repository prunes the deleted ID inside its existing sidecar mutation, after
  the note deletion and with the existing compensation on failure.
- RoomBoundaryHistory snapshots membership as well as adjacency. Undo restores a deleted
  member at its original position only if the affected group's remaining identity,
  name and member order still match. A removed singleton returns before its surviving
  successor. Unrelated current groups are retained, including peer edits.
- StructureCommand and RenovationCommand prune membership when their proposed structure
  removes roots. This covers single-wall deletion, elementInput's single-object deletion
  and spatialRemovalInput's existing multi-item path. Their full baseline restores groups
  on Undo. Existing version/content guards remain; Renovation history also refuses a peer
  change to member order alone.
- The existing Zone undo sequence compensates a failed relationship or Requirement
  restoration by deleting the restored Zone again, which prunes its membership again.

No new schema, repository, transaction system or bulk-group deletion action is introduced.
Hosted opening IDs remain implicit members of their wall. No Room outline is deleted
when a wall is removed.

Verification on 2026-09-09: scoped Oxlint and ESLint plus vue-tsc passed. All **40 tests
across six files passed**, including 22 new grouped-deletion cases and the existing Room
boundary, mixed history, reference-compensation and legacy spatial-removal suites.

The new cases exercise fresh-repository Room/non-Room area, wall and object history;
singleton and last-group removal; opening-only and host-opening preservation; stale
proposals; peer regrouping, ID reuse and member-order refusal; unrelated-group preservation;
and repository, relationship-write and Requirement-restore compensation with retry.
Native/browser acceptance and the unchanged whole-repository gate remain with the
integrated release verification.
