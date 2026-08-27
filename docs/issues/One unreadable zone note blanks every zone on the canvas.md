---
type: Issue
parent: "[[Plan editor and canvas]]"
order: 50
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

# One unreadable zone note blanks every zone on the canvas

The same defect that was fixed for projects in the slice 11/14 polishing pass, left standing
on the surface that actually draws something. Found by reading across that branch, not by any
gate.

## The question

`ObsidianProjectRepository.listAll` used to answer the first read failure it met, so one
project note with an unparseable `schema-version` hid every project in the vault. It skips and
counts now, and the count reaches the user as a warning.

The zone and plan listings still fail fast. `ObsidianZoneRepository`'s private `list` — where
both `listByPlan` and `listByProject` end up, so it is **one site behind three entry points**
— and `ObsidianPlanRepository.listByProject` each read `if (!one.ok) return one;`.

The consequence is worse than the one just fixed, because it lands on the surface with
something to lose: a single unreadable Zone note fails the whole listing, so the Plan Editor
canvas draws **no zones at all** rather than costing the user that one zone. There is no
partial render and no warning strip — the editor takes the failure and shows its failed state.

## What is true today

- `migrateNote`'s own docblock claims a refusal is "scoped to THIS note ... and the rest of the
  project loads on" (SDD §92 item 13). That is now true of one listing and false of three entry
  points, and the docblock says so explicitly rather than reading as settled — which is the
  only part of this the polishing pass changed.
- The mechanism that made the project fix cheap is already in place here: `getById` records
  every refusal into the `DiagnosticsLedger` before returning it, so skipping loses nothing on
  the zone side either.
- The fix is not a copy-paste of the project one. `listAll` answers a `ProjectListing`
  (`{ loaded, refused }`) consumed by exactly one query; the zone listings answer a bare array
  to several callers, and the editor's stores, the Inspector query and the cascade all read
  them. Widening the return type touches all of it.
- Nothing in the suite or lint would surface this. Every test drives readable notes, and a
  fail-fast listing is not a defect any rule can name.

## Alternatives weighed, and why they were not taken

- **Fix it in the polishing pass, beside the project one.** Rejected on scope, deliberately:
  that pass closed eight named defects and this is a ninth, on a different surface, with a
  wider blast radius. Doing it there would have turned a review-response into a feature change
  nobody had reviewed.
- **Narrow `migrateNote`'s claim and stop.** This is what was actually done, and it is a
  holding action rather than an answer. It stops the next reader trusting a false sentence; it
  does not stop the user losing a canvas.
- **Skip silently, without a count.** Rejected by the project-side design for a reason that
  applies identically here: a listing that quietly drops what it cannot read turns a real,
  actionable problem into an empty canvas that looks like a plan with no zones drawn yet. The
  count is what keeps "no zones" and "no *readable* zones" different facts.
- **Fail fast but say which note.** Weighed and still open as a cheaper middle: the user keeps
  losing the canvas, but at least learns why. It needs the same missing surface as everything
  else here — see [[The diagnostics snapshot has no surface that reaches it]].

## Why it matters

- The Plan Editor is the surface a user spends their time in. Losing every zone on it is the
  most expensive instance of this defect class in the codebase, and it is now the only one left
  after the cheapest instance was fixed.
- The asymmetry is itself a hazard: two repositories in the same folder now answer the same
  question differently, and only one docblock explains why.

## What closes it

Not designed here. The shape is known from the project side — skip, count, carry the count to
the surface — but the plan and zone listings have more callers, and whether the count reaches
the canvas as a strip (the project view's answer), as a per-zone marker, or as a status-bar
line is a design question the editor's own shell should answer. Whoever takes it should decide
in one go for both repositories, since a third listing left fail-fast recreates exactly the
asymmetry this note is about.

## References

- `src/infrastructure/obsidian/repositories/ObsidianZoneRepository.ts` — the private `list`
  and its fail-fast, shared by `listByPlan` and `listByProject`.
- `src/infrastructure/obsidian/repositories/ObsidianPlanRepository.ts` — `listByProject`.
- `src/infrastructure/obsidian/repositories/noteIo.ts` — `migrateNote`'s scoping claim, and the
  clause naming which listing honours it.
- `src/infrastructure/obsidian/repositories/ObsidianProjectRepository.ts` — `listAll`, the
  worked example of the fix.
- [[Errors, diagnostics and the test harness]] — the PBI that owns the schema gate this
  refusal comes from.
