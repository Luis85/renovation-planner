---
type: PBI
parent: "[[Editor foundation]]"
order: 70
status: Active
started: 2026-09-02
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

# Inspect a selected room

## Actor

[[Private renovator]] trying to understand one room in the context of its floor.

## Preconditions

- One readable room is selected by stable ID.
- A Room overview query can return supported current values and capability availability.

## Main flow

1. The contextual Inspector opens for the selected Room.
2. It shows the Room's name, room classification, floor context and area derived from current
   geometry.
3. It exposes only linked values the current read model can supply truthfully.
4. It marks future Existing, Planned, Work, Materials, Costs and Evidence sections unavailable
   where their backing capability does not exist.
5. The renovator can return focus to the room, select a supported action or clear selection
   without losing the viewport.

## Extensions

- **2a** — Geometry or required metadata is unreadable. The Inspector shows the routed failure
  or stale state rather than a partial value presented as current.
- **3a** — A supported linked collection contains no records. It shows a truthful empty state,
  distinct from unavailable capability.
- **4a** — A later Feature supplies one section. That section becomes available without changing
  the selected ID or inventing values for its siblings.
- **5a** — The leaf is constrained. The same content appears in the Inspector drawer and focus
  returns meaningfully when it closes.
- **5b** — The selected room disappears after a vault change. The Inspector retires the
  selection and reports the loss without choosing another room by name.

## Guarantee

The Inspector describes the currently selected stable Room identity using only supported,
successfully read information; unavailable, empty and failed are three different states.

## Out of scope

- Editing Existing, Planned, Work, material, cost or evidence records.
- Full room-geometry creation or manipulation.
- New Room persistence or schema fields.
- Whole-project dashboards and schedule views.

## Acceptance criteria

1. The Room heading, canvas selection and Inspector DTO share one stable ID.
2. Area is derived from geometry and is not presented as manually stored metadata.
3. Supported empty sections differ from unsupported sections.
4. Failed or stale reads never appear as successful zero values.
5. Clearing selection restores the floor summary.
6. Inspector drill-down and constrained presentation preserve selection and viewport.
7. The Inspector is keyboard reachable and does not trap focus.

## Assumptions

- `RoomOverviewDto` adapts current Zone and Plan queries until consolidation approves otherwise.
- Unavailable sections are acceptable in Increment A; fabricated completeness is not.
- Feature A owns the Inspector workflow and frame, while later Features own their domain content.

## Sources

- [M00 — Kitchen Selected Overview](../user-experience/renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md)
- [M01 — Standard Plan View](../user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md)
- [M16 — Constrained Workspace](../user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md)
- [Vertical-slice plan: Inspector honesty rule and WP6](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md)

## Amendments

**2026-09-03** — advanced, not closed, by the plan editor foundation's first increment.

Met: criterion 1 is `tests/presentation/editor/shell/roomInspector.test.ts`'s 'heading, canvas
selection and Inspector share one id; the type and floor are homeowner words'; criterion 2 is
`tests/presentation/read-models/spatialRecords.test.ts`'s 'derives area from the points rather than
reading a stored figure' — the figure is computed from sidecar geometry at read time and is stored
in no frontmatter key; criterion 3 is the seven unavailable rows drawn with no count and no
control beside the Requirements panel keeping its own empty state; criterion 5 is
`tests/presentation/editor/shell/floorInspector.test.ts`; criterion 6's constrained half is
`tests/harness/accessibility.test.ts`'s drawer-with-a-selection scan and
`tests/presentation/editor/shell/responsiveShell.test.ts`'s element-identity assertion;
criterion 7 is that same scan plus the room name being an `<h3>` under the frame's `<h2>`, a
heading-order decision stated in `RoomInspector.vue`'s docblock rather than left to chance.

Remains:

- **`TransformationSummary` and every available route.**
  [[Assemble shared homeowner-question Inspector navigation]] shipped the ROWS, all seven
  unavailable, which is what makes an unbuilt section a stated absence rather than an empty one.
  Nothing navigates, so nothing preserves a stable id or a viewport through a route, and no child
  view opens for focus to return from.
- **Criterion 4 is half met: nothing is disabled while stale.** Stale content IS labelled, by the
  additive warning strip; `stale` reaches exactly one computed in `PlanEditorRoot.vue` and feeds
  that strip alone, so Delete stays live over data the last read-back could not confirm. Recorded
  at [[Preserve room inspection across layout and read changes]].
- **The resize-driven drawer close leaves focus on `<body>`**, the same residue Layers records.
- [[The cross-surface identity test starts after selection]]
- [[The Inspector's two unavailable lists are separate navigation models]]
