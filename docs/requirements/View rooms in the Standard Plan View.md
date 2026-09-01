---
type: PBI
parent: "[[Editor foundation]]"
order: 30
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

# View rooms in the Standard Plan View

## Actor

[[Private renovator]] orienting themselves before making a change.

## Preconditions

- A floor is open in the editor shell.
- The read model can return its supported spatial records and unreadable count.
- No temporary creation task is active.

## Main flow

1. The editor loads all readable room-classified Zones for the floor.
2. It presents each as a **Room** with the same stable identity on the canvas and in the
   keyboard-accessible room list.
3. The canvas fits the floor to the available viewport.
4. With no selection, the Inspector presents truthful supported floor summary values and the
   room list.
5. The renovator can orient, navigate and choose a room without entering an editing mode.

## Extensions

- **1a** — No readable rooms exist. The floor's supported empty state remains distinct from an
  unavailable query or unreadable records.
- **1b** — Some records are unreadable. Readable rooms remain visible and an additive warning
  reports the refusal; totals do not pretend the missing records are absent.
- **3a** — No usable reference plan exists. Rooms still render; reference-plan guidance does not
  replace usable geometry.
- **4a** — A summary capability is unsupported. It is marked unavailable or omitted, never shown
  as a fabricated zero.
- **5a** — The user works without a pointer. Every visible room remains reachable from the list.

## Guarantee

The Standard Plan View shows only supported, successfully read floor facts, and every room it
shows resolves to the same stable ID through canvas, list and later Inspector routes.

## Out of scope

- Creating, editing or deleting room geometry.
- Persisting a new Room entity or renaming Zone storage.
- Full Property → Building → Floor hierarchy.
- Existing, Planned, Work, material, cost or evidence details.

## Acceptance criteria

1. A room-classified Zone appears as Room without changing its persisted ID or schema.
2. Canvas and room list contain the same readable room identities.
3. Opening a populated floor starts with no selection and a useful floor summary.
4. Unsupported values differ visibly and programmatically from supported zero values.
5. Unreadable records are not flattened into an empty floor.
6. Every canvas room can be reached and selected through a keyboard-accessible list.
7. The view is legible in default light and dark themes.

## Assumptions

- `Zone` with room classification is the first-release backing model for Room.
- Area and other geometric values are derived from sidecar geometry rather than duplicated in
  frontmatter.
- The first slice may omit aggregates for which no truthful query exists.

## Sources

- [M01 — Standard Plan View](../user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md)
- [M00 — Kitchen Selected Overview](../user-experience/renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md)
- [Vertical-slice plan: WP3 and WP4](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md)
- [Editor component library: PlanCanvas and FloorInspector](../user-experience/renovation-planner-editor-specs/components/component-library.md)
