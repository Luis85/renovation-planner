---
type: Task
parent: "[[Use the editor in Obsidian themes and constrained layouts]]"
order: 60
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Dismiss temporary panels without discarding pending work

## Evidence

M16 requires canvas click or Escape to close temporary panels when safe, focus restoration on
close, and preservation of selection, viewport and drafts that are safe to retain.

## Why it matters

Panel dismissal can be mistaken for cancelling the task inside it, while an unscoped Escape
handler can clear selection or discard a draft before closing the nearer surface.

## Approach

Give temporary panel state its own dismissal boundary. Route canvas click and Escape through an
explicit precedence order, preserve pending work unless the user invokes its separate cancel
action, and restore focus to the control that opened the panel.

## Acceptance criteria

- Clicking unobscured canvas closes the open temporary panel without changing selection,
  viewport or pending work.
- Escape closes the nearest eligible menu, dialog or temporary panel before clearing selection or
  cancelling a broader editor state.
- A focused field or dialog retains first claim on Escape according to its own contract.
- Dismissing a panel does not dispatch Finish, Cancel or a persistence command for its pending
  work.
- Reopening the panel restores the retained draft where retaining it is valid.
- Focus returns to the opener after keyboard dismissal and moves meaningfully after canvas
  dismissal.
- Repeated dismissal when no panel is open falls through to the established selection/tool Escape
  behavior exactly once.

## Risks

Panel visibility and draft lifetime may be stored together, making dismissal destructive by
construction or causing the same Escape press to reach two handlers.

## Outcome

Temporary panels leave the canvas quickly while preserving pending intent and predictable keyboard
and focus behavior.
