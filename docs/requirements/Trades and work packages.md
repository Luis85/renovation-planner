---
type: Epic
order: 100
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

# Trades and work packages

A plan says what should change and a budget says what it costs. Neither says who does what, in
which order, and what has to be finished before somebody can start. §19 is where spatial scope
becomes executable scope, and it is the first epic in V1 (§49) because it is what turns a
planning document into something a renovation can be run from.

A work package is the thing a trade is actually awarded and paid for, which is why it takes a
*reference* to zones and sections rather than geometry of its own. The moment it copies geometry,
a plan change stops reaching the work.

Its second job is to be the single home for dependencies. §77 lists the pairs the product
allows and §78 the three types; if this epic gets them right, [[Schedule]],
[[Suppliers, quotes and procurement]] and [[Decisions, scenarios and change management]] all
schedule against one model instead of three.

Derived from PRD §19 (Epic 8), with the dependency model from §77–§78, custom types from §84 and
derived data from §88.

## Definition of done

An item beneath this epic is done when:

- A work package's spatial scope is a reference to zones or construction sections, never a copy
  of their geometry.
- The trade catalog is the one definition of a trade, and everything else links to it. Trade
  types are configurable (§84).
- Dependencies use §77's permitted pairs and §78's three types, so no later epic needs a
  dependency mechanism of its own.
- Progress at package level is derived from what the package contains (§88) rather than typed
  over it.
- A work package is a Markdown note (§37) with a stable ID (§60), so it survives being renamed
  by a user who is tidying folders.
