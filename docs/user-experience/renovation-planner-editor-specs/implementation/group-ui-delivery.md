# Group interactions: PR #113 follow-up

This step is limited to [PR #113](https://github.com/Luis85/renovation-planner/pull/113)
on `codex/editor-deliver-groups`, in its dedicated `.worktrees/editor-deliver-groups`
checkout. The clean main checkout and downstream branches are preserved. Merge
`8bb64869` incorporates updated #112 through
`24719e5be6f9692b49cb25ab38cb2337222eb6a9`; no downstream implementation branch was merged.

The [overall remaining plan from #117](https://github.com/Luis85/renovation-planner/blob/5c15006c38d01b530641ac6da1ed154ab52227c6/docs/user-experience/renovation-planner-editor-specs/implementation/remaining-plan.md)
remains open. This receipt supersedes the validation status of the
[original reconstruction](delivery/group-ui.md) for this concern only. Governing
contracts are [ADR0026](../../../development/adrs/0026-saved-spatial-groups.md),
[saved groups](persistent-groups.md), [interaction delivery](persistent-group-interactions.md),
and [member deletion](group-member-deletion.md).

## Demonstrated gaps and changes

- A saved group reduced to one Room rendered its selection outline from the
  rotation preview, but left vertex handles and rectangle controls at saved
  geometry. Both now derive from the active preview. Non-axis-aligned previews
  show all Room edge measurements; cancellation restores the original controls.
  Curve preview retains precedence over group preview.
- Singleton groups used an individual target for pointer rotation and a group
  target for numeric rotation; body movement bypassed the group gesture. Both
  rotation routes now use the same saved target and frozen bounding-box pivot,
  and singleton body movement enters the guarded group gesture. Individual
  vertex handles retain their existing priority.
- An individually selected hosted opening was mistaken for its host's singleton
  saved group. It now retains individual controls and offers Select saved group;
  it cannot accidentally dispatch a host transform through the group facade.
- An enclosure write completing after disposal could expand the disposed
  selection. Persistence and its receipt still finish once, but no selection
  continuation runs after disposal.
- Repeating enclosure could move its group/boundary to the end of a catalogue
  and reorder existing member IDs, producing a write for unchanged geometry.
  Updating an existing group identity now preserves its catalogue position and
  member order; enclosure also updates an existing boundary in place. The selected
  assembly is found by its identity rather than assumed to be the final group.
- Published #113 CI stopped at six conditional assertions in
  `groupPointerRotation.test.ts`. Separate cancellation and commit cases retain
  every assertion and exact Undo/Redo checks without conditional expectations.
- A pre-existing multi-selection fixture clicked the first button, which now
  belongs to Group controls. It now explicitly clicks the member-focus row;
  every selection, focus, camera, outline and accessibility assertion is retained.

The singleton rendering regression is adapted from the existing isolated
`b10c3b24` test, with an additional real deletion/drag/target/history case. No
future production source was imported. Regression runs observed the original
handle/control mismatch, singleton target/drag mismatch, disposal selection
mutation, and individually selected opening misclassification before their fixes.
Additional red runs reproduce reordered enclosure catalogues and the resulting
extra write. A direct run against merged pre-fix production source reproduces
all eight initial UI failures, including the member-focus fixture.

## Behavior and automated evidence

Selection continues to store member IDs. Normal pointer/list/marquee selection
expands saved membership; Alt chooses an individual member. The accepted order
remains handles first, then Object → Opening → Wall → Room, with Alt cycling.
Hidden members participate in transforms. Hosted openings follow their walls
implicitly, once, retaining their host, offset, width, height, sill, kind and swing.

Enclose with walls is explicit. It follows curved Room edges, reuses matching
walls, creates missing walls and saves membership in one reversible sidecar
operation. It adds no continuous Room-to-wall synchronization. Connected external
wall changes still receive impact review; numeric rotation shows the affected
outside-wall count in its existing preview dialog, and numeric movement uses the
existing confirmation with that count.

| Contract | Automated coverage |
|---|---|
| Saved selection, primary marquee, Alt, hidden members, pointer movement | `groupDelivery`, `groupEditing`, `groupGestureGeometry`, `marqueeSelection` |
| Inspector and object-aware context routes, Group/Ungroup, reopen | `groupEditing`, `groupNativeActions` |
| Numeric movement, decimal rotation, quarter turns and impact counts | `groupNativeActions`, `groupRotationImpact`, `groupRotationPresentation`, `groupPointerRotation` |
| Both curve directions, opening symbol geometry, stable preview/save equality, exact Undo/Redo/fresh store | `groupDelivery`, `groupEditing`, `groupGeometry` |
| Explicit curved enclosure, existing wall reuse, opening preservation and byte-exact repeated enclosure | `groupDelivery`, `spatialGroups` |
| Real deletion leaving a singleton; target, handles, outlines, dimensions and cancellation | `groupSingletonPreview`, grouped deletion suites |
| Cancellation, no-ops, peer conflicts including the write boundary, refused writes, repeated read-only recovery, actual completion after disposal | `groupDelivery`, `groupEditing`, `groupNativeActions`, `groupWriteBoundaries`, `groupStorageRecovery` |
| Curve editing and upstream opening movement retained | `curveDelivery`, `openingMoveDelivery` |

These are automated component/runtime/Konva and synthetic-vault observations,
not browser or Obsidian acceptance. Exact persisted-document equality is checked
through fresh sidecar instances; physical display rendering is not certified.

## Verification

Windows, Node 24.20.0, dependencies installed with `npm ci` from the unchanged lockfile.
The [targeted run](evidence/group-ui-20260909/targeted-final.log) passes **162 tests in
21 files**, including 14 new cases. The [pre-fix baseline run](evidence/group-ui-20260909/baseline-failures.log)
reproduces eight failures in five files; the group member-focus selector is corrected
here, leaving the seven failures already documented by #112 for final comparison.

The final, unchanged [`npm run check`](evidence/group-ui-20260909/check.log) is **red**:

- Build/type-check, Oxlint and ESLint pass.
- 8,621 tests pass, eight fail and 70 retain their existing skips, across 728 files.
  Seven failures reproduce on the merged pre-fix source: three in `zoneEditing`,
  one in `renovationRoutes`, two in `newRoomInspector` and one in
  `renovateRoomManipulation`. No group implementation test fails.
- The eighth failure is the unchanged lint-harness test exceeding its 60-second
  timeout. A subsequent [isolated rerun of the entire file](evidence/group-ui-20260909/lint-rerun.log)
  passes all 11 cases with the same timeout. This does not erase the full-run failure.
- Coverage is 98.81% statements, 97.34% branches, 98.98% functions and 99.50% lines.
  Statements, branches and functions miss the unchanged 99% / 98% / 99% floors.
  These floors also failed on updated #112; no fresh pre-fix coverage measurement
  or coverage-regression improvement is claimed here.

Separate unchanged [`npm run analyze`](evidence/group-ui-20260909/analyze.log) is also
**red**: five dead-code/type findings, one existing Group/Structure command-guard
clone and 14 complexity findings. Every current finding reproduces on merged
pre-fix production source. The [diagnostic comparison](evidence/group-ui-20260909/analysis-comparison.json)
holds final tests and coverage constant; its two additional baseline CRAP findings
come from shifted source locations and are not measured improvements. JSON output
was used for comparison; the default human-mode command independently returned 1.

[Receipt and evidence hashes](evidence/group-ui-20260909/receipt.json) record the exact
checked source blobs and failure classification. Text logs normalize line endings
and trailing whitespace; [the raw archive](evidence/group-ui-20260909/raw-logs.zip)
preserves the original captured bytes. Source restoration after the
baseline diagnostic, unchanged gate configuration, unchanged other branch refs,
note links and `git diff --check` pass. The initial coverage run was deliberately
interrupted when the repeated-enclosure gap was found and is not a completed receipt.
Assertions, thresholds, timeouts and exclusions are unchanged. Full/targeted runs
use `VITEST_MAX_WORKERS=2`; the isolated lint-harness rerun uses one worker.

No further functional group-interaction gap was demonstrated. The complete
repository quality gate and user-owned manual acceptance remain open.

## Manual acceptance

**User-owned and pending; it does not block this implementation step.** No desktop
or Obsidian control, manual browser walkthrough, screenshot acceptance or vault
access was performed or requested. No PR merge, release or overall-plan completion
is authorized by this receipt.

Optional user checklist:

- Enclose a straight and curved Room; select a saved member and Alt-select one member.
- Marquee, Group/Ungroup, hide a layer, then drag and rotate numerically and by quarter turns.
- Review connected-wall impact, cancel once, then Apply; compare openings and edge labels.
- Delete members until one remains; inspect its preview, Undo/Redo and reopen the plan.
