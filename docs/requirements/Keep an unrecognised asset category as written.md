---
type: PBI
parent: "[[Asset definitions and categories]]"
order: 10
status: New
started: ""
finished: ""
horizon: "MVP"
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
---

# Keep an unrecognised asset category as written

[[Asset library]]'s definition of done says asset categories are configurable and *"an unrecognised
category is kept as written"*. The code does the opposite, and not by a margin:
`assetFrontmatter.ts` validates `category` through `kebabEnum(ASSET_CATEGORIES)`, which adds a
schema issue and returns `z.NEVER` for a value outside the seven. The field does not fall back —
**the whole note fails to parse**.

So a renovator who types `category: insulation` into an asset note does not get a category kept as
written. They lose the asset: its name, its price, its unit, its supplier and its shape. What they
see is a number in the library's some-unreadable strip, with nothing saying which note or why.

## Actor

A renovator whose vocabulary is not the seven built-in categories — which is every renovator whose
project involves something the list does not name.

## Main flow

1. The renovator writes `category: insulation` into an asset note, by hand or by copying one.
2. The note loads.
3. The asset appears in the library under a shelf named for its own category.
4. Its price, unit, supplier and shape are readable and editable exactly as any other asset's.
5. Nothing rewrites the value. Saving the asset writes `insulation` back.

## Extensions

- **3a. Several assets share the unrecognised category.** They share one shelf. The shelves are
  derived from the categories present, so this needs no registration.
- **5a. The renovator edits another field.** The category survives the write untouched. A value the
  form does not offer is not a value the form may drop.
- **5b. The renovator changes the category through the library's own control.** The control offers
  the known vocabulary and whatever this note already holds, so choosing is possible without the
  unrecognised value being the only thing that cannot be chosen again.
- **2a. The category is absent.** Unchanged from today — the existing default applies.
- **2b. The category is present but not a string** — a list, a number. That is a malformed note and
  refusing it is right. This item widens what a *string* category may say, not what shape the key
  may take.

## Guarantee

**A value this build does not recognise never costs the renovator data it is not about.** Whatever
the category says, the eight other fields of that asset load, render and save — so an unknown
vocabulary degrades to an unfamiliar shelf label rather than to a missing asset.

## Scope

`category` on the asset schema only. §84 names four more extensible vocabularies — Zone types,
Trades, Document types and Cost types — and each is its own spelling of the same fix with its own
consumers. Doing five at once is a persistence change nobody can review; this one is where the
damage is visible today, because the library surface is where an unreadable asset is counted.

Whether this needs a schema version bump is the open question the work has to answer first: the
change is a widening, so a note written under the old rule still parses, which is the shape this
repository has three times treated as a redefinition rather than a bump. That precedent is
recorded and its cost — a migration runner still unproven on a real chain — is recorded with it.

## Acceptance criteria

- An asset note with `category: insulation` loads, and its name, unit, price and supplier are all
  readable.
- That asset appears under a shelf labelled for its own category, beside the built-in shelves.
- Editing that asset's price and saving leaves `category: insulation` in the note unchanged.
- The some-unreadable strip does not count it.
- A note whose `category` is a list is still refused.

## Sources

[[Asset library]]'s definition of done; PRD §84 (custom types);
`docs/user-experience/asset-library-delivery/enablers/EN-01.md`, whose boundary names this
("Unknown values must not be silently destroyed by the UI");
`docs/user-experience/asset-library-delivery/specification/decision-register.md` (D04, D13);
`docs/user-experience/archive/asset-library-overview-DESIGN-SPEC.md` §1a, which found it and
declined to fix it from a view.
