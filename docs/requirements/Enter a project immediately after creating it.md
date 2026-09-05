---
type: PBI
parent: "[[Project dashboard and navigation]]"
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

# Enter a project immediately after creating it

A renovator presses `New project`, fills the form, confirms — and lands back on the list they
started from, with their new project somewhere in it. They then find it and open it, which is two
gestures to reach the thing they just made and named.

## Actor

A renovator creating their second or thirtieth project. The first-run case belongs to
[[Start a renovation project]], which hands the populated-vault case here.

## Main flow

1. The renovator presses `New project`, from the list header or the empty state.
2. They complete the form and confirm.
3. `CreateProjectCommand` succeeds and answers the saved project, id included.
4. The pane navigates to that project's detail state.
5. The detail state draws a project with no plans, and its own actions are what the renovator does
   next.

## Extensions

- **2a. They cancel.** Nothing is created and nothing navigates.
- **3a. The command refuses** — a name that fails validation, a target date before the start. The
  form stays open holding what was typed, with the refusal against the field it is about, and the
  pane does not navigate.
- **3b. The write faults.** Same: the form keeps the input, the fault is surfaced, no navigation.
- **3c. The renovator submits twice.** One project is created and one navigation happens.
- **4a. Two projects share a name.** Navigation uses the id the command returned. It is never
  resolved by looking a name up in the list, which would open whichever of the two the read
  happened to answer with.
- **4b. The note is gone before the detail state's first read** — deleted, or a sync removed it.
  The ordinary missing-project screen draws, with its own way back. Nothing is created again.
- **5a. No plan is created.** Success here means a project exists, never that a plan does.

## Guarantee

**A confirmed creation is reached exactly once, or not at all.** Every branch either lands on the
project that was made, under the id the command answered, or leaves the renovator where they were
with their input intact — and no branch creates a second project or opens a different one.

## Acceptance criteria

- Creating a project navigates to the detail state of the returned id, once, with no intervening
  list render the user has to act on.
- Creating a project whose name duplicates an existing one opens the new project, not the old.
- Cancelling creates nothing and stays on the list.
- A refused or faulted create keeps the form and its input and does not navigate.
- Deleting the note between the command's success and the first detail read draws the missing
  state rather than creating anything.

## Sources

`docs/user-experience/renovation-planner-project-specs/implementation/repository-reconciliation-and-backlog.md`
PBI-02 and its §1 row on project creation; screen P01;
[[Start a renovation project]], which owns the first-run case.
