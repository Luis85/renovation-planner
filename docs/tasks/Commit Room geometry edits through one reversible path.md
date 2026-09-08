---
type: Task
parent: "[[Edit a selected room shape and dimensions]]"
order: 30
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Commit Room geometry edits through one reversible path

## Evidence

M00 requires direct manipulation and displayed-dimension edits to update dependent values through
one command path.

## Why it matters

Two commit paths can disagree about validation, history, recalculation or recovery.

## Approach

Translate the accepted draft into one Room geometry command regardless of its input route. Record
one inverse, refresh dependent quantities after success, and exercise write, compensation and read-back failures.

## Acceptance criteria

- Every valid edit dispatches the same command shape once.
- One edit creates one undo entry and one recalculation cascade.
- Undo/redo and reload preserve Room identity and the expected geometry.
- Failed writes never present partial geometry as saved.

## Risks

An editor adapter may bypass the shared history or guarded service door.

## Outcome

Each completed Room edit is one durable, reversible user action.

## Closing evidence

**2026-09-08**, the plan-editor stack — landed in ec267544 (#82, `codex/editor-room-dimensions`).

Criterion 1 — **every valid edit dispatches the same command shape once** — is the dimensions form
dispatching the shared move command `select-tool`'s drag already dispatches:
`tests/presentation/editor/roomResize.e2e.test.ts`'s 'selects through list action/canvas (%s),
previews without writing, applies once and reverses'.

Criterion 2 — **one edit, one undo entry, one recalculation cascade** — is 'recalculates linked
quantity and cost only on Apply and follows Undo/Redo' and 'does not create history for unchanged
or equivalent text and keeps native key ownership' in the same file.

Criterion 3 — **Undo/redo and reload preserve identity and geometry** — is read off the real
`ObsidianZoneRepository` (`r.zonesRepo.getById`) after apply, undo and redo in that file, with the
pure half in `tests/presentation/editor/resize/roomDimensions.test.ts` ('preserves exact untouched
dimensions and rounds only the edited side', 'recognizes either winding and any starting corner
without reordering').

Criterion 4 — **failed writes never present partial geometry as saved** — is 'keeps a confirmed
write when readback fails, pauses further writes and refreshes without replay', 'preserves the
draft on a persistence refusal, retries explicitly and blocks stale projection' and 'refuses a
peer write against the form baseline and retains the draft'. The review's P1 on #82 was a hole in
that last one: the form's `expected: version` came from the note's frontmatter alone, so a sync
rewriting this room's `.rpgeo` entry without touching its note was invisible and Apply overwrote
it. f9b56d54 fixes it at the repository rather than in the dialog, since every geometry writer
presents the same version from the same reader: a zone's version now digests the note's owned
keys AND its own sidecar entry (`observeZone` in `digest.ts`) — the ENTRY, deliberately, not the
sidecar's plan-grained version, or a neighbour's move would refuse an unrelated save.
`tests/infrastructure/obsidian/repositories/consistency.test.ts` edits this zone's entry alone and
expects `zone.external-modification`, edits a neighbour's and expects the save to land; red before
(`Expected error, got ok`).

Narrowed, by the slice's own contract: the form is offered for four-corner axis-aligned
rectangles only ('explains unsupported Room shapes and does not offer resize for %s triangles');
#91's corner form (`tests/presentation/editor/outlineEdit.e2e.test.ts`) is where an arbitrary
outline is edited numerically, on the same command path. Two smaller findings from the same review
round are on the branch too: 04923ab8 announces the resize action `aria-disabled` while another
tool is active, since `open()` already refused it ('announces resize and rename unavailable during
a temporary Area tool'), and 38ec673b folds the update baseline read into one helper so
`saveQueued` stays under its cognitive budget.
