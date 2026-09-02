---
type: Task
parent: "[[Understand room costs and follow them to their authority]]"
order: 40
status: New
horizon: "V1"
release: ""
---

# Open quote comparison from a room cost

## Evidence

M13 explicitly sends Compare quotes to a dedicated downstream view. The existing
[[Quote comparison]] feature compares each offer against the plan and owns that derived view.

## Why it matters

Quote comparison needs enough space and authority to expose scope gaps; compressing it into the
Inspector would duplicate both its model and its decisions.

## Approach

Add a route from the selected room or cost group to the quote-comparison capability, passing
authoritative spatial, work and cost references. Render only availability, summary and navigation
in the Inspector.

## Acceptance criteria

1. The action opens quote comparison with the selected room's relevant plan/work context.
2. No quote normalization, scoring, coverage arithmetic or selection state is implemented in the
   Inspector.
3. Returning from comparison restores the room selection where the host supports it.
4. An unavailable comparison route is disabled with an accessible explanation.

## Risks

- Treating a navigation summary as comparison could create competing answers.
- Context restoration depends on clear ownership between Obsidian view state and editor selection.

## Outcome

Room costs lead to authoritative quote comparison without turning the Inspector into one.
