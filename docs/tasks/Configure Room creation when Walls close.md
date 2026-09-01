---
type: Task
parent: "[[Draw connected walls and create an enclosed room]]"
order: 60
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Walls and hosted openings]]"
---

# Configure Room creation when Walls close

## Evidence

M04 exposes `Create a room when walls close` and requires optional Room creation in the Wall transaction.

## Why it matters

Closing geometry proves an enclosure, not that the homeowner wants a Room record created automatically.

## Approach

Expose a clear per-task setting for Room creation on valid closure. Detect the enclosure, preview the chosen
result, and include or omit Room creation in the existing atomic Wall finish command.

## Acceptance criteria

- The setting is visible before a valid chain closes.
- A closed chain creates a Room only when the setting and confirmation permit it.
- Walls-only and Walls-plus-Room outcomes each commit as one history action.
- Invalid or open chains never create a Room.

## Risks

A persisted global preference could create Rooms unexpectedly on later Floors.

## Outcome

Closing Walls creates an enclosed Room only through an explicit and reversible choice.
