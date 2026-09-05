---
type: PBI
parent: "[[Project dashboard and navigation]]"
order: 60
status: Active
started: "2026-09-05"
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
dependsOn: "[[Enter a project immediately after creating it]]"
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

# Choose the next step from a project's details

A project's detail state is a launcher for the project, not a checklist. It offers the plan work, the project note and the prices as peers, so a renovator with no plan yet still has two useful doors, and one with plans sees them by name and opens them directly. The guidance panel the package proposed is a session preference a renovator can hide, never a progress tracker.

## Actor

A renovator who has just opened a project.

## Main flow

1. The renovator opens a project from the list or straight after creating it.
2. The detail state draws the project's name and lifecycle, its plans by name, the note action and the prices action.
3. They choose one: open a plan, open the note, or go to the prices subsection.
4. They return to the detail state and choose again.

## Extensions

- **2a. The project has no plans yet.** The note and prices actions stay useful; the empty plan region says so plainly and offers New plan.
- **2b. Some plan notes are unreadable.** They are drawn as unreadable, not concealed as No plans yet; the project header and its independent actions stay usable.
- **2c. A response for the previously open project arrives late.** It is dropped; the current project's state is never overwritten by it.
- **3a. They hide the guidance panel.** It stays hidden for the life of that leaf and can be restored; the core actions never disappear with it.

## Guarantee

**Open project, Open project note and Open plan stay three distinct actions, and none of them is hidden by the state a project happens to be in.**

## Acceptance criteria

- A project with no plans shows an empty plan region, New plan, Open note and Prices.
- A project with one unreadable plan draws it as unreadable and keeps the header actions.
- Hiding the guidance in one leaf leaves the actions in place and does not hide it in another leaf.

## Scope

No artificial progress indicator and no persistent onboarding checklist. Guidance is a session preference of the leaf, not completion tracking.

## Project-surface implementation (2026-09-05)

`ProjectDetailState` composes the existing `NewPlanForm`, note and plan seams; regional plan errors are drawn and `unreadablePlans` is carried through the store; guidance visibility is leaf-session state. Automated creation and detail tests and the browser harness cover it (WP-02).

Delivered by pull request #73 (`codex/project-experience`). Live-vault observation — host history, split
leaves, a forced leaf close — is still unrun, so this note is Active rather than Done. Evidence and the
remaining limitations: [execution record](../user-experience/renovation-planner-project-specs/implementation/execution-record.md).

## Sources

`docs/user-experience/renovation-planner-project-specs/implementation/repository-reconciliation-and-backlog.md`
PBI-03 and its §1 rows; screens [P02](../user-experience/renovation-planner-project-specs/screens/P02-active-project.md), [P05](../user-experience/renovation-planner-project-specs/screens/P05-active-project-dark.md), [P07](../user-experience/renovation-planner-project-specs/screens/P07-active-project-narrow.md); the execution record's WP-00 decisions. Adopted into the register on
2026-09-05 with the rest of that package's ten; the five gaps the adoption ledger found were written the same day
and are its siblings under [[Project dashboard and navigation]].
