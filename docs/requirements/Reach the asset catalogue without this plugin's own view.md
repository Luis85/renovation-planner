---
type: PBI
parent: "[[Searchable asset catalog]]"
order: 10
dependsOn: "[[What discharges the catalogue's Bases access is undecided]]"
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

# Reach the asset catalogue without this plugin's own view

[[Asset library]]'s definition of done asks that the catalog be reachable *"through Bases (§41)
rather than only through this plugin's own views"*, and [[Searchable asset catalog]] names the same
route. The Asset library surface does not discharge it — it is precisely a picker this plugin
draws, and its own specification says so.

Today the ways to reach an asset are that view, the designer's fuzzy picker, and the assign control
inside a Plan Editor Inspector. All three are this plugin's. A renovator who wants their assets in
a table beside the rest of their vault has to know that an asset is a note and work out its
frontmatter for themselves.

## Actor

A renovator who already builds Bases views over their vault, and for whom a plugin that hides its
data behind its own screens is a plugin that has taken something away.

## Main flow

1. The renovator follows the documented route to see their assets outside the library view.
2. They see the catalogue's own facts — name, category, unit, price, currency, supplier, SKU.
3. They sort, group and filter with the host's own machinery.
4. They open an asset's note from there, and edit it as a note.
5. The library view, opened afterwards, shows what they changed.

## Extensions

- **2a. An asset has an unrecognised category.** It appears with its category as written, per
  [[Keep an unrecognised asset category as written]].
- **2b. An asset's note will not parse.** It is absent from the catalogue's own view exactly as it
  is absent from the library, and the library's unreadable count is where that is reported.
- **2c. A fact the library derives rather than stores** — the shape state, the where-used roll-up —
  is not available on this route. That is the honest boundary: those three are what the library
  does that a Bases view cannot, and this item does not promise them.
- **4a. They edit a value the library validates.** The note is the authority; the library reports
  what it finds, including a value it would itself have refused.

## Guarantee

**No fact this plugin shows about an asset exists only inside this plugin.** Every column the
library's rows draw and every field its inspector edits is a frontmatter key on a note the
renovator can open — so the route stays reachable whatever this plugin later draws, and a fact
added to the view that has no key is a defect rather than a feature.

## What is undecided

**Which form the route takes.** [[What discharges the catalogue's Bases access is undecided]]
carries the three candidates — a documented frontmatter contract, a recipe, or a shipped `.base`
file — and this item cannot state its acceptance criteria in a form-specific way until that is
answered. What is *not* undecided is the guarantee above, which holds for all three.

## Acceptance criteria

- Every column the library's rows draw and every field its inspector edits is a frontmatter key on
  the asset note, with no derived-only exceptions beyond the three §2a names.
- Following the documented route in a vault of real asset notes shows those assets with their
  metadata, without opening the library view.
- Editing an asset note directly and then opening the library shows the edited value.

## Sources

[[Asset library]]'s definition of done; [[The alternative list route is a Bases view]];
`docs/user-experience/asset-library-delivery/pbis/PBI-18.md`;
`docs/user-experience/archive/asset-library-overview-DESIGN-SPEC.md` §2a; PRD §41; PRODUCT.md
principle 5.
