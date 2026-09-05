---
type: Feature
parent: "[[Plan editor]]"
order: 50
status: Active
started: 2026-09-05
finished: ""
horizon: "MVP"
release: "[[MVP]]"
---

# Release hardening

The editor is releasable only when its room data survives time and failure, its host integration
holds outside the happy path, and the evidence for those claims can be audited. This Feature is
the gate over that work. It does not become a second owner of accessibility, language, error
handling, diagnostics, or vault-health rules: [[Accessibility]], [[Multilanguage]],
[[Error handling and diagnostics]], and [[Validation and vault health]] remain their authorities.

The first proof follows the room-creation slice through reload, stale read-back, native themes,
constrained leaves, keyboard use, localization, performance, cleanup, and release evidence.
Later M00–M17 states pass through the same gate as they become applicable.

## Outcome

The MVP editor can be released with auditable evidence that valid work survives reload and
recoverable failure, remains operable in its Obsidian host, and meets the canonical cross-cutting
requirements.

## Sources

- [[Renovation Planner — Editor Interaction & Mental Model Specification]]
- [[Renovation Planner — Editor UX Research & Pattern Study]]
- [Editor design specification set](../user-experience/renovation-planner-editor-specs/README.md)
- [Editor component library](../user-experience/renovation-planner-editor-specs/components/component-library.md)
- [Editor implementation plan](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md),
  Phase 12 and performance budgets
- [Editor vertical-slice plan](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md),
  VS-09–VS-11

## Progress

**2026-09-05** — this Feature has its first landed work: the **trust path**, the vertical-slice
plan's checkpoint C3, designed in
`docs/superpowers/specs/2026-09-04-plan-editor-trust-path-design.md` and built on
`claude/plan-editor-trust-path`. It closes the first two of this Feature's eight PBIs and starts
the third — the ordering is deliberate, because *"valid work survives reload and recoverable
failure"* is the half of the release claim every other half rests on: a themed, keyboard-operable,
localized editor over data that can be silently lost is not releasable, and the reverse is merely
unfinished.

[[Reload the editor without losing room data]] and
[[Recover safely from failed writes and stale reads]] are **Done**, each with a dated
`## Amendments` section naming the test that holds each criterion — **with one criterion recorded
as outstanding rather than ticked**: Reload's fifth, *"the create/select/reload journey passes in a
live Obsidian vault"*. Two manual cases were written for this increment,
[[Recover from a stale read]] and [[Reload a room]], and **neither has been run**. Their Runs
tables say so, and both are in [[Smoke Test the Editor]]'s census. An unrun manual case is a plan
to find out, not a finding, and this Feature is the one place in the tree where that distinction
decides a release claim rather than a paragraph.

**So the two tasks whose whole deliverable IS the walk stay Active under Done parents**, which
looks inconsistent and is the honest shape: [[Verify stale recovery in Obsidian]] and
[[Walk a room reload in a live vault]] deliver a run, not a procedure, and neither run has
happened. Their parents are Done because every behavioural criterion under them is held by a named
test — with Reload's fifth, the one criterion that is itself a vault run, recorded as outstanding.
This repository has already shipped one outcome row claiming a walkthrough that never happened;
these two statuses are what refuses to repeat it.

What landed: a stale read is a state a renovator can act on. The write lands, the read-back fails,
the floor stays exactly where it was, a keyed warning strip says what happened and offers **Try
again** and **Open source note**, the status bar reads `Saved · refresh needed`, every control that
would write against unconfirmed data is paused with one shared reason, and Undo and Redo stay live
because their inverse comes from the history's own record rather than from the screen. A failed
compensation now reports its own code and its own stamp instead of claiming the note was put back.
No schema moved, no write path moved and no event was added.

The six remaining PBIs are **New**. Three of them — themes and constrained layouts, operating
without a pointer, and complete English and German — are checkpoint C4's, and the two Active task
halves this increment closed under [[Editor foundation]] are named in that Feature's own Progress
section rather than here.
