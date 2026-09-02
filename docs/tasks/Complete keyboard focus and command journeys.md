---
type: Task
parent: "[[Operate the released editor without a pointer]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Complete keyboard focus and command journeys

## Evidence

Phase 12 explicitly names selection, Add, room/wall creation, Inspector, and dialogs.

## Why it matters

Individually focusable controls can still form a broken journey through traps, lost focus, or
host shortcut conflicts.

## Approach

Drive full keyboard journeys across shell, list/form alternatives, overlays, dialogs, stale
recovery, undo/redo, and return to Obsidian. Assert focus visibility, order, names, restoration,
and disabled reasons.

## Acceptance criteria

- Named Phase 12 journeys finish without pointer events.
- Escape, Enter, Delete, and undo/redo respect fields, dialogs, tools, and host context.
- Closing transient UI restores meaningful focus.

## Risks

Synthetic key events do not reproduce Obsidian's keymap.

## Outcome

Automated journeys hold the editor's keyboard and focus contract.
