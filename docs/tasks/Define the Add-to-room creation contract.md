---
type: Task
parent: "[[Start room creation from Add]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Define the Add-to-room creation contract

## Evidence

M02 specifies one Add menu, homeowner labels and one-shot tools; VS-03 requires Add → Room
before any Room geometry is written.

## Why it matters

Without one contract, toolbar, keyboard and empty-state entries can start different tools or
expose Zone/Polygon vocabulary.

## Approach

Define the Room catalog entry, availability, activation result and cancel state across
application and presentation boundaries. Map Room to the existing Zone-backed creation capability
without changing persisted terminology. Add contract and localization tests.

## Acceptance criteria

- Room has one canonical activation contract used by every input.
- Availability and start failures are typed and testable.
- User-visible labels contain no internal geometry terms.

## Risks

The catalog may become a second tool registry; keep activation delegated to the existing runtime.

## Outcome

Every Add surface can ask one tested contract to start Room creation.
