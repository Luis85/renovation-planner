---
type: PBI
parent: "[[Editor foundation]]"
order: 130
status: Done
started: 2026-09-10
finished: 2026-09-11
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
release: "[[MVP]]"
---

# Create a detail plan from a zone and move between levels

## Actor

[[Private renovator]] building a property top-down: a site plan first, then a plan for a
building on it, then a plan for a floor inside that building.

## Preconditions

- A zone (Room or Area) is selected on the open plan.
- The current editor leaf can create a plan and reveal one through the canonical plan
  navigation.

## Main flow

1. The renovator right-clicks the zone and chooses **New detail plan**, prefilled with the
   zone's name.
2. The editor creates a plan linked to that zone and opens it in its own tab.
3. The new plan's breadcrumb and the sidebar's Property tree show every plan above it, each
   name opening that plan through the same canonical reveal a second click of it would use.
4. The new plan draws the parent zone's outline as a dashed, non-interactive guide at the
   top-left of its canvas, so a reference image cropped at the same corner lines up with it.
5. Back on the parent plan, the zone's context menu lists **Open {name}** for each of its
   detail plans, bringing an already-open tab forward rather than opening a second one.

## Extensions

- **1a** — The parent plan is missing or in another project, or the zone is missing or not on
  that plan. Creation is refused with the same localized "that entry no longer exists" sentence
  every other broken reference shows; nothing is created.
- **4a** — The plan whose zone this plan details has since been deleted or is unreadable. The
  ancestry chain ends at the project, no guide is drawn, and nothing says the zone is missing —
  the chain simply stops one level early.
- **4b** — The plan is still readable but its named zone has since been deleted. No guide is
  drawn, and the Property tree says the room or area this plan details no longer exists.
- **5a** — Writes are paused, or the leaf offers no plan navigation at all. **New detail plan**
  is not offered (in review perspective) or is shown disabled with the same reason every other
  paused zone action carries.

## Guarantee

A detail plan always knows which zone it details and which plans sit above it, both derived from
the same two reads on every hydrate rather than stored redundantly, and neither a missing parent
plan nor a missing parent zone is ever presented as an ordinary parentless plan.

## Out of scope

- Persisting new Property, Building, Site or Floor entities.
  [ADR-0017](../development/adrs/0017-plan-presents-as-floor.md) and
  [ADR-0028](../development/adrs/0028-a-plan-may-detail-a-zone-of-another-plan.md) defer that
  identity; a plan-to-zone link is not one.
- Warnings on deleting a zone that has detail plans, or any rewrite of its detail plans' links.
- A nested tree of detail plans in the project's own plan list.
- Inheriting the parent plan's background or calibration.
- Reparenting or clearing a detail plan's parent after creation.

## Acceptance criteria

1. Creating from a zone's context menu opens `NewPlanForm` prefilled with the zone's name and
   links the created plan to it.
2. Existing detail plans of a zone are each offered as an **Open {name}** entry on that zone's
   context menu.
3. The context bar and the Property tree show a detail plan's full ancestry, each ancestor
   opening its plan.
4. The parent zone's outline is drawn on the detail plan as a dashed, non-listening guide placed
   at world origin, translated by its own bounding box.
5. A parent plan that no longer resolves ends the ancestry at the project, draws no guide and
   shows no "no longer exists" line.
6. A parent zone that no longer resolves (its plan still loaded) draws no guide and the Property
   tree names the room or area as gone.
7. Creation refuses a missing or cross-project parent plan, or a zone missing or not on that
   plan, with the generic reference-broken message.

## Assumptions

- `Plan` remains the persisted concept a detail plan is; no new entity backs "detail".
- The existing plan-reveal/navigation authority is reused rather than duplicated for ancestry
  links.
- One plan-to-zone link is enough for this MVP; a plan detailing more than one zone, or a zone
  detailed from more than one plan, is not asked for.

## Sources

- [ADR-0028](../development/adrs/0028-a-plan-may-detail-a-zone-of-another-plan.md)
- `docs/superpowers/specs/2026-09-10-zone-lock-and-detail-plans-design.md` §4
- [[Navigate property, building and floor context in the editor]]

## Amendments

**2026-09-11** — Closed by the detail-plans implementation plan
(`docs/superpowers/plans/2026-09-10-detail-plans.md`), landed alongside
[ADR-0028](../development/adrs/0028-a-plan-may-detail-a-zone-of-another-plan.md). Closing
evidence: `tests/presentation/editor/detailPlans.e2e.test.ts` (creating from a zone's menu,
opening an existing detail plan, cancelling and blocking the create dialog),
`tests/presentation/read-models/planHierarchy.test.ts` (ancestry, detail-plan listing, the
parent-zone-missing and parent-plan-missing reads), `tests/presentation/editor/parentZoneGuide.test.ts`
(the outline guide's placement and its absence), and `tests/application/commands/plan/createPlan.test.ts`
(the three parent-refusal cases). The manual walkthrough is
`docs/tests/cases/Build detail plans from site to floor.md` and has not yet been run in a vault.
