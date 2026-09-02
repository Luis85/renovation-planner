---
type: Task
parent: "[[Produce auditable release evidence]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Run moderated first-slice usability acceptance

## Evidence

WP8 requires a five-task moderated homeowner test, and first-slice acceptance requires at least
one first-time homeowner to complete create, select and reload without CAD explanation.

## Why it matters

Automated journeys can prove commands and persistence while missing vocabulary, discoverability
and recovery problems that stop a first-time homeowner.

## Approach

Recruit first-time homeowners and moderate the same fixed release candidate without teaching CAD
or implementation terms. Run five named tasks: **Open the Ground Floor**, **Create and name
Kitchen**, **Select Kitchen and inspect its overview**, **Undo and redo the Kitchen change**, and
**Reload and confirm Kitchen is unchanged**. Record prompts, completion, assistance, hesitation,
errors, create/select/reload observations and participant language. Capture defects separately
without expanding the slice during the session.

## Acceptance criteria

- The evidence identifies participant screening, moderator, date, build, host and test setup.
- Every participant receives the same five task prompts and task order.
- Each task records completion, time or observable stopping point, assistance, errors and notable
  comments rather than only a pass/fail summary.
- Create, canvas-or-list selection, Inspector identity, undo/redo and reload observations are tied
  to the same Kitchen identity and release candidate.
- At least one first-time homeowner completes create, select and reload without CAD explanation.
- Critical accessibility, data-loss or comprehension failures block acceptance; every other
  finding becomes a defect or backlog item with source evidence.

## Risks

Leading prompts or moderator help can turn a failed discovery task into an apparent success, and
a single successful participant does not establish broad usability.

## Outcome

First-slice usability acceptance contains moderated, participant-level evidence for the five core
homeowner tasks and an auditable defect record.
