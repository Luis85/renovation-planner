---
type: Task
parent: "[[Recover safely from failed writes and stale reads]]"
order: 30
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Exercise write compensation and interrupted recovery

## Evidence

WP7 treats note and sidecar changes as one logical write sequence with compensation and recovery.

## Why it matters

Failures between files can leave ghost rooms or erase valid geometry after restart.

## Approach

Inject failure at each write, compensation, marker, and recovery boundary. Verify complete prior
state, complete new state, or an explicit unrecovered result; add backup/recovery guidance for
the residual cases.

## Acceptance criteria

- No injected failure is presented as an ordinary success with partial room data.
- Successful compensation restores the exact prior state.
- Unrecovered cases name the safe manual action and preserve available evidence.

## Risks

A test that fails before the first write does not exercise compensation.

## Outcome

Each interruption point has a tested, truthful recovery result.

## Closing evidence

**2026-09-05**, the trust path increment.

Criterion 1 — **no injected failure is presented as an ordinary success with partial room data** —
and criterion 3 — **unrecovered cases name the safe manual action** — are one change.
`ObsidianZoneRepository.compensateFailedSidecarWrite` returned `zone.sidecar-insert-failed` /
`zone.sidecar-update-failed` with the sentence *"the note was compensated"* **whether or not the
restore succeeded**; the failure was one log line. It now returns
`zone.sidecar-insert-uncompensated` / `zone.sidecar-update-uncompensated`, stamped with
`markUncompensated`, with a message that says the note was NOT put back and names the manual
action — inspect the note. Four cases in
`tests/infrastructure/obsidian/repositories/errorPaths.test.ts`, two per arm; the shared stamp is
mutation-checked by unwrapping it and watching both uncompensated cases redden at
`leftWritesBehind`.

Criterion 2 — **successful compensation restores the exact prior state** — is the other two of
those four, and each asserts the vault's own BYTES rather than the returned code alone: the
compensated INSERT leaves no note, and the compensated UPDATE has the note back at its OLD name.

**The fake had to be widened, and the shape of the widening is the lesson.** The first pass
DROPPED the update-uncompensated code as unreachable, correctly, against the fake it had: a
one-shot `failOnce` set keyed `<op>:<path>` cannot separate an update's own
`writeOwnedFrontmatter` write from its restore, because both are `modify:<notePath>` and the
one-shot fires on the first. A **counted** failure can — `FakeVault.failOnHit`, "fail exactly hit
N of this key" — and hit 2 of that key on an update is the restore, with the sidecar mutation
between them keyed elsewhere. Under the controller's Ruling 6 the code was restored, the fake
generalised (`failOnce` retired: it had zero real call sites, and a one-shot is the degenerate
`failOnHit.set(key, 1)`), and the positive proof of the counting is in the case itself — the note
on disk still carries the FAILED update's new name, so hit 1 landed and only hit 2 refused. **The
spec was right and the first reading of the fake was what was wrong**; §2.7 needed no amendment.

The stamped refusal is what feeds the unrecovered warning row: `withSaveStateTracking` calls
`markUnrecovered` when a refused result `leftWritesBehind`, in that ORDER
(`tests/presentation/editor/saveState/withSaveStateTracking.test.ts` asserts it through a
recording tracker, since independent call counts are blind to order), and `unrecoveredWrite` is
cleared only by `resolveOk` — never by a successful refresh, which is the whole reason it is a
separate field from `stale`.

**What was NOT injected here, so it is not read as covered.** This task exercised the note/sidecar
COMPENSATION boundary. The marker and recovery boundaries — `runDeleteResolution`'s durable
markers and `recoverInterruptedSequences` — were not driven, and the two application-layer
residues they carry are PRE-EXISTING and out of scope by design spec §11: a successfully
recalculated reassignment that cannot be rolled back, and two marker failures reading as an
interrupted sequence. Both are named in
`docs/superpowers/plans/2026-09-03-the-lock-publish-boundary.md`'s "Not in scope" and in CLAUDE.md.
The `DispatchOutcome.ts` docblock that counts `markUncompensated`'s producers was re-derived from
the grep in the same edit and DATED — the previous count was already stale, and the grep quoted
inside the docblock matches its own quoting line, so the instrument counts itself.
