---
type: Epic
order: 27.5
status: Active
started: 2026-09-01
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

**`docs/user-experience/asset-library-delivery/` arrived on 2026-09-05** — a UI/UX specification for
the catalogue surface plus eighteen proposed use cases under five feature groups of its own. It was
written without being rechecked against a commit, and says so; its own EN-01 is the reconciliation
that check needs. Reconciled against the shipped surface, thirteen of the eighteen describe
behaviour that already exists, two are the commit-model change held as
[[A field edit commits on blur, and two design packages ask for an explicit Apply]], two are partial
consequences of that same decision, and one — Bases access — is the definition-of-done item above.
The package's F01–F05 groups are its own planning aids and are deliberately not adopted as
Features here: the four beneath this epic already carry the same ground, and a second set would
give one body of work two parents.

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
  **UNMET, and today's behaviour is its opposite.** `assetFrontmatter.ts` validates `category`
  through `kebabEnum(ASSET_CATEGORIES)`, which returns `z.NEVER` outside the seven — so an
  unrecognised category is not kept as written, it takes the whole note down with it and the asset
  disappears into the library's unreadable count. [[Keep an unrecognised asset category as written]]
  is that item. Recording it here rather than leaving the criterion reading as merely unbuilt,
  because a criterion whose code does the opposite is a different fact from one nobody has got to.
- The catalog is searchable, and reachable through Bases (§41) rather than only through this
  plugin's own views.
  **HALF MET.** The Asset library view ships — a vault-wide catalogue as a place, with category
  shelves, a search matching name, supplier and SKU, an inspector that edits nine fields, a
  geometry mark, a where-used roll-up and a delete flow that checks references. That discharges
  *searchable* and discharges nothing of *rather than only through this plugin's own views*: that
  surface is precisely a picker this plugin draws, and its own specification says so. The second
  half is [[Reach the asset catalogue without this plugin's own view]], which is blocked on
  [[What discharges the catalogue's Bases access is undecided]] — the earlier decision settled
  that the route is a Bases view and not what has to ship for it to be reachable.
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
