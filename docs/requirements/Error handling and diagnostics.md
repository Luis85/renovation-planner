---
type: Feature
parent: "[[Cross-cutting concerns]]"
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

# Error handling and diagnostics

§44's six typed error categories — validation, persistence, import, geometry, calculation, unsupported
format — plus §92's diagnostics. Every product epic can raise all six, which is exactly why the
vocabulary belongs here: six epics inventing their own error shapes produces six ways of telling a
renovator that something went wrong.

§45's rule that unexpected failures are translated at application boundaries is the mechanism, and
`publishing.md`'s note about console noise is the constraint on the other end: logging that is not a
real error path is a review rejection.

## Outcome

When something fails, a renovator is told what kind of problem it is and what to do, in the same shape
every time.
