---
type: Task
parent: "[[Update purchased material quantities from spatial context]]"
order: 30
status: New
horizon: "V1"
release: ""
---

# Show purchased-versus-needed status after a spatial edit

## Evidence

M12 distinguishes needed from purchased quantity and asks for procurement status. The quantity
authorities keep Requirement, purchase, delivery, consumption and installation as separate facts.

## Why it matters

The user needs to know whether a material need is covered without presentation subtracting or
rounding values that belong to procurement.

## Approach

Extend the procurement read model with needed, package-derived purchase, recorded purchased and
authoritative status fields. Refresh it after a purchase edit and after the linked needed quantity
changes, preserving failure and unavailable states.

## Acceptance criteria

1. Below-needed, exactly-needed and above-needed quantities produce distinguishable status text.
2. The status updates after either purchased or needed quantity changes.
3. A failed or unavailable read is not shown as zero purchased or "not purchased".
4. Delivery, consumption and installed state are neither inferred nor displayed as purchase
   status.

## Risks

- Inspector-side subtraction could drift from package and multi-procurement rules.
- Reusing one status for purchased and delivered would collapse two lifecycle facts.

## Outcome

The spatial material row reports procurement-owned coverage status without becoming its
calculator.
