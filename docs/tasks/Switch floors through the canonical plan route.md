---
type: Task
parent: "[[Navigate property, building and floor context in the editor]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Switch floors through the canonical plan route

## Evidence

[[Open a floor plan in the Obsidian editor shell]] makes one identity-keyed reveal operation and
Obsidian view state the authorities for the Plan shown by a leaf.

## Why it matters

A navigation-only switcher that bypasses the established route can duplicate leaves, show stale
context or create a second current-Plan authority.

## Approach

Hand every accepted floor choice to the existing Plan reveal/navigation operation, await the
target hydration state, and update navigation presentation only from the resulting leaf context.

## Acceptance criteria

- Breadcrumb, tree and list choices invoke the established Plan route.
- The target is identified by stable Plan ID rather than title, path or list position.
- Repeated or concurrent selection of one floor follows existing duplicate-leaf rules.
- A failed target read leaves the requested identity visible in a clear failure state.
- Switching floors performs no hierarchy or geometry write.

## Risks

Optimistically changing navigation state before the authoritative route settles can make the
shell and canvas disagree.

## Outcome

Changing floors uses the same Plan authority as every other editor entry point.
