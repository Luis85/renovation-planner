---
type: PBI
parent: "[[Project dashboard and navigation]]"
order: 10
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
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
---

# The project surface

The backlog item [[The vault holds many projects, and selecting one is not a portfolio]]
says is owed. That decision closes with "**A Home surface is now owed and unbuilt.** Nothing
in `docs/requirements/` describes it, and this note does not design it — that is a backlog
item, not a decision record." This is that note.

It groups the work that makes a project **openable and navigable**: the vault's projects
listed so one can be chosen, that one project's own surface showing what is in it, and — as
the entities arrive — what state it is in and what to do next.

## Why these are one group

Not because they are all "UI". Because they are **one surface with two states**, and the
second cannot be scheduled without the first.

[[Shared UI vocabulary]] holds the slices that build the *vocabulary* — notices, empty
states, dialogs, forms, error surfacing. Those are parts. This PBI holds the slices that
assemble a **place** out of them, and the assembly has its own ordering constraint that no
`dependsOn` link between vocabulary slices can express: a detail state is reachable only from
a list, so whatever builds the list decides what a row *is*, and whatever builds the detail
decides what a row *does*. Splitting those across two parents would leave the two halves of
one decision arguing in different threads.

**The list half is built and its Task lives elsewhere.** Design slice 16 shipped
`ProjectList` under [[Shared UI vocabulary]], as part of that slice's forms-and-validation
work, and it is not re-parented here — a note has one parent, and moving a finished slice to
make a tree tidier would falsify the record of why it was scheduled. This PBI **accounts** for
it: the list exists, it was built without a requirement asking for it, and that is recorded
here rather than left as work no note owns.

## Horizon: MVP, under a V1 Feature

[[Project dashboard and navigation]] is `V1` and stays that way. Its full outcome — planning
progress, next actions, recent activity, a budget and schedule summary — is V1 work, and most
of it reads entities that do not exist.

This PBI is that Feature's **MVP subset**, and the split is not a preference. Today a
renovator can create a project and **cannot create a plan**: nothing in `presentation/` calls
`CreatePlanCommand`, and the only path to one is `create-sample-project`, a command named for
the fact that it is scaffolding. The loop the plugin exists for — `Zone Geometry → Area →
Requirement → Cost` — starts at a plan, so every downstream capability is unreachable. That is
a dead end rather than friction, and it sits inside the MVP by the same reasoning that puts
[[Start a renovation project]] there.

An MVP child under a V1 parent reads oddly in the tree, which is why it is explained here
rather than fixed by moving a Feature this work does not own.

## What has since been built, and what the design packages found still open

**Both states ship.** The list state is the Renovation Planner Home increment — a filter that is
also the pane's count line, two commissioned facts per row (`planCount`, `lastWorked`), a ten-step
status strip, a `Continue` group, a collapsed `Completed` group and a roving-tabindex keyboard
model. The detail state is design slice 21 — one project's name, status, plans, an `Open note`
action and a `New plan` form over the real `CreatePlanCommand`. The dead end this note was written
about is closed: a renovator can create a plan without `create-sample-project`.

**`docs/user-experience/renovation-planner-project-specs/` arrived on 2026-09-05** and reconciled
that build against its own ten proposed use cases, pinned to commit `7b6bb2b2`. Most of them
describe what already ships. Four gaps survived the reconciliation and are notes of their own
rather than a list here, because a list of open items inside a parent is a list that goes stale
when one of them closes:

- [[Return to the project list with my search context]] — the remount drops the filter, the
  expansion and the scroll by design, and this decides to pay them back.
- [[Enter a project immediately after creating it]] — a confirmed create re-hydrates the list and
  does not navigate.
- [[Resume the last plan on a confirmed opening]] — `openPlan` proves intent rather than success,
  so a plan that never opened can be remembered.
- [[Continue when the last plan is unavailable]] — a failed read and a deleted plan answer the same
  sentinel, so a transient fault reads as a deletion.

One further proposal is a **change** rather than a gap and is held as a decision instead:
[[A field edit commits on blur, and two design packages ask for an explicit Apply]], which governs
the price rows here and the asset library's definition fields at once.

**Two facts the row reserves and may not invent** — planned budget and planning progress. Both are
this Feature's own V1 outcome, and until a query derives them from real requirements and real costs
the slots render nothing at all. Approximating either is the one thing the surface's design refuses
by name.

## What it does not cover

- **Aggregation across projects.** [[The vault holds many projects, and selecting one is not
  a portfolio]] refuses it, and nothing here reopens that: selecting among projects is not a
  portfolio, [[Project]] stays the sole root, and SDD §47's per-project index is untouched.
- **Creating the first project.** [[Start a renovation project]] owns that, and says so: its
  preconditions describe the first-run case and hand the populated-vault case here.
- **The plan editor itself.** [[Plan editor and canvas]] owns everything past the moment a
  plan opens.

## Outcome

A renovator opens the Renovation project pane, sees the projects in their vault, opens one,
and gets from there to a plan they can draw on — or to their first one — without leaving the
pane to hunt through folders or remembering a command.

## Sources

Workspace PRD §8 (two top-level contexts), §10 (Epic 1 — Renovation Planner Home), §12
(Epic 3 — Project Home), §13 (Epic 4 — Project Navigation), §34 (Post-MVP scope —
cross-project dashboards), §35 (Slice 1's success criterion); original PRD §52 (product
success criteria); SDD §11 (workspace views), SDD §47 (project index).

Decided by [[The vault holds many projects, and selecting one is not a portfolio]].
