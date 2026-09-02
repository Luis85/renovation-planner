---
type: Task
parent: "[[Undo and redo]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Record editor writes in one shared history

## Evidence

The [vertical-slice plan WP7](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md) requires command-based mutations and one trustworthy undo/redo path; current outcomes distinguish writes from no-writes.

## Why it matters

Per-tool stacks and success-as-write inference produce missing actions or false history entries.

## Approach

Route every reversible editor dispatch through one leaf-scoped history and require explicit wrote/no-write outcomes before updating stack and save state.

## Acceptance criteria

- Reversible actions from different editor surfaces share one stack.
- No-write success creates no history entry.
- New action after Undo clears the redo branch.
- History availability and save state derive from explicit outcomes.

## Risks

Adapters can erase command outcomes before they reach history.

## Outcome

The editor records exactly the completed writes a user can reverse.
