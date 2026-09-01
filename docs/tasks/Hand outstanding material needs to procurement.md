---
type: Task
parent: "[[Manage materials from spatial context]]"
order: 40
status: New
horizon: "V1"
release: ""
---

# Hand outstanding material needs to procurement

## Evidence

M12 offers a shopping-list route from outstanding quantities, but procurement lifecycle, package
sizes and deliveries already have authorities outside the editor. The V1 boundary keeps the
handoff and defers full procurement.

## Why it matters

The selected room should lead naturally to buying work without making its Inspector responsible
for orders, deliveries or inventory.

## Approach

Expose the authoritative outstanding and purchase quantities returned for each material need and
provide a contextual route to the procurement or shopping-list capability. Pass source
requirement ids and spatial context; keep all procurement state in its owning feature.

## Acceptance criteria

1. The handoff includes only requirements the procurement authority reports as outstanding.
2. Package rounding, reserved, purchased and delivered values are displayed only when supplied by
   their authorities.
3. Activating the route opens the owning procurement surface with the relevant requirements.
4. When procurement is unavailable, the route is disabled with a reason and the material list
   remains usable.

## Risks

- Calling needed minus purchased in presentation would duplicate procurement arithmetic.
- A broad V1 handoff could be mistaken for delivery tracking.

## Outcome

Material needs selected in the editor can be continued in procurement without importing
procurement into the Inspector.
