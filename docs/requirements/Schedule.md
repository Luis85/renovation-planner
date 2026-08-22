---
type: Epic
order: 120
status: ""
started: ""
finished: ""
horizon: "V1"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Schedule

§21 puts the work on a time axis. For a renovation the binding constraints are almost all
sequencing ones rather than effort ones: screed cures before flooring goes down, the electrician
precedes the plasterer, the kitchen cannot be fitted before the floor exists. A budget that is
right and an order of work that is wrong still costs somebody a fortnight.

This epic is a *view over* dependencies rather than an owner of them.
[[Trades and work packages]] owns §77 and §78; if the schedule stores its own copy of what blocks
what, the two disagree the first time somebody edits one.

The scope line is drawn by §48, which puts advanced scheduling explicitly out of the MVP.
Critical path, resource levelling and calendars are a later note, and this epic must not smuggle
them in under `timeline`.

Derived from PRD §21 (Epic 10), with dependencies from §77–§78, overrides from §89 and the MVP
exclusion in §48.

## Definition of done

An item beneath this epic is done when:

- Dependencies are read from the model in [[Trades and work packages]], with no second copy
  stored here.
- A date implied by a dependency is derived; a date a user fixed is stored and marked as fixed
  (§89). A user must be able to see which of the two they are looking at.
- Trade and construction-section timelines are views over the same data, not separate stores.
- A milestone is a dated marker holding no work of its own, and may be depended upon (§77).
- Anything drawn as a timeline is also available as a list or table (§44). A Gantt chart is one
  of the least accessible things a plugin can draw.
