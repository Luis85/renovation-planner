---
type: Task
parent: "[[Use the editor in Obsidian themes and constrained layouts]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Map editor roles to Obsidian theme variables

## Evidence

The cross-screen theme contract forbids a product palette and requires semantic host roles.

## Why it matters

Hard-coded mockup colors fail under community themes and can make state color-only.

## Approach

Inventory DOM and canvas visual roles, map each to Obsidian semantic variables through the
existing adapter, and pair state color with text, icon, line weight, marker, or pattern.

## Acceptance criteria

- No released component requires a fixed product color.
- Canvas and DOM use one semantic role mapping.
- Selection, warning, error, new, and removed states remain non-color-only.

## Risks

A variable name can exist while resolving to insufficient contrast in a real theme.

## Outcome

The editor inherits host appearance without losing semantic distinctions.
