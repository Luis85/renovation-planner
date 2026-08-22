---
type: Feature
parent: "[[Plan editor]]"
order: 50
status: ""
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

# Selection

Single and multi-selection (§13). It is the precondition for every editing command and for every
bulk operation later — assigning eight zones to one construction section, or retyping a dozen
assets at once — so its model is what decides whether those arrive cheaply or as special cases.

§37 puts selection in ephemeral state: it is UI only, never persisted, and reopening a plan starts
with nothing selected.

## Outcome

A renovator can pick one object or many and act on them together.
