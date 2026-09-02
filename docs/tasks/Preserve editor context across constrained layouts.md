---
type: Task
parent: "[[Use the editor in Obsidian themes and constrained layouts]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Preserve editor context across constrained layouts

## Evidence

M16 requires rails, drawers, and unsupported-width fallback without resetting editor context.

## Why it matters

An Obsidian leaf regularly shares space with notes; resizing must not become data navigation.

## Approach

Test full, constrained, and unsupported editing widths. Reuse panel content, preserve selection
and viewport, restore overlay focus, retain Select/Add, and prohibit horizontal scrolling.

## Acceptance criteria

- Full-to-constrained-to-full preserves selected ID and viewport.
- One temporary panel opens at a time and restores focus on close.
- Unsupported width offers focus action and non-canvas summary.

## Risks

Viewport preservation can be falsely inferred from unchanged persisted geometry.

## Outcome

Layout adapts while the homeowner remains in the same editing context.
