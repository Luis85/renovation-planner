---
type: Issue
parent: "[[User Interface]]"
order: 80
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

# A field edit commits on blur, and two design packages ask for an explicit Apply

An open question. Both packages that arrived on 2026-09-05 propose the same change to the same
mechanism, from opposite ends of the product, and neither may be built before this is settled —
because the mechanism is shared and the change is not a per-surface preference.

## The question

Today a field edit commits when the field is left or `Enter` is pressed. `useFieldCommit` is that
rule, and it has four consumers: the Plan Editor Inspector's two Requirement override fields, the
Asset library inspector's nine definition fields, the project detail state's asset price rows, and
whatever the next surface adds. A rejected commit keeps the user's typed value and shows a
persistent inline error; it never reverts.

Both packages ask to replace that with an explicit control:

- `asset-library-delivery`, decision **D03** and PBI-05: *"unified draft with Save/Discard"*, with
  PBI-06 adding a protection dialog when a selection changes while a draft is unsaved.
- `renovation-planner-project-specs`, PBI-07: *"Typing and blur produce no write. Apply or Enter
  dispatches a valid draft once."* Its own Ready blocker names the same thing — *"Confirm explicit
  saving as a deliberate deviation from current blur behavior. Do not globally change shared hook
  semantics."*

Neither package noticed that it was asking for the other's change.

## Why it cannot be answered per surface

`useFieldCommit` is one function with one contract, and the two commit boundaries beside it
(`useFormCommit`, for one explicit submit) already express the alternative this question proposes.
Three outcomes are available and they are not equivalent:

- **Keep blur/Enter everywhere.** Costs nothing, and refuses both packages' PBI-05/06/07 as
  designed rather than as unbuilt. The draft-protection dialog then has no draft to protect and
  PBI-06 dissolves rather than being deferred.
- **Move the two catalogue surfaces to an explicit Apply and leave the Inspector alone.** Buys what
  both packages ask for and makes one product hold two commit models, which is the state a user
  discovers by losing an edit on whichever surface behaves the other way.
- **Move everything.** One model, and it rewrites the Plan Editor Inspector's commit path, which
  neither package examined and neither is scoped to change.

## What blocks on it

`asset-library-delivery` PBI-05, PBI-06 and the conflict half of PBI-14;
`renovation-planner-project-specs` PBI-07 and the dirty-navigation half of PBI-09. Five proposed
items across two packages, and every one of them is a different spelling of this one answer.

## What is NOT in question

That a rejected commit keeps the user's input. Design slice 16 decided it, both packages restate
it, and no option here reopens it.

## Sources

`docs/user-experience/asset-library-delivery/specification/decision-register.md` (D03);
`docs/user-experience/asset-library-delivery/pbis/PBI-05.md`, `PBI-06.md`, `PBI-14.md`;
`docs/user-experience/renovation-planner-project-specs/implementation/repository-reconciliation-and-backlog.md`
(PBI-07, PBI-09, and its §1 row on the price row).
