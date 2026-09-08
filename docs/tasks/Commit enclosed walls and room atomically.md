---
type: Task
parent: "[[Draw connected walls and create an enclosed room]]"
order: 20
status: Done
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Walls and hosted openings]]"
---

# Commit enclosed walls and Room atomically

## Evidence

M04 offers Room creation when a Wall loop closes and requires the accepted result to be one
undoable transaction.

## Why it matters

Separate Wall and Room writes can leave an enclosure with a ghost Room or a Room with no defining Walls.

## Approach

Use prerequisite Wall commands and the existing Room/Zone creation boundary inside one compensated
application sequence. Detect enclosure as application input, ask for Room consent, persist accepted
effects, publish refresh events and capture one inverse. Test every failure step.

## Acceptance criteria

- Declining Room commits only valid Walls.
- Accepting Room commits Walls and Room as one history action.
- Any failed step compensates prior effects.
- Reload restores the same IDs and relationships.

## Risks

Atomicity may require recovery records across note and sidecar writes; reuse existing sequence infrastructure.

## Outcome

An enclosed Wall chain can become a Room without partial or separately reversible results.

## Closing evidence

**2026-09-08**, the plan-editor stack — landed in 3d08d22a (#86).

Criterion 1 — **declining Room commits only valid walls** — is `StructureCommand` run with no
`room` collaborator: `tests/application/commands/structureCommand.test.ts`'s 'composes opening
placement, edit, deletion and reverse order history with shared versions' commits `WALL_LOOP` that
way three times, and `tests/application/commands/structureRecovery.test.ts`'s 'associates only
newly created walls when another structure already exists' is the populated-floor arm.

Criterion 2 — **accepting Room commits walls and Room as one history action** — is 'creates walls
plus the Room as one history item; reloads the same IDs through a fresh stack'. The Room rides the
existing compensated Zone transaction (`ReversibleCreateZoneCommand`), which is what makes the
composite one `CommandHistory` entry rather than two.

Criterion 3 — **any failed step compensates prior effects** — is 'compensates Room creation when
the structure write fails (%s)', 'reports and retires failed compensation (%s)' and 'compensates
the structure when Room undo refuses and retries without losing openings' in
`structureCommand.test.ts`, and `structureRecovery.test.ts`'s 'does not write structure when Room
creation refuses' plus its three 'retires when …' cases for the recoveries that themselves fail.

Criterion 4 — **reload restores the same IDs and relationships** — is the fresh-stack case above;
the Room's boundary provenance is `tests/application/commands/roomBoundaryHistory.test.ts`'s
'restores Room adjacency with the original IDs across repeated delete/undo'.

One review finding on #86 sat inside this criterion set and is fixed on the branch: the optional
Room's `ReversibleCreateZoneCommand` recorded its versions in a PRIVATE ledger, so renaming that
Room and undoing the rename advanced only the editor ledger and the next loop undo was refused.
a31a6c14 hands `createStructureTask` the editor-wide ledger from `buildRuntime`;
`tests/presentation/editor/structureLifecycle.test.ts`'s 'records the optional Room in the
editor-wide ledger, so a sibling edit and its undo do not strand the loop undo' never landed its
loop undo before the change.

What no test here claims: durable atomicity across an abrupt process exit between the two file
writes. #86's own body says there is no durable journal for that, and this task's Risks paragraph
stays the record of it.
