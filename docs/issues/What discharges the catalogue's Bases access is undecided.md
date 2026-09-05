---
type: Issue
parent: "[[User Interface]]"
order: 90
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

# What discharges the catalogue's Bases access is undecided, and the epic's item rests on it

An open question, and the narrower half of one already answered.
[[The alternative list route is a Bases view]] decided **that** the alternative route to a spatial
object is a Bases view. It did not decide what a plugin has to ship for that route to be reachable,
and [[Asset library]]'s definition of done depends on the answer.

## The question

The epic asks that the catalog be *"searchable, and reachable through Bases (§41) rather than only
through this plugin's own views"*, and [[Searchable asset catalog]] names the same route.
`docs/user-experience/asset-library-delivery` PBI-18 asks for it too, and its scope boundary is
where the gap is visible: *"No automatic .base file creation without a decided strategy and no new
Bases engine."* So the item is blocked on a strategy nobody has written.

Three candidates, and they differ in who does the work:

- **A documented frontmatter contract.** The plugin promises which keys an asset note carries and
  what they mean; the user builds the view. Cheapest, and it is close to already true — every
  column the library draws is a frontmatter key by §2a's own rule.
- **A recipe.** Documentation walking a user through building the view, shipped in `docs/`. Costs
  a document that goes stale when a key moves and that no gate reads.
- **A shipped `.base` file.** The plugin writes a view into the vault. Reachable with no user work
  and the only candidate that puts plugin-authored content in a user's vault, with its own
  questions about overwriting, updating and removal on uninstall.

## Why it is worth deciding before the PBI

The three differ in what a test can assert. A frontmatter contract is checkable here; a recipe is
checkable only by a human following it; a shipped file needs a lifecycle nobody has designed. A PBI
written before this is answered would either invent one of the three or state acceptance criteria
that hold for none of them.

## What is NOT in question

That the library view may not be the only route. §2a states the rule and states its consequence —
**no fact about an asset may exist only in that view** — and no option here relaxes it.

## Sources

[[The alternative list route is a Bases view]]; [[Asset library]]'s definition of done;
`docs/user-experience/asset-library-delivery/pbis/PBI-18.md`;
`docs/user-experience/asset-library-delivery/specification/decision-register.md` (D12);
`docs/user-experience/archive/asset-library-overview-DESIGN-SPEC.md` §2a; PRD §41.
