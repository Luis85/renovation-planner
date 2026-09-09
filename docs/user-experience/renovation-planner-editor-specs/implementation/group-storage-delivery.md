# Group storage delivery

## PR #110 implementation follow-up — 2026-09-09

Scope: storage, commands, persistence and recovery only. The authoritative remaining
editor plan is [PR #117](https://github.com/Luis85/renovation-planner/pull/117).
Group interaction UI remains on #113, curves on #111, and stairs on #114. This receipt
does not complete the editor plan, authorize a merge, or publish a release.

The existing dedicated worktree `.worktrees/editor-deliver-group-storage` was clean
at `858f3735dcd3954d6d39157a0fcd59629160db84`. The latest #109 head,
`c748be74726a816d9b39d971b45ad656254ddf58`, was merged without conflicts as
`996f01e4889e31323a80f1a6a011b2847e4ba7f0`. Both concerns are retained, the PR base
remains `codex/editor-deliver-reference`, and no other PR branch was rewritten.
Main remains clean on its integration branch.

The functional fixes, tests and verification receipt were committed as
`d029d65922365a71c8f7423c0a97799742b1e0d2`. Before pushing, #109 advanced to
`45e114525dd79417f0981538c9b16dda788b68b3`; that documentation/evidence-only update
was also merged without conflicts. Source, tests, styles, scripts and checked
configuration remain identical to the verified fix commit. Its inherited reference
acceptance evidence is not a manual test performed by this group-storage follow-up.

Initial GitHub inspection found no reviews, review threads or discussion comments on
#110. Its four verification jobs were red; audit and GitGuardian checks were green.
The updated #109 already records eight failures in five editor test files and a
branch-coverage shortfall; those test files are unchanged by #110. See its
[verification receipt](reference-scale-acceptance.md) for the predecessor evidence.

Review found two reproducible gaps in existing behavior:

- The whole-document comparator sorted groups and their members. A change only to
  either stored order returned `no-write`, losing the proposal. The comparator now
  retains both orders, consistent with deletion history's exact membership contract.
- The schema accepted padded group names but trimmed them during reads. That changed
  the saved document relative to the command's write receipt and could refuse its own
  Undo as superseded. Reads now preserve accepted names exactly, while still refusing
  empty, whitespace-only and overlong names. Schema version remains 6; migration and
  older-reader refusal behavior are unchanged.

The two order cases and padded-name round trip were observed failing before these
fixes. Existing grouping, geometry transforms, receipt guards and compensation paths
were retained. New automated evidence also checks:

- One conditional rotation of Room/walls/free element and implicitly hosted openings,
  including an opening added after grouping; intended geometry and opening facts survive.
- Exact geometry, group order, member order and names through repeated Undo/Redo.
- Reconstruction with a new index, migration runner, echo window, store and sidecar.
- Calibration retains group identity and membership while scaling geometry.
- Successful save followed by failed readback and three read-only retries leaves one
  history entry and never replays the save; Undo/Redo remain exact after recovery.
- A peer write between baseline checking and the conditional write is refused, and a
  retry does not rebase onto it. An identical-content peer rewrite also blocks old Undo.

The existing suites additionally cover flat/disjoint/root-only validation, group
flattening, one-write enclosure, mixed Zone/group history, deletion of members and
empty groups, unrelated peer groups, failed writes, publication retirement and
membership/Requirement compensation. They remain part of this follow-up's checks.

### Automated verification

Windows, Node 24.20.0, lockfile-installed dependencies (`npm ci`). Only worker
parallelism was limited: `VITEST_MAX_WORKERS=2` for the unchanged `npm run check`.
Package files, test configuration, lint rules, thresholds, timeouts and exclusions
are unchanged from the updated #109. No assertions or skips were weakened.

- Targeted checks: **60 tests passed across nine files**, including ten new cases in
  `groupStorageRecovery.test.ts` and `groupStorageCompatibility.test.ts`. The other
  seven files cover the domain, commands, deletion, events and guarded composition.
- Standalone `vue-tsc -noEmit` passed. The full gate also passed build/type checking,
  Oxlint and ESLint.
- Full gate: **8,453 passed, eight failed, 70 unchanged skips**, across 707 files
  (702 passed, five failed). All new tests passed. The test/coverage stage exited 1.
- Coverage: statements **98.99% (19975/20177)**, branches **97.76% (14324/14652)**,
  functions **98.99% (5692/5750)**, lines **99.51% (15288/15362)**. The first three
  miss their unchanged 99%/98%/99% floors. The same three floors already failed on
  the published #110 CI (98.98% statements, 97.74% branches, 98.95% functions);
  #109 itself also missed the branch floor. The two production files changed in this
  follow-up have no uncovered statements, functions or branch arms in this full run.
- Separately executed `npm run analyze`: six dead-code/type findings, one clone group,
  twelve above-threshold complexity findings; exit 1. Attribution is detailed below.
- `git diff --check` passed.

The eight failures exactly match the updated #109 receipt:

| Unchanged test file | Existing failure |
| --- | --- |
| `zoneEditing.test.ts` | Three Inspector/selection/removal expectations. |
| `renovationRoutes.test.ts` | Missing visibility control. |
| `newRoomInspector.test.ts` | Two creation-hint visibility expectations. |
| `structureLifecycle.test.ts` | Wall-removal UI wait times out at its unchanged 4,000 ms budget. |
| `renovateRoomManipulation.test.ts` | Missing Room corner handle. |

Fallow retains #109's unused `provideCanvasGroupActions`, two `rotationControl`
private-type findings, unused `SnapService.rotationStepDegrees`, and twelve editor
complexity findings. Existing #110 storage code additionally has an unused
`PlanGeometrySchemaV5` export, a reported unused `prepareGeometryVersions` member,
and the six-line command-guard clone `dup:6f87acd9` in `GroupGeometryCommand` and
`StructureCommand`. The method is exercised through the optional `ZoneRepository`
port by the mixed-history tests; it is not safe to remove as dead execution. No
suppression, exclusion or command-framework refactor was introduced to hide these.

A diagnostic Fallow comparison on the pre-fix merge `996f01e4` reproduced the same
six findings, clone ID and twelve complexity findings. That temporary detached
worktree used lockfile-installed dependencies and this run's coverage with paths
remapped to the baseline checkout, solely to hold Fallow's coverage input constant.
It is **not** an independently measured baseline coverage or full-gate pass.

No further functional storage/recovery gap was demonstrated in this review. Existing
coverage and static-analysis debt remains, including the storage findings above; the
complete quality gate is **not green**.

Current logs: [full check](evidence/group-storage-20260909/check.log) and
[Fallow](evidence/group-storage-20260909/analyze.log), plus the
[pre-fix Fallow comparison](evidence/group-storage-20260909/analyze-baseline.log).

Manual acceptance is **user-owned and pending**, and does not block this storage
implementation step. No desktop/Obsidian control, browser walkthrough or screenshot
acceptance was performed. Optional checks after the group interaction stack is available:
save/reopen an assembly; move/rotate a wall with a hosted opening; delete a member and
Undo/Redo; confirm a conflict or refresh retry preserves the saved result.

## Historical reconstruction receipt

The initial reconstruction itself ran no tests, type checks, lint, build or browser
checks. Its original concern receipts describe those historical trees only; current
verification belongs to the follow-up above.

Initial base: input delivery `6284aa4a8f5945c72fd94b4ba1309304e63e536f`.
Review base: `codex/editor-deliver-reference` (`8948c7a3`), incorporating the independent
Photo and Reference concerns before Group storage. No integration-branch ancestry is
imported. Schema order remains Opening 5 followed by Group 6; Curve 7 follows later.

| Original | Reconstructed | Included scope |
| --- | --- | --- |
| `587f0266` | `e114355b` | Group model, schema 6, guarded services, atomic command, root memberships, Zone pre-write version receipts, projections and original foundation tests/docs. |
| `75175e1f` | `14378070` | Individual deletion membership cleanup and exact safe history restoration, including grouped Room boundary recovery. |
| `f5a28f45` | This delivery follow-up | Three Group command error messages in both locales, membership restoration error, composed guarded Group tests and exact guard-census ownership. |
| `eb59fc2b` | This delivery follow-up | Group command write boundaries, ordered publication events, reversible-write discovery and census rows. |

The Group error locale modules are deliberately limited to the three storage errors.
They are wired into the existing editor locale tables now; Group UI may extend them
later without adding a second source of error copy.

Omitted from `f5a28f45`: German Curve copy; future-schema fixture generalization made
for Stair 8; and the mixed integration repair receipt. The existing Group6 future
schema fixture remains appropriate for this schema boundary. Omitted from
`eb59fc2b`: the Group pointer-rotation UI test and its mixed UI verification receipt.
No Group Inspector, selection expansion, pointer group target, browser driver or
Curve/Stair schema is introduced by this concern.

Review compares the exclusive Group domain/command/repository/helper files with their
original feature commits. Shared DTO, locale, projection and census files are reviewed
as concern hunks against the Reference base, retaining the clean delivery's prior
Opening and input contracts. Later cumulative comparison must account for Curve
extensions to Group bounds, validation and Zone geometry receipts.
