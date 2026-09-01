---
type: PBI
parent: "[[Editor foundation]]"
order: 40
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

# Canvas navigation

## Actor

[[Private renovator]] moving around a floor plan while inspecting or editing it.

## Preconditions

- A floor projection is visible.
- The canvas has focus for keyboard gestures.
- The viewport has a valid scale and transform.

## Main flow

1. The renovator pans with Space+drag, middle-button drag or a trackpad gesture without leaving
   the current selection or temporary task.
2. Wheel or pinch zooms around the pointer.
3. Fit floor or the approved keyboard shortcut frames the current floor.
4. Fit selection frames the current selection when one exists.
5. The status region reports the current zoom and applicable gesture hints.

## Extensions

- **1a** — Another pointer or button arrives during a gesture. It cannot steal ownership or send
  an unmatched press/release to the active task.
- **1b** — Focus is lost or the pointer is cancelled. The active gesture is abandoned safely;
  accumulated multi-click work unrelated to that gesture is retained.
- **2a** — A geometry drag is in flight. Camera changes are refused so screen/world conversion
  cannot corrupt the pending edit.
- **3a** — The floor has degenerate or incomplete bounds. Framing preserves a valid current zoom
  and shows whatever geometry can be bounded.
- **4a** — Nothing is selected. Fit selection is unavailable with an explanation.
- **5a** — Reduced motion is requested. Navigation remains direct and does not require animation.

## Guarantee

Navigation changes only the ephemeral viewport. It never writes to the vault, changes selection,
discards an unrelated creation buffer or alters the world coordinates of spatial records.

## Out of scope

- Grid and snapping behavior.
- Geometry creation or manipulation commands.
- Persisting viewport state across sessions.
- Mobile-specific editing gestures.

## Acceptance criteria

1. Space+drag and middle-button drag pan while any tool is active without switching tools.
2. Wheel/pinch zooms around the pointer; horizontal trackpad intent pans.
3. Keyboard fit-floor and fit-selection use layout-independent physical key codes.
4. Foreign pointers and chorded mouse buttons cannot steal or strand a gesture.
5. Focus loss and pointer cancellation leave the editor ready for the next interaction.
6. Camera movement is blocked during a geometry drag that would otherwise be corrupted.
7. Pan, zoom and framing perform no vault write and preserve stable world geometry.

## Assumptions

- Pan and zoom are navigation gestures, not persistent primary tools.
- The established viewport and pointer-routing services remain the implementation foundation.
- Performance targets are measured against representative plans during release hardening.

## Sources

- [M00 — Kitchen Selected Overview](../user-experience/renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md)
- [M01 — Standard Plan View](../user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md)
- [M16 — Constrained Workspace](../user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md)
- [Editor implementation plan: Canvas tests](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md)
