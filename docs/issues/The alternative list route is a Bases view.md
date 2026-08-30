---
type: Issue
parent: "[[User Interface]]"
order: 40
status: Done
started: 2026-08-23
finished: 2026-08-23
horizon: Now
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

# The alternative list route is a Bases view

A decision taken, recorded with what it rejected. It was [[Sitemap]]'s open question 2 and
[[Design System]]'s open question 3, and it blocked design slice 05.

## The question

PRD §40 requires that spatial objects stay accessible without the canvas. PRD §44 and SDD §85
both ask for "alternative data access via lists". `PRODUCT.md` principle 5 makes it binding —
*nothing is canvas-only* — and names it as an accessibility requirement and a mobile-scope
requirement in the same breath. **No source says what kind of surface that route is.** Until
one did, every spatial surface would answer it locally, and [[Sitemap]] counts sixteen
surfaces against two registered, so the answer would have been given up to nineteen times.

## The decision

> **The alternative route is a Bases view. One decision for every spatial surface, not one per
> surface, and it is also the mobile read-only surface rather than a second thing that happens
> to work on mobile.**

## Why

- **The product already planned it.** PRD §41 lists seven Bases views and SDD §13 lists six,
  over the same vault data. The route is a surface the received documents already own; making
  it a Bases view spends nothing new.
- **The host has already built every quality §44 asks for.** Bases is localized, themed,
  keyboard-navigable and works on Obsidian mobile. `PRODUCT.md` principle 4 is
  host-deferential by policy, and this is the case where deferring hands over four
  requirements at once rather than one convenience.
- **It collapses two problems into one.** `PRODUCT.md` fixes device scope as desktop-first,
  mobile read-only, and SDD §61 preserves read-only options while optimising the MVP for
  desktop. A Bases view satisfying §44 *is* the mobile surface. Building the alternative route
  as anything else means building the mobile story twice, and [[Sitemap]] had already noticed
  that the two were one problem without being able to settle it.
- **It removes content from a note rather than adding it.** [[Design System]]'s open question 3
  asked whether the list row belonged to it at all. It does not: Bases owns the row, its
  states and its hit targets, so the design system owns nothing about it and has one fewer
  component to define, translate and keep consistent.

## Alternatives rejected

**A workspace view of its own, per spatial surface.** Full control over the row, and canvas
selection could sync with it live. Rejected on multiplication: it is a second surface to
design, name, translate, test and keep consistent for every spatial surface, against an
inventory that is already sixteen rows deep with two built. The mobile story would then be
hand-built too, which is the duplication the decision exists to avoid.

**A pane inside the plan editor.** Cheapest in surface count — no new row at all, and the list
sits beside the thing it lists. Rejected because it inherits the editor's desktop-only scope
and therefore loses the mobile half entirely. The deeper objection is a category error worth
recording: a route living inside the canvas's own surface is a *companion* to the canvas, not
an *alternative* to it. §44's requirement would go unmet on mobile and unmet for anyone who
cannot use the canvas at all, which is the population the requirement was written for.

**Bases as the rule, with an in-editor pane permitted where selection sync earns it.** Nearly
adopted, and rejected on one word. "Permitted" is what the author of the nineteenth surface
reads as permission, and [[Cross-cutting concerns]] exists because a concern decided twenty
times gets decided differently the twentieth. A pane may still be built — but it is a
convenience with no obligation resting on it, and this note is what says so.

## Consequences

- [[Sitemap]]'s open question 2 is closed; the alternative route adds no rows to the inventory
  because the Bases rows are already in it.
- [[Design System]] stops owning the list row. Its component inventory loses that entry.
- The mobile read-only scope from `PRODUCT.md` now has a named surface rather than a promise.
- A spatial surface is only finished when its Bases view exists, which is a new obligation on
  slice 05 and on every spatial surface after it.
- What Bases cannot express is now a constraint on the *product*, not an implementation
  detail: nothing plugin-specific can live in the row, and no drawn state or canvas selection
  can be reflected there. That is the price, and it is paid on every spatial surface.

## Revisit when

A requirement lands that Bases demonstrably cannot express and that §44 obliges — not a
convenience the canvas already provides. Selection sync alone is not that requirement, and
neither is styling.

## References

- PRD §40 (search and navigation), §41 (Bases integration, seven views), §44 (accessibility,
  alternative list/table access). SDD §13 (Bases integration, six views), §61 (responsive
  strategy), §85 (accessibility, alternative data access).
- `PRODUCT.md` — principle 4 (host-deferential), principle 5 (nothing is canvas-only), and
  the confirmed desktop-first, mobile-read-only device scope.
- [[Sitemap]] — its open question 2, and the observation that this and the mobile story are one
  problem. [[Design System]] — its open question 3. [[Information Architecture]] — the naming
  register a Bases view's label takes. [[Accessibility]] — which owns whether the route is
  owed, where this note owns only what it is.
- [[Budget, Schedule and Procurement are Bases views first]] — decided alongside this and
  leaning on it.
