---
type: Issue
parent: "[[Errors, diagnostics and the test harness]]"
order: 30
status: New
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# A future-version note can be neither read nor deleted

A limitation accepted deliberately in the slice 11/14 polishing pass, where the defect fixed
was the sentence denying it rather than the behaviour itself.

## The question

`trashNoteBackedEntity` calls `openNoteById` before `checkExpectedVersion`, and `openNoteById`
runs `migrateNote`. So a **delete is a write that comes through the read gate**: an Asset or
Requirement note written by a build this one predates refuses to load, and therefore also
refuses to be removed from inside the plugin. The user's only recovery is to leave the vault
and delete the file by hand.

`migrateNote`'s docblock asserted the opposite for a whole slice — that the gate is "READ-side
only" and "every save path ... never comes through here". That sentence is gone and the
behaviour is now pinned by a test rather than described by a comment
(`errorPaths.test.ts`, 'refuses to DELETE a future-version note, not only to load one'). What
remains open is whether the refusal is the right answer.

## What is true today

- The refusal is asserted, not incidental. The case was watched failing: reordering
  `trashNoteBackedEntity` so the version check runs first turns the assertion red with a
  different code (`asset.external-modification`), which is what proves `migrateNote` no longer
  runs on that path.
- It is a refusal and not a partial delete — the note is still in the index afterwards, and
  that is asserted in the same case.
- The delete-resolution abort this could theoretically cause is unreachable: the flow reads
  the requirement through `getById` first and fails earlier, so nothing downstream is left
  half-compensated.
- Only Asset and Requirement deletes reach it. Project, Plan and Zone deletes take other paths.

## Alternatives weighed, and why they were not taken

- **Reorder `trashNoteBackedEntity` so `checkExpectedVersion` precedes `openNoteById`**, letting
  a future-version note be trashed on a valid expectation. Rejected in the pass, and the
  reasoning is worth keeping rather than re-deriving: trashing a note this build cannot parse
  is not obviously safer than declining to. The note may hold data this build would silently
  discard, and the user has no way to see what they are losing. A refusal is recoverable by
  upgrading the plugin; a delete is not.
- **Run the schema gate on the save side too** (four call sites), making the whole thing
  consistent in the other direction. Explicitly out of scope of that pass and still open —
  `noteIo.ts` scopes today's guarantee as a narrowing rather than a live defect, because every
  command loads before it saves and the load refuses.
- **Special-case the delete path to skip migration.** Not taken, and it is the same decision as
  the reorder wearing different clothes.

## Why it matters

- It is a dead end a user can reach without doing anything wrong: sync a vault from a machine
  running a newer build, and some notes become both unreadable and unremovable.
- The plugin gives no account of it. The refusal surfaces as a coded error with category copy;
  nothing tells the user that upgrading is the recovery, because nothing knows that is what
  happened. See [[The diagnostics snapshot has no surface that reaches it]].

## What closes it

A decision rather than a patch: either the refusal stands and the plugin explains it (which
needs the copy and probably the diagnostics surface), or the delete path is allowed to proceed
on a valid expectation and the loss is made explicit to the user first. Whichever is chosen,
the existing case is the regression check — it asserts the current answer, so changing the
answer means changing that case deliberately rather than discovering it went red.

## References

- `src/infrastructure/obsidian/repositories/noteEntityWrite.ts` — `trashNoteBackedEntity`, and
  the call order that produces this.
- `src/infrastructure/obsidian/repositories/noteIo.ts` — `migrateNote`'s docblock, now stating
  that a delete reaches the gate.
- `tests/infrastructure/obsidian/repositories/errorPaths.test.ts` — the case pinning the
  refusal, and the sibling 'is a READ gate' case.
- `docs/superpowers/specs/2026-08-27-slice-11-14-polish-design.md` — Item 3, which chose to
  narrow the claim rather than change the behaviour.
