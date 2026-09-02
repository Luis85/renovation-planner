---
type: PBI
parent: "[[Editor foundation]]"
order: 20
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

# Open a floor plan in the Obsidian editor shell

## Actor

[[Private renovator]] working from plans and notes in an Obsidian vault.

## Preconditions

- [[Consolidate the current and target editor data models]] has approved the Plan/Floor
  presentation contract.
- The project and its current `Plan` can be identified by stable IDs.
- The editor services and settings are available.

## Main flow

1. The renovator opens a floor from the project surface or the existing editor command.
2. The plugin reveals one Plan editor leaf for that floor identity.
3. The leaf mounts the Obsidian-native context bar, Property/Layers region, canvas, Inspector
   and status region without a product account or standalone application frame.
4. The editor loads the floor projection and enters Select with no active creation task.
5. The shell inherits the current Obsidian theme and remains usable beside another workspace
   leaf.

## Extensions

- **1a** — The same floor is already open. The existing leaf is revealed rather than duplicated.
- **3a** — Settings are unrecovered. The shell shows the established unavailable/failure state
  and offers no control that cannot work.
- **4a** — The floor cannot be read. A coded failure surface replaces uncertain content and
  provides the appropriate retry or close action.
- **4b** — A previously valid projection becomes stale after a successful write. The last valid
  content stays visible with the persistent stale warning; retry repeats only the read.
- **5a** — The leaf becomes constrained. Panels move to the approved rail/drawer pattern without
  resetting the floor, viewport or selection.

## Guarantee

The leaf either shows one trustworthy projection of the requested floor in a safe state or a
clear failure state; opening never creates a duplicate editor, changes vault data or presents an
unreadable floor as empty.

## Out of scope

- Creating or importing the floor and its reference plan.
- Mobile editing or a standalone application shell.
- New Property, Building or Floor persistence.
- Renovation semantics, materials, costs and evidence workflows.

## Acceptance criteria

1. Project navigation and the editor command reach the same reveal function.
2. Repeated opens of one floor reveal one leaf; different floors may coexist.
3. Opening enters Select and activates no destructive or creation task.
4. The shell uses Obsidian semantic theme values and has no plugin theme switch.
5. A read failure and a floor with no rooms render as different states.
6. Constrained layout preserves floor identity, selection and viewport.
7. Closing the leaf releases its listeners, stores and canvas resources.

## Assumptions

- `Plan` is the persisted implementation concept presented as **Floor** in V1.
- Obsidian view state, not a new router, identifies the floor shown by a leaf.
- This PBI assembles the shell around existing services; it authorizes no schema change.

## Sources

- [M01 — Standard Plan View](../user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md)
- [M15 — Stale-Data Warning](../user-experience/renovation-planner-editor-specs/screens/M15-stale-data-warning.md)
- [M16 — Constrained Workspace](../user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md)
- [Editor component library](../user-experience/renovation-planner-editor-specs/components/component-library.md)
- [Vertical-slice plan: WP2 and WP4](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md)
