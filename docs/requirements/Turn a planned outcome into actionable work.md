---
type: PBI
parent: "[[Renovation semantics]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn:
  - "[[Link planned outcomes to canonical work]]"
  - "[[Create a task from context]]"
  - "[[Construction sections]]"
  - "[[Work package creation and scope]]"
  - "[[Dependencies]]"
---

# Turn a planned outcome into actionable work

## Actor

[[Private renovator]], after defining an intended result for a selected room.

## Main flow

1. The renovator opens **What needs doing** from a planned outcome.
2. The editor shows canonical [[Task]], [[Construction section]] and [[Work package]] records
   already linked to that outcome and spatial target.
3. The renovator chooses the canonical record appropriate to the scope, or creates one through
   its authority-owned workflow.
4. The created record links to the planned outcome and the selected room or object by stable
   identity; it stores no geometry.
5. Order, responsibility, status, progress and dependencies are read from their existing
   authorities.
6. Selecting a spatial marker focuses the canonical record, and selecting the record focuses its
   spatial target.

## Extensions

- **2a** — No canonical work capability is available. The section says work is unavailable; it
  does not report zero work and does not create a generic substitute.
- **3a** — The scope is a concrete checkbox-sized action. The existing create-task-from-context
  flow creates an ordinary Obsidian-compatible Task.
- **3b** — The scope is work to award or plan for one trade. The canonical Work Package flow is
  used.
- **3c** — The scope groups related measures for prioritising, budgeting or scheduling. The
  canonical Construction Section flow is used.
- **4a** — The selected outcome or target changed before commit. Creation is refused and the
  renovator is returned to the current context.
- **5a** — A dependency would violate the canonical pair rules or create a cycle. The authority
  refuses it; the spatial editor does not invent a second dependency rule.
- **6a** — A linked record cannot be read. Its marker/list entry reports the refusal rather than
  treating the record as deleted.

## Guarantee

The spatial editor creates and navigates only canonical Tasks, Construction Sections and Work
Packages. Every spatial scope is a reference to stable identity, never copied geometry, and no
generic WorkItem or editor-private dependency model is introduced.

## Out of scope

- Owning Task lifecycle, checkbox semantics or dates.
- Owning Construction Section, Work Package, Trade, progress or dependency rules.
- A whole-project scheduling board inside the room Inspector.
- Material, procurement or cost workflows except authority-owned summaries.

## Acceptance criteria

1. The work view displays canonical records and creates none when their capability is unavailable.
2. A newly created Task remains an ordinary Markdown task compatible with the vault's task
   tooling.
3. A Work Package or Construction Section references the selected spatial target without storing
   its geometry.
4. Each created record can identify the planned outcome it helps produce.
5. Dependency validation and blocked state agree with [[Dependencies]] and do not have an
   editor-specific representation.
6. Marker-to-list and list-to-marker selection are bidirectional and keyboard-accessible.
7. The Inspector remains scoped to the selected room while broader schedule navigation opens the
   authority-owned view.

## Assumptions

1. The work-record choice is explicit because Task, Construction Section and Work Package are
   different canonical scopes, not variants of one generic entity.
2. Stable links can target a planned outcome and a spatial identity without either owning the
   other.
3. Ordered marker numbers are view projections and are not persisted as work identity.

## Sources

M09 Planned Room Details; M10 Room Work; M17 Review Perspective; the mental-model specification
§§1–2, 6, 30, 39, 55, 73 and 81; UX research §§5, 13, 15–16, 20, 23 and 28; the component
library §§5, 8–9 and 12; implementation-plan Phase 8 and Increment C; first vertical-slice plan
§§5.1, 5.6 and 15.
