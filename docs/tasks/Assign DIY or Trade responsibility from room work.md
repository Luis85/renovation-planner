---
type: Task
parent: "[[Turn a planned outcome into actionable work]]"
order: 80
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Assign DIY or Trade responsibility from room work

## Evidence

M10 requires responsibility changes to choose DIY or an existing Trade record, while the parent
workflow keeps responsibility in the canonical work authority.

## Why it matters

Free-text trade names and editor-owned assignment create identities that cannot follow renamed,
missing or unavailable Trade records.

## Approach

Expose DIY and readable existing Trades from the canonical responsibility capability for a room
work record. Dispatch assignment by stable work and Trade identity, then refresh the row from the
authority-owned result.

## Acceptance criteria

- A room work row can assign DIY without creating a Trade record.
- Trade assignment offers only readable existing Trade records and persists the selected stable
  Trade ID on the canonical work record.
- Renaming a Trade updates the displayed responsibility without changing the assignment identity.
- An unavailable Trade capability explains why assignment cannot be changed and leaves current
  responsibility visible.
- A currently assigned Trade that is missing or unreadable is shown as unresolved, not converted
  to DIY or an unassigned state.
- A stale selection or refused assignment preserves the previous authoritative responsibility.
- Assignment is keyboard operable and has the same command path outside the spatial convenience
  surface.

## Risks

DIY may be modelled as a synthetic Trade, or a missing Trade may be silently flattened into no
responsibility.

## Outcome

The renovator assigns room work to themselves or a canonical Trade without creating a second
responsibility model.
