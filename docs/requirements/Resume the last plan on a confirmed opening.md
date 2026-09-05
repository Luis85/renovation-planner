---
type: PBI
parent: "[[Project dashboard and navigation]]"
order: 40
dependsOn: "[[Continue when the last plan is unavailable]]"
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

# Resume the last plan on a confirmed opening

`Continue` offers the project and plan a renovator was last in. What it records is the plan they
last *asked* for, not the plan that last *opened* — `openPlan` answers `Promise<void>`, which
proves intent and nothing else, so a failed open and a successful one leave the same memory behind.

The consequence is small and repeated: `Continue` can point at a plan that has never once opened,
and it will keep pointing there, offering the same failure every time the pane is opened.

## Actor

A renovator returning to the pane, whose last session ended in a plan.

## Main flow

1. The renovator opens a plan — from `Continue`, from a project's plan list, or from the palette.
2. The plan editor opens on it and the plan loads.
3. That project and plan become the remembered target.
4. Next time the pane opens, `Continue` offers them by name.
5. Pressing it opens that plan.

## Extensions

- **2a. The leaf opens and the plan does not load** — a note that will not parse, a read that
  faults. The remembered target is unchanged, so a previously good one survives. Opening a leaf is
  not resuming work, and only the second is worth remembering.
- **2b. The open fails outright.** Same: the previous target stands.
- **1a. They open a project rather than a plan.** The target becomes that project with no plan, and
  it never inherits the plan id of the project they came from.
- **4a. The remembered project has no plan recorded.** `Continue` offers the project, and pressing
  it opens the project's detail state.
- **4b. Nothing is remembered** — a first run, or cleared storage. No `Continue` is offered, and
  its absence is not an error state.
- **5a. The plan is gone or unreadable by the time it is pressed.**
  [[Continue when the last plan is unavailable]] owns that, and this item hands to it.

## Guarantee

**A remembered target has opened successfully at least once.** Whatever happens on any branch, the
pair `Continue` offers is a pair that worked — so a target that cannot be opened is never the thing
a failed attempt leaves behind.

## What this does not add

No per-project history. One global target is enough for *the thing I was last doing*, and a map of
every project's last plan is a different feature with its own storage question. No editing
timestamp is derived from the stored context either: it records what was opened, not when.

## Acceptance criteria

- Opening a plan that loads updates the remembered target; opening one that fails to load leaves
  the previous target untouched.
- Opening project B after working in project A's plan leaves the target on B with no plan, never on
  B with A's plan id.
- A target recorded for a project with no plan offers the project and opens its detail state.
- With nothing remembered, no `Continue` region is drawn.

## Sources

`docs/user-experience/renovation-planner-project-specs/implementation/repository-reconciliation-and-backlog.md`
PBI-04, its Ready blocker on the opening-outcome contract, and its §1 rows on Resume, Open project
and Open plan; screens P00 and P02;
`docs/user-experience/archive/renovation-planner-home-DESIGN-SPEC.md` §14, where the durability of
`Continue` was answered and the leaf question dissolved.
