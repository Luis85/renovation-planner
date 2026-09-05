---
type: Task
parent: "[[Undo and redo]]"
order: 20
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Reverse and replay editor commands safely

## Evidence

[M03](../user-experience/renovation-planner-editor-specs/screens/M03-add-room.md) and [M11](../user-experience/renovation-planner-editor-specs/screens/M11-multi-selection.md) require one reversible command per completed or composite user action.

## Why it matters

An inverse that bypasses revisions or restores only half a logical write can overwrite external work or split metadata from geometry.

## Approach

Exercise undo and redo through application/repository boundaries with captured inverses, optimistic revisions, compensation and exact one-time stack transitions.

## Acceptance criteria

- One Undo invokes one captured inverse.
- One Redo replays once against current versions.
- Revision conflict overwrites nothing and surfaces once.
- Composite metadata/geometry effects reverse together.
- Failed undo/redo leaves a coherent stack state.

## Risks

A command may report success after partial compensation failure; recovery evidence must remain visible.

## Outcome

Undo and redo preserve external edits and the logical integrity of each user action.

## Closing evidence

**2026-09-05**, the trust path increment. Every criterion is a case in
`tests/presentation/editor/history.e2e.test.ts` or in
`tests/presentation/editor/stalePath.e2e.test.ts`, driven against the wired editor rather than
against an adapter in isolation.

Criterion 1 — **one Undo invokes one captured inverse** — is counted at the REPOSITORY
(`vi.spyOn(zonesRepo, 'delete')`, exactly 1), because a doubled inverse still leaves one zone and
reads identically from the store.

Criterion 2 — **one Redo replays once against current versions** — is `stalePath.e2e.test.ts`'s
second case, which asserts the SAME entity id comes back. A count cannot see identity; that is the
whole reason the assertion is on the id.

Criterion 3 — **a revision conflict overwrites nothing and surfaces once** — is
`history.e2e.test.ts`'s fourth case. **How it surfaces was measured and is not what the plan
said:** `zone.external-modification` is one of `WRITE_BOUNDARY_CODES`, which `affectsSaveState`
carves back out of the pre-write categories, so it flips the BADGE — and `reportDispatchFailure`
therefore routes it at the `autosave-write` origin, which `surfaceFor` maps to the `save-state`
surface rather than to a toast — and whose save-state SINK is itself a no-op, because
`withSaveStateTracking` one layer below has already flipped the badge. One failure, one widget, per
design slice 17. The no-toast is the POLICY's doing and not the sink's: `AUTOSAVE_SINKS` spreads
`noticeOnlySinks`, whose `toast` is a live `notifyError` that nothing on this path reaches. So the
case asserts the badge flips AND that
`Notice.shown` did not move, **over a live notice queue**: over an inactive one that absence would
be true of every build ever written.

Criterion 4 — **composite metadata and geometry effects reverse together** — is the reversible
create/delete pair over one note and one sidecar object, with
`tests/infrastructure/persistence/editorRoundTrip.test.ts` reading the pair back whole.

Criterion 5 — **a failed undo or redo leaves a coherent stack** — is that same fourth case:
`canUndo` stays true and a second press refuses identically. That is the recorded
`undo.superseded` behaviour, pinned AS the recorded behaviour rather than fixed here — the remedy
is a decision about `CommandHistory` every surface inherits, and CLAUDE.md carries it as open.

**Undo and Redo pass the stale gate by construction**, which is what makes them the way a user
backs out of the write whose read-back failed: their inverse is the ledger's snapshot presented
with the version the history recorded, and none of it reads the projection.
`tests/presentation/editor/tools/withStaleGate.test.ts` drives both, both ways.
