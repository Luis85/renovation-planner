---
type: Epic
order: 80
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

# Asset library

A cost needs something to be the cost *of*. §17 is the catalog of physical things a renovation
consumes and installs — tile, paint, socket, radiator, shrub, worktop — kept as reusable
definitions rather than as line items retyped per room.

The payoff is §17's automatic quantity, and it is where the spatial premise stops being a
graphic and becomes money: a floor area from [[Calibration and measurement]] against a tile's
coverage is a quantity nobody typed and nobody can mistype. That is the argument for a library
rather than a list of costs.

It owns the *quantity* chain and not the price arithmetic. §75 names the steps — calculated
requirement, waste adjustment, required, purchase, delivered, consumed, remaining — and this
epic is responsible for the first of them existing under those names, so
[[Cost and budget engine]] and [[Suppliers, quotes and procurement]] attach to a named step
instead of inventing one.

Derived from PRD §17 (Epic 6), with quantity semantics from §75, custom types from §84 and
derived data from §88.

## Definition of done

An item beneath this epic is done when:

- An asset definition is reusable across plans and projects, and a placement references it
  rather than copying its price. A price copied at placement time is a price that goes stale
  silently.
- A geometry-linked asset's quantity is derived from the geometry on every read (§88), and the
  derivation is unit-testable with no canvas and no vault.
- The quantity chain uses §75's names as far as this epic reaches, so a later epic extends the
  chain instead of starting a parallel one.
- Asset categories are configurable (§84) and Custom stays available; an unrecognised category
  is kept as written.
- The catalog is searchable, and reachable through Bases (§41) rather than only through this
  plugin's own views.
