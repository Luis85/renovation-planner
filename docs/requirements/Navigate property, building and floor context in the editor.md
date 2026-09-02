---
type: PBI
parent: "[[Editor foundation]]"
order: 110
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn:
  - "[[Consolidate the current and target editor data models]]"
  - "[[Open a floor plan in the Obsidian editor shell]]"
---

# Navigate property, building and floor context in the editor

## Actor

[[Private renovator]] orienting within the property while viewing or changing a floor.

## Preconditions

- [[Consolidate the current and target editor data models]] has approved how current
  `Project` and `Plan` identities present as Property, Building and Floor context.
- A project is selected through the current Project authority.
- One or more readable Plans are available through the current Plan authority.
- The editor shell can reveal a floor by stable Plan identity.

## Main flow

1. The editor derives a presentation hierarchy from the selected Project and its readable Plans
   without requiring new persisted Property, Building or Floor records.
2. The context bar shows Property → Building → Floor breadcrumbs for the open floor.
3. The Property tree presents the same current context and available floors.
4. The renovator follows a breadcrumb or chooses another floor from the tree or its
   keyboard-accessible list route.
5. The editor switches through the canonical Plan reveal/navigation authority and updates both
   navigation surfaces to the same stable floor identity.
6. The target floor restores its remembered viewport and starts with no selection from the
   previous floor.

## Extensions

- **1a** — The current model has no persisted Property or Building identity. The read model
  supplies an explicit presentation grouping; it does not mint or persist a fictional hierarchy.
- **1b** — A Plan is unreadable. Readable floors remain navigable and the refusal is shown
  additively; the missing floor is not presented as an empty one.
- **3a** — The leaf is constrained. The same hierarchy moves to the approved panel or list route
  without creating a second navigation state.
- **4a** — The renovator uses no pointer. Tree/list semantics, arrow-key movement and activation
  reach the same floor-switch operation.
- **5a** — The target floor is already open in another leaf. The established Plan authority
  reveals that context according to the editor's existing leaf rules rather than creating a
  competing floor identity.
- **6a** — No viewport has been remembered for the target floor. The editor fits that floor using
  the established framing behavior.

## Guarantee

Breadcrumbs, hierarchy navigation and the open editor all identify one current Project and Plan.
Switching context writes no domain hierarchy, carries no selection between floors, and never
replaces the current Project or Plan authorities with presentation state.

## Out of scope

- Persisting new Property, Building, Site or Floor entities or migrating Plan storage.
- Cross-floor overlays, floor alignment and three-dimensional building navigation.
- Portfolio navigation or aggregation across projects.
- Remembering viewport or selection across application restarts.

## Acceptance criteria

1. Context bar, Property tree/list and editor view state expose the same stable current Plan ID.
2. The MVP can present Property → Building → Floor context without adding persisted hierarchy.
3. Breadcrumb, pointer, tree-keyboard and list activation use one canonical floor-switch path.
4. Switching floors clears the prior floor's selection before the target Inspector is shown.
5. Returning to a floor restores that floor's in-session viewport; a first visit fits the floor.
6. Unreadable floors and absent hierarchy levels are not represented as empty valid floors.
7. Responsive presentation changes neither current context nor the underlying Project/Plan data.

## Assumptions

- `Project` remains the renovation root and owner of Plans.
- `Plan` remains the persisted implementation concept presented as **Floor** in MVP.
- A presentation-only Building grouping may be singular until consolidation approves a richer
  persisted hierarchy.
- Obsidian view state remains the authority for which Plan a leaf shows.

## Sources

- [M00 — Kitchen Selected Overview](../user-experience/renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md)
- [M01 — Standard Plan View](../user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md)
- [M05 — New Floor Start](../user-experience/renovation-planner-editor-specs/screens/M05-new-floor-start.md)
- [Editor component library: EditorContextBar and PropertyTree](../user-experience/renovation-planner-editor-specs/components/component-library.md)
- [Editor interaction specification: Property Navigation and Changing Floors](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20%E2%80%94%20Editor%20Interaction%20%26%20Mental%20Model%20Specification.md)
