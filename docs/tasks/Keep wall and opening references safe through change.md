---
type: Task
parent: "[[Walls and hosted openings]]"
order: 30
status: Done
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Host and restore an opening on its wall]]"
---

# Keep wall and opening references safe through change

## Evidence

M07 requires exact wall edits and deletion impact to preserve or explicitly resolve hosted
openings; the [[Zones and spatial objects]] Feature already refuses dangling references.

## Why it matters

A wall edit that silently detaches a door or window makes the saved plan plausible but false.

## Approach

Route wall geometry changes and deletion through the reference-integrity boundary, compute hosted
opening impact before writing, and make each accepted resolution reversible and recoverable.

## Acceptance criteria

- A valid wall change preserves hosted-opening identity and placement.
- An invalidating change is refused or requires an explicit defined resolution.
- Wall deletion cannot leave a dangling hosted opening.
- Undo and reload restore one coherent wall/opening state.

## Risks

Implicitly moving openings may hide a material design change; commands must expose impact rather
than guessing the renovator's intent.

## Outcome

A wall change, deletion or undo/reload keeps hosted-opening identity, placement and boundary
associations coherent, refusing an invalidating change rather than guessing an intent.

## Amendments

**2026-09-08 (closed)** — closes with its prerequisite [[Host and restore an opening on its wall]]:
`tests/application/commands/structureCommand.test.ts`'s 'reloads an opening with its host and
placement through a fresh stack' (0fd81e5d) copies an opening-bearing sidecar into a second
repository stack and reads the host ID and placement back, which is the RELOAD half of
criterion 4 the amendment below found missing. The UNDO half and criteria 1–3 already stood.

**2026-09-08 (closeout review)** — moved to Done in the closeout pull request and set to Active
the same day, with its prerequisite [[Host and restore an opening on its wall]]: criterion 4's
RELOAD half is not held. The case cited below for it ('composes opening placement, edit, deletion
and reverse order history with shared versions') drives undo and redo on one repository stack,
adds `opening-a` and deletes it again, and ends on `WALL_LOOP` with no opening; the only
fresh-stack reload in that file writes `WALL_LOOP` too. So no assertion copies an opening-bearing
sidecar into a second stack and reads the host ID and placement back. The undo half of criterion 4
and criteria 1–3 stand as written. Stays Active until the prerequisite's fresh-stack opening case
exists; this task closes with it.

## Closing evidence

**2026-09-08**, the plan-editor stack — landed in 3d08d22a (#86), with the mixed-selection half
in 59977120 (#91).

Criterion 1 — **a valid wall change preserves hosted-opening identity and placement** — is
`tests/presentation/editor/structureActions.test.ts`'s 'previews and applies an exact connected
length, refuses containment and numeric errors, and preserves unchanged precision', over
`tests/domain/spatial/structure.test.ts`'s 'derives hosted positions and scales every normalized
measurement exactly once' (an opening's offset is host-relative, so a calibration scales it once
with its host).

Criterion 2 — **an invalidating change is refused or requires an explicit resolution** — is the
containment refusal in that same action case and the domain's 'accepts touching openings and
separate hosts, refuses horizontal overlap even at different heights'. Refused is what shipped;
no resolution dialog exists, and none is claimed.

Criterion 3 — **wall deletion cannot leave a dangling hosted opening** — is 'previews host
deletion, cancels, then deletes its openings and undoes the entire relationship' in
`structureActions.test.ts` (#86: host deletion removes hosted openings and boundary associations
while keeping Rooms), and for a mixed selection
`tests/presentation/editor/spatialBatchRemoval.test.ts`'s 'deletes a mixed wall/element selection
once, including hosted openings, and restores exact labels/shapes with Undo/Redo' (#91).

Criterion 4 — **undo and reload restore one coherent state** — is, for its UNDO half,
`tests/application/commands/structureCommand.test.ts`'s 'composes opening placement, edit,
deletion and reverse order history with shared versions'; the reload half is 'reloads an opening
with its host and placement through a fresh stack' (0fd81e5d). Two review findings on #86 were about
exactly this criterion's reverse-order history and are fixed on the branch: a45cca65 lets the
whole-document comparison decide a structure undo when a sibling Zone write and its undo advanced
the sidecar revision (the ledger generation alone had refused it), and 9208b831 compares sidecar
objects by id rather than array position, because `ObsidianZoneRepository.saveQueued` removes and
appends — `tests/application/commands/structureMixedHistory.test.ts`'s 'undoes wall history after
moving and restoring the first of two sidecar objects' read `undo.superseded` before it.
