---
type: Epic
order: 180
status: ""
started: ""
finished: ""
horizon:
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
release: "[[Brave Turtle]]"
---

# Decisions, scenarios and change management

The PRD splits this too — §25 for decisions and change management, §29 for scenarios and
alternatives — and both are the same act at different sizes: model a variant, work out what it
costs and delays, choose, and keep the reasoning. §29's *select scenario* is a decision under
§25's definition, and §25's *alternatives* are scenarios that were never given a name. Kept
apart, both epics need an impact engine, and two impact engines that disagree is worse than
either.

The merge is the one in this backlog where the PRD's split was defensible, so the reason is worth
writing down: §25's impacts land on budget, schedule, assets, procurement, work packages and
tasks, and §29's comparison dimensions are cost, duration, material, effort and risk. Those are
one calculation read two ways, not two calculations. What the merged epic must not do is let the
smaller case get expensive — recording "we chose vinyl because the subfloor was uneven" cannot
require constructing a scenario.

What makes it worth building at all is that six months later nobody remembers why the underfloor
heating was dropped, and the alternatives that were rejected are the first thing to disappear.
The same standard `docs/README.md` sets for an Issue applies here: a record that says only what
was chosen is history rather than something anybody can argue with.

Derived from PRD §25 (Epic 14) and §29 (Epic 18), with dependencies from §77 and derived data
from §88.

## Definition of done

An item beneath this epic is done when:

- A decision records the alternatives rejected and why, not only what was chosen.
- Recording a decision with no scenario attached stays cheap. If the light case costs what the
  heavy one costs, the light case will not be recorded, and it is the commoner one.
- A scenario is a variant of plan data rather than a copy of the vault; the parts it does not
  change stay shared, and nothing in it reaches a committed aggregate until it is selected.
- Impact and comparison are one derivation (§88), presented against §25's six axes or §29's five
  dimensions as the case needs. Neither writes budgets or dates back on its own.
- Selecting a scenario is an explicit, recorded act with a date, not a silent overwrite of the
  plan.
- An unselected scenario and a superseded decision are both kept. They are the evidence for the
  choice, and deleting them leaves the choice unexplainable.
- A decision may block a work package (§77), so the schedule can show work waiting on somebody
  making up their mind.
