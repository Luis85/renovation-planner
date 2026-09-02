# Renovation Planner — Editor Component Library

**Status:** Proposed shared component contract  
**Applies to:** M00–M17  
**Implementation target:** Vue 3 presentation layer inside Obsidian; Konva-backed canvas

## 1. Purpose

This library defines reusable user-interface components, their responsibilities, and their state boundaries. It is not a visual token library and does not create a standalone design system. Obsidian remains the host design system.

Components must:

- use homeowner language;
- inherit Obsidian semantic variables;
- remain usable in light, dark, and custom themes;
- keep domain/application commands outside presentational components;
- expose keyboard-accessible alternatives to canvas-only operations;
- treat every user input as one action through one command path.

## 2. Composition model

```text
ObsidianWorkspaceFrame (host-owned)
└─ ResponsiveEditorShell
   ├─ EditorContextBar
   ├─ PropertyLayerPanel / PanelRail
   ├─ PlanCanvas
   │  ├─ Domain geometry layers
   │  ├─ Semantic overlay layers
   │  └─ Interaction overlays
   ├─ EntityInspector / InspectorDrawer
   ├─ FloatingPrimaryActions / CreationToolBar
   └─ EditorStatusBar
```

## 3. Host and shell components

### `ResponsiveEditorShell`

**Responsibility:** Arrange context bar, panels, canvas, Inspector, warnings, and status based on available leaf width.

**Inputs:** layout mode, left-panel state, Inspector state, warning state.  
**Events:** panel open/close, request focus leaf.  
**States:** full, constrained, unsupported-editing width.  
**Used by:** all screens.

The shell owns layout only. It must not own project hydration, geometry commands, or entity selection.

### `EditorContextBar`

**Responsibility:** Show current property/building/floor, perspective switch, Undo, Redo, and View.

**Inputs:** breadcrumbs, active perspective, history availability, view-menu options.  
**Events:** change perspective, undo, redo, open view menu, navigate breadcrumb.  
**Used by:** all normal editor screens.

### `PerspectiveSwitch`

**Responsibility:** Switch Plan, Renovate, and Review while preserving compatible context.

**Inputs:** active perspective, availability, unresolved counts where appropriate.  
**Events:** `change(perspective)`.  
**Accessibility:** tablist or radiogroup semantics; arrow-key navigation; explicit active state.

### `PersistentWarningStrip`

**Responsibility:** Present persistent recoverable conditions above the canvas.

**Inputs:** severity, heading, body, actions, busy state.  
**Events:** retry/action.  
**Used by:** M15 and background/reference warnings.  
**Rule:** independent warnings must not suppress one another merely because they share a region.

## 4. Property and layer components

### `PropertyLayerPanel`

**Responsibility:** Container for Property hierarchy, Layers, and optional semantic legend.

**Inputs:** panel sections, current entity/floor, constrained state.  
**Events:** select hierarchy item, toggle/adjust layer.  
**Used by:** M00–M15, M17.

### `PropertyTree`

**Responsibility:** Navigate Property → Building → Floor/Site hierarchy.

**Inputs:** hierarchy read model, expanded IDs, selected ID.  
**Events:** expand/collapse, select, reveal context menu.  
**Accessibility:** tree semantics, arrow-key navigation, level labels.

### `LayerList`

**Responsibility:** Control presentation layers without confusing them with semantic Existing/Planned state.

**Inputs:** layer descriptors: name, visible, locked, opacity, status, count.  
**Events:** visibility, lock, opacity, select layer, configure.  
**Canonical layers:** Reference plan, Planned changes, Notes, Work markers, Material markers, Photo pins, Review markers.

### `ChangeLegend`

**Responsibility:** Explain Existing wall, Wall to remove, New wall/opening, and optional markers.

**Rule:** always pairs color with stroke pattern and plus/minus/numbered symbols.

### `PanelRail` and `OverlayPanel`

**Responsibility:** Constrained-width access to Property/Layers. Only one overlay panel opens at a time.

**Used by:** M16.

## 5. Canvas components

### `PlanCanvas`

**Responsibility:** Host the Konva stage, viewport, ordered layers, pointer routing, keyboard gestures, and overlays.

**Inputs:** render models, viewport, theme tokens, tool render state.  
**Events:** normalized pointer/keyboard intents only.  
**Rule:** It renders projections; it does not persist domain entities directly.

### Geometry shapes

| Component | Responsibility |
|---|---|
| `RoomShape` | Render room boundary/fill/label and selection target |
| `WallShape` | Render wall geometry and change semantics |
| `OpeningShape` | Render door/window/opening hosted by wall |
| `AreaShape` | Render non-room property or work area |
| `ReferenceImageLayer` | Render prepared image/PDF background |

All shapes receive render models and emit selection/interaction intents. They do not query repositories.

### `SelectionOverlay`

**Responsibility:** Render selection outline, handles, dimensions, and focus state for one entity.

**Inputs:** selected render model, handle metrics, editability, theme tokens.  
**Events:** begin/preview/commit transform, select handle, request dimension edit.

### `MultiSelectionOverlay`

**Responsibility:** Render multiple selected entities and stable numbered badges.

### `HoverOverlay`

**Responsibility:** Preview the entity that will be selected according to selection priority. Hover never changes data.

### `DimensionLabel` / `EditableDimensionLabel`

**Responsibility:** Show formatted dimensions and optionally enter exact values.

**Inputs:** normalized value, unit, editable, validation state.  
**Events:** begin edit, commit parsed value, cancel.  
**Rule:** direct manipulation and numeric entry converge on the same command.

### `SnapGuideLayer`

**Responsibility:** Render active alignment, endpoint, and angle guides from the snapping service.

### Semantic marker layers

| Component | Screen purpose |
|---|---|
| `WorkMarkerLayer` / `WorkMarker` | Ordered room work (M10) |
| `MaterialMarkerLayer` | Quantity source/relationship (M12) |
| `EvidencePinLayer` / `EvidencePin` | Documents/photos/notes (M14) |
| `ReviewMarkerLayer` / `ReviewMarker` | Readiness issues (M17) |
| `RoomSurfaceMarkers` | Existing/Planned room surfaces (M08/M09) |

Markers require a list equivalent and stable label/number within their view context.

## 6. Selection and direct-action components

### `FloatingPrimaryActions`

**Responsibility:** Keep Select and Add reachable without a permanent tool ribbon.

**Inputs:** active safe state, Add availability.  
**Events:** return to Select, open Add menu.

### `DirectActionPopover`

**Responsibility:** Show one or two high-frequency actions adjacent to a selection, such as Edit shape/Add detail or Edit length/Mark change.

**Rule:** Actions are duplicated in keyboard/Inspector routes; popover is a convenience, not the only path.

### `MultiSelectionActionBar`

**Responsibility:** Shared actions and selection count for M11.

## 7. Creation components

### `AddMenu`

Contains `AddMenuSearch`, `AddMenuGroup`, and `AddMenuItem`. It consumes a declarative creation catalog. Activation delegates to the canonical tool/command entry point.

### `TemporaryToolBanner`

**Responsibility:** Short task instruction and Esc/Enter hints during a temporary creation task.

### `CreationToolBar`

**Responsibility:** Current creation type, Undo point where applicable, Finish, Cancel, and repeated-creation option where applicable.

### `RoomCreationOverlay`

**Responsibility:** Draft rectangular/free-shape room preview, handles, and dimensions.

### `WallDrawingOverlay`

**Responsibility:** Draft connected segments, current segment, angle indicator, and close-loop detection.

### `RoomDetectedPrompt`

**Responsibility:** Offer room creation when a wall loop closes.

## 8. Inspector framework

### `EntityInspector`

**Responsibility:** Shared Inspector frame: entity identity, close/back behavior, contextual body, primary action.

**Inputs:** entity summary, breadcrumb, status, active child view.  
**Events:** close, back, primary action.  
**Variants:** Floor, Room, Wall, Multi-selection, Review.

### `InspectorDrawer`

Constrained-width presentation of the same Inspector content. It must reuse content components rather than fork them.

### `TransformationSummary`

**Responsibility:** Compact Existing → Work → Planned glanceable narrative.

**Rule:** Summary is not navigation when `HomeownerQuestionNav` is present; it avoids duplicated active destinations.

### `HomeownerQuestionNav`

Three primary rows:

- What's here — Existing
- What will change — Planned
- What needs doing — Work

### `SemanticStateSwitch`

Compact switch used inside a drilled-down entity state. It retains the selected entity and viewport.

### `LinkedContentList`

Rows for Materials, Costs, Documents, Photos, and Notes with counts and navigation.

### Inspector content components

| Component | Responsibility |
|---|---|
| `FloorInspector` | Floor summary and room list |
| `NewRoomInspector` | Draft room type/name/dimensions |
| `NewWallsInspector` | Wall defaults and room-close behavior |
| `WallInspector` | Wall measurements and transformation context |
| `ExistingRoomInspector` | Existing surfaces/items and condition |
| `PlannedRoomInspector` | Planned outcomes and unresolved decisions |
| `RoomWorkInspector` | Ordered work and dependencies |
| `MultiSelectionInspector` | Shared properties and batch actions |
| `MaterialsInspector` | Requirements, quantities, purchase state |
| `CostsInspector` | Planned/committed/actual aggregates |
| `EvidenceInspector` | Documents/photos/notes and metadata |
| `ReviewInspector` | Readiness, issues, and navigation |

## 9. Reusable content components

### Fields and values

- `Field`, `SelectField`, `UnitInput`, `MoneyInput`
- `CalculatedValue` and `CalculatedBadge`
- `ConditionSelect`
- `Toggle`, `OpacitySlider`

`CalculatedValue` must expose provenance and cannot masquerade as a manually editable stored value.

### Lists

- `RoomSummaryList`
- `ExistingDetailRow`, `PlannedDetailRow`
- `OrderedWorkList`, `WorkItemRow`, `DependencyBadge`
- `MaterialGroup`, `MaterialRow`, `QuantityCell`
- `CostGroup`, `CostBreakdownRow`, `CostTotals`
- `EvidenceTypeSwitch`, `EvidenceFilters`, `PhotoGrid`, `EvidenceMetadata`
- `ReadinessList`, `ReadinessStatus`, `IssueList`

### Feedback and dialogs

- `SaveStateIndicator`
- `EmptyState`
- `ViewFailure`
- `ImpactPreview`
- `ImpactConfirmationDialog`
- `DisabledActionReason`

## 10. Status bar components

### `EditorStatusBar`

Contains zoom, grid, snapping, scale, save state, and optional gesture hints.

### `CompactStatusBar`

Prioritizes zoom, snapping, scale, and save state at constrained widths. Lower-priority controls move into View.

### `SaveStateIndicator`

Canonical states:

- Saved
- Saving
- Unsaved changes
- Save failed
- Saved · refresh needed

## 11. Theme tokens

The existing theme-token adapter should resolve Obsidian variables into canvas-safe values. DOM components should consume CSS variables directly where possible.

Required semantic roles:

- primary/secondary background
- border and divider
- normal/muted/faint text
- interactive accent and hover
- focus ring
- warning/error/success surfaces and text
- canvas grid/reference opacity
- selection outline/fill
- existing/new/removed/modified stroke styles

No component may require a specific blue, coral, or purple accent. Mockup colors are examples of inherited user accent.

## 12. Component state rules

1. Selection state belongs to a shared selection store, not individual shapes.
2. Temporary tool state belongs to the editor runtime/tool manager.
3. Persisted domain data comes from query/read models and commands.
4. Panel visibility belongs to workspace UI state.
5. Draft form state remains local until committed.
6. Save and stale state are orthogonal to view/selection state.
7. Responsive layout must not reset domain, selection, or viewport state.

## 13. Current implementation reuse map

| Existing component/module | Direction |
|---|---|
| `PlanEditorRoot.vue` | Evolve into/compose `ResponsiveEditorShell`; retain hydration/failure ownership |
| `EditorToolbar.vue` | Refactor into `EditorContextBar` + floating/temporary action components |
| `LayersPanel.vue` | Evolve into `PropertyLayerPanel` and reusable `LayerList` |
| `InspectorPanel.vue` | Refactor into `EntityInspector` frame with routed content components |
| `StatusBar.vue` | Extend to full/compact status variants |
| `PlanCanvas.vue` | Retain as canvas host; add semantic/interaction overlay layers |
| `ZoneLayer.vue` / `ZoneShape.vue` | Keep internal zone render model where useful; expose Room/Area variants in presentation |
| selection store | Extend to typed single/multi-selection |
| tool manager | Retain temporary tool lifecycle; make Select the explicit safe default |
| draw-polygon tool | Reuse internally behind Room/Area user-facing creation flows |
| calibrate tool / known-distance form | Move entry point into Reference Plan Setup |
| theme token adapter | Expand semantic roles and theme-change verification |
| save-state store/indicator | Add stale/read-back distinction already supported by root state |

## 14. Component acceptance criteria

- No shared component directly imports repository implementations.
- No shape component performs persistence.
- Components render under default light/dark and arbitrary accent colors.
- Every canvas-only affordance has an accessible non-canvas route.
- Shared Inspector and responsive variants reuse the same content components.
- User-facing component names and strings contain no internal geometry vocabulary.

