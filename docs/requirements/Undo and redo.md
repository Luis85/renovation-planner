---
type: PBI
parent: "[[Editor foundation]]"
order: 100
status: New
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
release: "[[MVP]]"
---

# Undo and redo

## Actor

[[Private renovator]] experimenting with a floor plan and needing a safe way back.

## Preconditions

- The current editor leaf has one command-history authority.
- A completed reversible editor command has reported whether it wrote.
- The current vault revisions still permit the inverse operation.

## Main flow

1. A successful reversible editor action is added once to the leaf's shared history.
2. The context bar updates Undo and Redo availability.
3. The renovator activates Undo.
4. The history executes the command's inverse through the same application and persistence
   boundaries, then refreshes the projection.
5. The action becomes available to Redo.
6. The renovator activates Redo and the command replays exactly once against current versions.

## Extensions

- **1a** — A command succeeds without writing. It does not clear a save error or create a false
  history entry.
- **3a** — No undo entry exists. Undo is unavailable and no command runs.
- **4a** — The inverse refuses because vault state changed. The refusal is surfaced once and the
  history remains coherent; external work is not overwritten.
- **4b** — The write succeeds but refresh fails. The last valid projection remains marked stale
  and retry repeats only the read.
- **6a** — A new action occurs after Undo. The abandoned redo branch is retired predictably.
- **6b** — Redo refuses or faults. It does not execute a second time automatically.

## Guarantee

Undo and redo operate through one per-leaf history over completed reversible commands. They never
infer a write from success alone, overwrite a newer external revision or replay a write merely to
repair a failed read.

## Out of scope

- Persisting command history across plugin reloads.
- Undoing arbitrary manual edits made outside the plugin.
- Draft-local `Undo point` behavior before a creation task commits.
- Domain-specific inverse semantics not yet implemented by later Features.

## Acceptance criteria

1. Every reversible editor command uses one shared history for the leaf.
2. Undo and Redo availability reflect the actual stack and are keyboard reachable.
3. One Undo executes one inverse; one Redo replays one command.
4. A new action after Undo clears the redo branch.
5. Revision conflicts never overwrite external changes.
6. Successful no-write outcomes do not create misleading history or save-state transitions.
7. A failed post-write refresh retries hydration only and never repeats Undo or Redo.

## Assumptions

- History remains ephemeral while the resulting domain state persists.
- Composite actions supplied by later Features define one inverse and appear as one user action.
- Current reversible command and save-state mechanisms are evolved rather than replaced.

## Sources

- [M00 — Kitchen Selected Overview](../user-experience/renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md)
- [M03 — Add Room](../user-experience/renovation-planner-editor-specs/screens/M03-add-room.md)
- [M11 — Multi-Selection](../user-experience/renovation-planner-editor-specs/screens/M11-multi-selection.md)
- [M15 — Stale-Data Warning](../user-experience/renovation-planner-editor-specs/screens/M15-stale-data-warning.md)
- [Vertical-slice plan: WP7](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md)
