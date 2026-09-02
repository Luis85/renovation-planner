---
type: Epic
order: 27.5
status: ""
started: ""
finished: ""
horizon: MVP
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
release: "[[MVP]]"
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
- **A project can record its own price against a shared definition**, as an override stored
  beside the shared default rather than replacing it (§89). The definition is shared across
  projects (§59) and the currency is not (§72), so a project whose currency differs from an
  asset's default has no other way to price it — and [[Quotes and quote items]], which would
  otherwise be that way, is V1 while this epic is MVP. An epic that shares a catalogue owes the
  projects that share it a way to disagree about price.
  **MET by the per-project price override increment of 2026-09-02.** `AssetPriceOverride` is an
  entity of its own with two repositories over one shared contract test, so the override is
  *stored beside* the shared default and replaces nothing: an asset's `unitCost` is untouched by
  setting one, and clearing one returns the pairing to the catalogue price. A project sets it on
  its own detail state; the cost pipeline resolves `override ?? asset.unitCost` in the two
  commands that price a Requirement, and the Inspector prints the library price, the project's
  price and the requirement's own recorded figure side by side with the one in force marked. What
  the epic asked for is exactly what closes the currency dead end beside it: the increment before
  this one made a mismatched pairing refuse, and this one is how a project *passes* that check
  rather than a way around it. Recorded in
  [20 — The Currency the Pipeline Is Told](../tasks/20-the-currency-the-pipeline-is-told.md)'s
  Amendment 4, which also carries what that increment withdrew and what it left standing.
