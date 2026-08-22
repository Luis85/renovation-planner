---
type: Epic
order: 70
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

# Construction sections

Nobody renovates a room. They replace a bathroom, rewire a floor, insulate a roof — measures
that cross several zones, and zones that host several measures. §16 is the unit a private
renovator actually budgets, awards and schedules, and §80 lets one span plans, because a heating
replacement is not a storey.

Without this epic, [[Zones and spatial objects]] would have to be two things at once: the
description of a place and the description of a job in it. Everything downstream would inherit
that confusion, because a trade is awarded a measure and a quote prices a measure, and neither
of those is a room.

Its lifecycle in §16 is the first place the product admits that renovation work has states other
than done. `blocked` in particular is what lets a plan keep matching a site.

Derived from PRD §16 (Epic 5), with cross-plan scope from §80, the cost hierarchy from §10 and
overrides from §89.

## Definition of done

An item beneath this epic is done when:

- A section may reference zones across more than one plan (§80) without copying the geometry or
  the zone.
- Its lifecycle is exactly §16's seven states, written as frontmatter a human can read.
- Its budget aggregates from what it contains, along §10's hierarchy, rather than being typed a
  second time. A figure typed over the derived one is stored and shown as an override (§89),
  never quietly mixed in with derived data.
- Visual status carries something besides colour (§44), and the same status is available in a
  list view.
- A trade assignment is a link into the catalog owned by [[Trades and work packages]], not a
  copied name. Two spellings of one trade is the failure this prevents.
