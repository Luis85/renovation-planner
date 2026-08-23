---
type: PBI
parent: "[[Architecture and Software Design]]"
order: 40
status: ""
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---
# Errors, diagnostics and the test harness

Slices 11 and 12: the two cross-cutting slices. Neither delivers a feature; both are what
keeps the other fifteen honest.

| Slice | Increment | Primary SDD sections |
| --- | --- | --- |
| [11 — Error Handling, Diagnostics & Data Safety](../tasks/11-error-handling-diagnostics-and-data-safety.md) | — | §67–68, §86–88 |
| [12 — Testing & Architecture Enforcement Infrastructure](../tasks/12-testing-and-architecture-enforcement-infrastructure.md) | — | §69–76, §92 |

They are grouped for being cross-cutting, and **their scheduling is not the same**:

- **Slice 11 can be worked in parallel with slices 5–10 once slice 2 exists, and later
  slices do depend on it.** Slices 13, 16 and 17 all consume its `ToUserMessage` and Error
  Boundary, so "nothing later structurally depends on it" is false and is not the reason to
  parallelize it — the reason is that its own inputs are slices 1 and 2, so it does not wait
  on 5–10. What follows is a scheduling constraint rather than freedom: 11 must land before
  13, 16 and 17, not merely alongside them.
- **Slice 12's infrastructure can be stood up as early as slice 1; only its completion waits
  on everything.** Its `dependsOn` names slice 1, which is what must exist to *build* it —
  the directory layout, the vitest configuration and the lint rules have no ordering
  constraint and should exist from day one so no slice retrofits a harness. Its *completion*
  is a different claim: the Architecture Completion Criteria (§92) cannot be verified true
  until every slice exists. Frontmatter carries the first; slice 12's own *Dependencies*
  section carries the second. Nothing later structurally depends on slice 12 — the
  justification that does not survive for slice 11 does survive here.

## Outcome

A failure has one path from where it happened to what the user sees, and an architectural
violation is refused by a gate rather than by a reviewer noticing — including violations in
code nobody has written yet.
