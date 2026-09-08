# First usable editor release: screen and interaction audit

Baseline: `7d4bc381` (origin/main inspected 2026-09-08). This is a new release work record, separate from PR #93's historical closeout. Earlier completion-matrix, implementation-status and RESUME entries identify evidence and accepted boundaries; their dated open-work prose is not a fresh missing-feature inventory.

## Actionable plan

1. Read README, M00–M17 prose and all eighteen source images, component library, implementation plan/matrix/status/RESUME, SDD and ADR-0019–0024 amendments. **Done:** all source images inspected with `view_image`; Product Design audit preflight found no saved user context.
2. Record every primary use case, interaction and acceptance criterion against its production entry point. Classify independently as **implemented and verified**, **implemented but unverified**, **missing**, **defective**, or **explicitly accepted boundary**. Verification must name its revision/environment; historical test names alone are not current verification.
3. Capture the actual matching editor states, inspect screenshots beside references and investigate concrete discrepancies. Retain the shipped eleven Add routes, shared Inspector, commands and semantic theme variables. The fidelity contributor owns only evidenced nonrotation presentation/harness corrections; selection/precision and Object rotation have separate topic branches.
4. Implement each confirmed discrepancy, run its targeted verification and commit source/harness before final capture. Do not substitute placeholder counts, fixtures or reconstructed UI for production read models.
5. Parent integrates stable commits and serializes the unchanged `npm run check` and `editor-visual-final-check.mjs` (all nine journeys, all eighteen comparisons). Parent owns actual Obsidian H1–H6, physical-device and screen-reader evidence; browser screenshots/axe cannot close those observations.

Dependencies: selection branch corrects Object → Opening → Wall resolution and explicit Room-dimension input; rotation branch adds single-free-Object rotation with existing geometry/history. PR #93 remains externally owned and unchanged.

## Interpretation and acceptance boundaries

- SDD architecture remains layered: the vault is canonical; shapes and Vue render projections and emit intents. No second runtime, persistence service or hierarchy migration.
- ADR-0016/ADR-RK: Room names and existing Zone identity remain canonical; stored room kinds require their accepted future query trigger. M03's kind selector is therefore a naming suggestion, not a new persisted type.
- SDD §26: arbitrary polygon self-intersection repair/winding normalization remain accepted deferrals. Numeric outline editing is already available.
- ADR-0019: reference setup is a root-owned explicit task; unlock permits configuration, not direct reference dragging. No durable cross-file crash journal.
- ADR-0020: straight explicit wall junctions; independent Room outlines, previewed host impacts and optional explicitly closed-loop Room creation. No implicit intersections or automatic boundary synchronization.
- ADR-0021–0022: Existing and Planned stay independent; Review covers named deterministic checks and does not assert building compliance. Purchased/reserved are exclusive local allocations. Remaining = planned − actual − open commitments. Evidence remains ordinary files, dates are explicit and unknown dates remain absent.
- ADR-0023–0024: generic world-point elements preserve IDs/current-versus-intended facts; dates/Trades and quote comparison already exist. Comparison aligns explicit scope, does not infer equivalence, rank offers, convert currency or create orders.

## Evidence policy

The rows below initially use **implemented but unverified** where source and existing test entry points are present at `7d4bc381`. This means fresh integrated acceptance is pending, not that the feature must be rebuilt. Accepted-boundary rows are scoped exceptions, not whole-screen waivers. Source revision is `7d4bc381` unless a row or the current-run observations below names a later revision.

Each screen table expands the exact source use cases (UC), interactions (I) and acceptance criteria (AC). Source links resolve to the corresponding screen and heading. The remaining acceptance for unverified rows is to exercise the stated outcome on the integrated revision, inspect the matching state in light/dark/custom accent/German constrained layout as applicable, and perform the relevant H1–H6 observation. Parent owns that final integrated gate; fidelity owns concrete presentation defects discovered before it.

## Current-run observations

Source-image review is complete. Current product screenshots and targeted verification will be recorded here before claiming visual acceptance.

## M00 — Kitchen Selected Overview

Production entry points: `src/presentation/editor/shell/RoomInspector.vue`; `src/presentation/editor/renovation/RoomRenovationDetails.vue`; `src/presentation/editor/layers/InteractionLayer.vue`. Evidence/source revision: `7d4bc381`. Owner: fidelity for presentation; parent for final integrated/host acceptance. Dependencies: existing production commands plus selection/rotation integration where applicable.

| Source requirement | Classification | Remaining action / acceptance |
|---|---|---|
| [M00-UC1](../screens/M00-kitchen-selected-overview.md#primary-use-cases): Understand the Kitchen's renovation status at a glance. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-UC2](../screens/M00-kitchen-selected-overview.md#primary-use-cases): Move from the spatial room to Existing, Planned, Work, Materials, Costs, Documents, Photos, or Notes. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-UC3](../screens/M00-kitchen-selected-overview.md#primary-use-cases): Adjust the Kitchen shape using direct manipulation. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-UC4](../screens/M00-kitchen-selected-overview.md#primary-use-cases): Add a contextual renovation detail already linked to the Kitchen. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-UC5](../screens/M00-kitchen-selected-overview.md#primary-use-cases): Compare the current state, required transformation, and intended result. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-I1](../screens/M00-kitchen-selected-overview.md#interactions): Click Kitchen → Select Kitchen and open its Inspector | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-I2](../screens/M00-kitchen-selected-overview.md#interactions): Click empty canvas → Clear selection and return to M01 | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-I3](../screens/M00-kitchen-selected-overview.md#interactions): Drag selected boundary/handle → Preview geometry change with snapping; commit on release | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-I4](../screens/M00-kitchen-selected-overview.md#interactions): Click a displayed dimension → Replace label with numeric entry; Enter commits; Esc cancels | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-I5](../screens/M00-kitchen-selected-overview.md#interactions): Click `Edit shape` → Enter a temporary geometry-edit substate | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-I6](../screens/M00-kitchen-selected-overview.md#interactions): Click `Add detail` → Open a contextual Add menu pre-linked to Kitchen | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-I7](../screens/M00-kitchen-selected-overview.md#interactions): Click `What's here` → Open M08 | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-I8](../screens/M00-kitchen-selected-overview.md#interactions): Click `What will change` → Open M09 | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-I9](../screens/M00-kitchen-selected-overview.md#interactions): Click `What needs doing` → Open M10 | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-I10](../screens/M00-kitchen-selected-overview.md#interactions): Click Materials/Costs/Photos → Open M12/M13/M14 without changing selection | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-I11](../screens/M00-kitchen-selected-overview.md#interactions): Press Esc → Cancel temporary action; otherwise clear selection | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-I12](../screens/M00-kitchen-selected-overview.md#interactions): Delete/Backspace → Open a confirmation only when deletion is valid and focus is not in a field | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-AC1](../screens/M00-kitchen-selected-overview.md#acceptance-criteria): Selecting Kitchen exposes Kitchen-specific project information without navigating away from the plan. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-AC2](../screens/M00-kitchen-selected-overview.md#acceptance-criteria): Clearing selection restores the Ground Floor summary. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-AC3](../screens/M00-kitchen-selected-overview.md#acceptance-criteria): Editing geometry updates calculated area and dependent quantities through one command path. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-AC4](../screens/M00-kitchen-selected-overview.md#acceptance-criteria): Inspector drill-down preserves Kitchen selection and canvas viewport. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M00-AC5](../screens/M00-kitchen-selected-overview.md#acceptance-criteria): The screen is legible in Obsidian default light and dark themes and under a custom accent color. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |

## M01 — Standard Plan View

Production entry points: `src/presentation/editor/shell/FloorInspector.vue`; `src/presentation/editor/shell/RoomSummaryList.vue`; `src/presentation/editor/selection/resolveSelectionTarget.ts`. Evidence/source revision: `7d4bc381`. Owner: fidelity for presentation; parent for final integrated/host acceptance. Dependencies: existing production commands plus selection/rotation integration where applicable.

| Source requirement | Classification | Remaining action / acceptance |
|---|---|---|
| [M01-UC1](../screens/M01-standard-plan-view.md#primary-use-cases): Orient within the property and floor. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M01-UC2](../screens/M01-standard-plan-view.md#primary-use-cases): Inspect the overall floor without editing. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M01-UC3](../screens/M01-standard-plan-view.md#primary-use-cases): Select a room, wall, opening, object, or marker. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M01-UC4](../screens/M01-standard-plan-view.md#primary-use-cases): Start adding something through the single Add entry point. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M01-UC5](../screens/M01-standard-plan-view.md#primary-use-cases): Toggle layers and reference-plan visibility. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M01-I1](../screens/M01-standard-plan-view.md#interactions): Click/keyboard-select an entity → Select it and open the matching Inspector | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M01-I2](../screens/M01-standard-plan-view.md#interactions): Hover entity → Show a subtle preview outline and appropriate cursor | defective | Selection owner: correct shared Object → Opening → Wall priority, retain handles/badges/Alt-cycle; overlap regression and integrated capture. |
| [M01-I3](../screens/M01-standard-plan-view.md#interactions): Click `+ Add` → Open M02 | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M01-I4](../screens/M01-standard-plan-view.md#interactions): Choose a room in Inspector list → Select and fit/center that room, then open M00 | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M01-I5](../screens/M01-standard-plan-view.md#interactions): Toggle layer visibility → Update canvas projection without changing domain data | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M01-I6](../screens/M01-standard-plan-view.md#interactions): Click reference-plan lock → Require explicit unlock confirmation before editing its placement | explicitly accepted boundary | ADR-0019: explicit setup unlock acknowledgement; placement is changed through configuration. |
| [M01-I7](../screens/M01-standard-plan-view.md#interactions): Space+drag / middle drag → Pan | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M01-I8](../screens/M01-standard-plan-view.md#interactions): Wheel/pinch → Zoom around pointer | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M01-I9](../screens/M01-standard-plan-view.md#interactions): Press F or `Fit floor` → Fit the current floor | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M01-AC1](../screens/M01-standard-plan-view.md#acceptance-criteria): Opening a populated floor starts in Select with no persistent Pan mode. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M01-AC2](../screens/M01-standard-plan-view.md#acceptance-criteria): No selection displays useful floor context rather than an empty Inspector. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M01-AC3](../screens/M01-standard-plan-view.md#acceptance-criteria): All visible entities can be reached through a keyboard-accessible alternative. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M01-AC4](../screens/M01-standard-plan-view.md#acceptance-criteria): The Add entry point is visible without exposing the full creation catalog. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |

## M02 — Add Menu

Production entry points: `src/presentation/editor/add/AddMenu.vue`; `src/presentation/editor/add/creationCatalogue.ts`; `src/presentation/editor/add/noteCreation.ts`. Evidence/source revision: `7d4bc381`. Owner: fidelity for presentation; parent for final integrated/host acceptance. Dependencies: existing production commands plus selection/rotation integration where applicable.

| Source requirement | Classification | Remaining action / acceptance |
|---|---|---|
| [M02-UC1](../screens/M02-add-menu.md#primary-use-cases): Add a room using the fastest beginner path. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M02-UC2](../screens/M02-add-menu.md#primary-use-cases): Draw walls for a precise or irregular layout. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M02-UC3](../screens/M02-add-menu.md#primary-use-cases): Add doors, windows, property areas, paths, fences, items, measurements, or notes. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M02-UC4](../screens/M02-add-menu.md#primary-use-cases): Search the catalog when it becomes too large to scan. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M02-I1](../screens/M02-add-menu.md#interactions): Activate Add → Open anchored menu and focus the first recommended item | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M02-I2](../screens/M02-add-menu.md#interactions): Arrow keys → Move between menu items | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M02-I3](../screens/M02-add-menu.md#interactions): Type in search → Filter by localized label and synonym | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M02-I4](../screens/M02-add-menu.md#interactions): Select Room → Close menu and enter M03 | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M02-I5](../screens/M02-add-menu.md#interactions): Select Wall → Close menu and enter M04 | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M02-I6](../screens/M02-add-menu.md#interactions): Select context-dependent item → Start its temporary creation state, optionally pre-linked to current selection | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M02-I7](../screens/M02-add-menu.md#interactions): Click outside / Esc → Close menu and restore Add focus; preserve an existing draft/tool until the next cancel action | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M02-AC1](../screens/M02-add-menu.md#acceptance-criteria): The menu contains no internal terms such as Zone or Polygon. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M02-AC2](../screens/M02-add-menu.md#acceptance-criteria): Esc always closes it without changing data. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M02-AC3](../screens/M02-add-menu.md#acceptance-criteria): Choosing an item invokes exactly one creation path. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M02-AC4](../screens/M02-add-menu.md#acceptance-criteria): The catalog remains usable by keyboard and in both themes. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |

## M03 — Add Room

Production entry points: `src/presentation/editor/shell/NewRoomInspector.vue`; `src/presentation/editor/resize/RoomDimensionsForm.vue`; `src/presentation/editor/resize/roomDimensions.ts`. Evidence/source revision: `7d4bc381`. Owner: fidelity for presentation; parent for final integrated/host acceptance. Dependencies: existing production commands plus selection/rotation integration where applicable.

| Source requirement | Classification | Remaining action / acceptance |
|---|---|---|
| [M03-UC1](../screens/M03-add-room.md#primary-use-cases): Create a roughly sized room quickly. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M03-UC2](../screens/M03-add-room.md#primary-use-cases): Enter exact width/depth when known. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M03-UC3](../screens/M03-add-room.md#primary-use-cases): Choose a common room type and name. | explicitly accepted boundary | ADR-RK: localized naming suggestions; no stored Room-kind field until its query trigger. |
| [M03-UC4](../screens/M03-add-room.md#primary-use-cases): Continue adding rooms deliberately. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M03-I1](../screens/M03-add-room.md#interactions): Pointer down + drag → Preview rectangular room and live dimensions | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M03-I2](../screens/M03-add-room.md#interactions): Snap near wall/guide → Align preview and announce snapped relation | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M03-I3](../screens/M03-add-room.md#interactions): Click dimension → Focus numeric entry; Enter applies preview value | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M03-I4](../screens/M03-add-room.md#interactions): Choose room type → Set semantic type; suggest a default localized name | explicitly accepted boundary | ADR-RK: localized naming suggestions; no stored Room-kind field until its query trigger. |
| [M03-I5](../screens/M03-add-room.md#interactions): Click `Create room` / Finish → Validate, execute one reversible create command, select new room, return to Select | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M03-I6](../screens/M03-add-room.md#interactions): Toggle `Keep adding rooms` → Return to room tool after creation instead of Select | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M03-I7](../screens/M03-add-room.md#interactions): Esc / Cancel → Discard preview with no write | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M03-AC1](../screens/M03-add-room.md#acceptance-criteria): The user can complete room creation without understanding wall drawing. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M03-AC2](../screens/M03-add-room.md#acceptance-criteria): Direct drag and exact numeric entry produce the same domain command. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M03-AC3](../screens/M03-add-room.md#acceptance-criteria): Cancellation writes nothing. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M03-AC4](../screens/M03-add-room.md#acceptance-criteria): Creation returns to Select by default. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |

## M04 — Draw Walls

Production entry points: `src/presentation/editor/structure/StructureTaskForm.vue`; `src/presentation/editor/structure/StructureTool.ts`. Evidence/source revision: `7d4bc381`. Owner: fidelity for presentation; parent for final integrated/host acceptance. Dependencies: existing production commands plus selection/rotation integration where applicable.

| Source requirement | Classification | Remaining action / acceptance |
|---|---|---|
| [M04-UC1](../screens/M04-draw-walls.md#primary-use-cases): Draw connected walls from known dimensions. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M04-UC2](../screens/M04-draw-walls.md#primary-use-cases): Trace a locked reference plan. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M04-UC3](../screens/M04-draw-walls.md#primary-use-cases): Close a wall loop and create a room. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M04-UC4](../screens/M04-draw-walls.md#primary-use-cases): Undo the most recent point without leaving the task. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M04-I1](../screens/M04-draw-walls.md#interactions): Click canvas → Set first wall point | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M04-I2](../screens/M04-draw-walls.md#interactions): Move pointer → Preview next segment, length, angle, and snap candidates | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M04-I3](../screens/M04-draw-walls.md#interactions): Click again → Commit preview segment to the draft chain | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M04-I4](../screens/M04-draw-walls.md#interactions): Type while dimension focused → Set exact current segment length | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M04-I5](../screens/M04-draw-walls.md#interactions): `Undo point` / Backspace in tool → Remove the last draft segment only | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M04-I6](../screens/M04-draw-walls.md#interactions): Close near start → Detect closed boundary and offer/create Room | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M04-I7](../screens/M04-draw-walls.md#interactions): Enter / Finish → Commit valid connected walls as one undoable transaction | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M04-I8](../screens/M04-draw-walls.md#interactions): Esc / Cancel → Discard entire uncommitted chain | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M04-AC1](../screens/M04-draw-walls.md#acceptance-criteria): Draft segments are not persisted until Finish. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M04-AC2](../screens/M04-draw-walls.md#acceptance-criteria): Enter completes a valid chain; Esc safely cancels. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M04-AC3](../screens/M04-draw-walls.md#acceptance-criteria): Closing walls can create a Room through the same transaction. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M04-AC4](../screens/M04-draw-walls.md#acceptance-criteria): The workflow is usable over a dimmed reference plan in both themes. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |

## M05 — New Floor Start

Production entry points: `src/presentation/editor/reference/FloorStart.vue`; `src/presentation/editor/shell/FloorInspector.vue`. Evidence/source revision: `7d4bc381`. Owner: fidelity for presentation; parent for final integrated/host acceptance. Dependencies: existing production commands plus selection/rotation integration where applicable.

| Source requirement | Classification | Remaining action / acceptance |
|---|---|---|
| [M05-UC1](../screens/M05-new-floor-start.md#primary-use-cases): Start by adding rooms. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M05-UC2](../screens/M05-new-floor-start.md#primary-use-cases): Upload an image or PDF floor plan. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M05-UC3](../screens/M05-new-floor-start.md#primary-use-cases): Start empty and draw walls/areas manually. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M05-UC4](../screens/M05-new-floor-start.md#primary-use-cases): Edit basic floor metadata. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M05-I1](../screens/M05-new-floor-start.md#interactions): Select `Add rooms` → Enter M03 | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M05-I2](../screens/M05-new-floor-start.md#interactions): Select `Upload a floor plan` → Open file picker, then M06 | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M05-I3](../screens/M05-new-floor-start.md#interactions): Select `Start empty` → Dismiss onboarding and open M01 with Add available | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M05-I4](../screens/M05-new-floor-start.md#interactions): Activate `No reference plan → Add` → Same upload path as above | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M05-I5](../screens/M05-new-floor-start.md#interactions): Edit floor name/level → Validate and persist through floor command | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M05-AC1](../screens/M05-new-floor-start.md#acceptance-criteria): The user sees three understandable ways to start. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M05-AC2](../screens/M05-new-floor-start.md#acceptance-criteria): No path requires a floor plan. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M05-AC3](../screens/M05-new-floor-start.md#acceptance-criteria): Selecting an option leads into the canonical existing command/tool path. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M05-AC4](../screens/M05-new-floor-start.md#acceptance-criteria): Empty state disappears while a temporary creation task is active. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |

## M06 — Reference Plan Setup

Production entry points: . Evidence/source revision: `7d4bc381`. Owner: fidelity for presentation; parent for final integrated/host acceptance. Dependencies: existing production commands plus selection/rotation integration where applicable.

| Source requirement | Classification | Remaining action / acceptance |
|---|---|---|
| [M06-UC1](../screens/M06-reference-plan-setup.md#primary-use-cases): Crop/rotate the imported plan. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M06-UC2](../screens/M06-reference-plan-setup.md#primary-use-cases): Set scale from one known distance. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M06-UC3](../screens/M06-reference-plan-setup.md#primary-use-cases): Review opacity, lock state, and calculated scale. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M06-UC4](../screens/M06-reference-plan-setup.md#primary-use-cases): Retry or replace an unreadable source. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M06-I1](../screens/M06-reference-plan-setup.md#interactions): Draw measurement line → Set two image-space endpoints | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M06-I2](../screens/M06-reference-plan-setup.md#interactions): Enter known length → Calculate scale preview using project units | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M06-I3](../screens/M06-reference-plan-setup.md#interactions): `Choose another distance` → Clear calibration draft but retain prepared source | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M06-I4](../screens/M06-reference-plan-setup.md#interactions): Change opacity → Preview immediately; persist on final confirmation | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M06-I5](../screens/M06-reference-plan-setup.md#interactions): Toggle Locked → Default on; show consequences before allowing off | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M06-I6](../screens/M06-reference-plan-setup.md#interactions): `Apply scale` → Validate and advance to Review | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M06-I7](../screens/M06-reference-plan-setup.md#interactions): Finish setup → Persist reference metadata and layer configuration as one transaction | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M06-I8](../screens/M06-reference-plan-setup.md#interactions): Cancel setup → Restore prior reference state, if any | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M06-AC1](../screens/M06-reference-plan-setup.md#acceptance-criteria): Calibration is only exposed inside reference-plan context. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M06-AC2](../screens/M06-reference-plan-setup.md#acceptance-criteria): Applying scale produces a deterministic unit conversion. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M06-AC3](../screens/M06-reference-plan-setup.md#acceptance-criteria): Cancel restores the previous committed reference plan. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M06-AC4](../screens/M06-reference-plan-setup.md#acceptance-criteria): Completed references default to visible and locked. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |

## M07 — Wall Selected

Production entry points: `src/presentation/editor/structure/StructureInspector.vue`; `src/presentation/editor/selection/resolveSelectionTarget.ts`. Evidence/source revision: `7d4bc381`. Owner: fidelity for presentation; parent for final integrated/host acceptance. Dependencies: existing production commands plus selection/rotation integration where applicable.

| Source requirement | Classification | Remaining action / acceptance |
|---|---|---|
| [M07-UC1](../screens/M07-wall-selected.md#primary-use-cases): Inspect wall length, height, thickness, and adjacent rooms. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M07-UC2](../screens/M07-wall-selected.md#primary-use-cases): Describe its current construction/finish. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M07-UC3](../screens/M07-wall-selected.md#primary-use-cases): Mark it for removal, modification, or a new opening. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M07-UC4](../screens/M07-wall-selected.md#primary-use-cases): Connect work, materials, cost, evidence, and notes to the wall. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M07-UC5](../screens/M07-wall-selected.md#primary-use-cases): Enter an exact length when geometry allows it. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M07-I1](../screens/M07-wall-selected.md#interactions): Select wall → Highlight wall and endpoints; open Wall Inspector | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M07-I2](../screens/M07-wall-selected.md#interactions): Click displayed length → Enter exact length; preview affected geometry before commit | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M07-I3](../screens/M07-wall-selected.md#interactions): `Edit length` → Focus numeric length editor | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M07-I4](../screens/M07-wall-selected.md#interactions): `Mark change` → Choose Unchanged, Remove, Modify, or Add where semantically valid | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M07-I5](../screens/M07-wall-selected.md#interactions): Select homeowner question → Drill into Existing, Planned, or Work for this wall | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M07-I6](../screens/M07-wall-selected.md#interactions): Select linked-content row → Open related collection while preserving wall selection | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M07-I7](../screens/M07-wall-selected.md#interactions): More → Delete → Open destructive confirmation describing affected rooms/openings/references | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M07-AC1](../screens/M07-wall-selected.md#acceptance-criteria): Selecting a wall never selects an overlapping room accidentally without predictable cycling/priority. | defective | Selection owner: correct shared Object → Opening → Wall priority, retain handles/badges/Alt-cycle; overlap regression and integrated capture. |
| [M07-AC2](../screens/M07-wall-selected.md#acceptance-criteria): Numeric edits use the same reversible command path as direct manipulation. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M07-AC3](../screens/M07-wall-selected.md#acceptance-criteria): Deletion cannot silently orphan hosted openings or linked records. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M07-AC4](../screens/M07-wall-selected.md#acceptance-criteria): Inspector content is wall-specific and retains adjacent-room context. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |

## M08 — Existing Room Details

Production entry points: `src/presentation/editor/renovation/RoomRenovationDetails.vue`; `src/presentation/editor/renovation/SubjectRow.vue`; `src/presentation/editor/planning/EvidenceGallery.vue`. Evidence/source revision: `7d4bc381`. Owner: fidelity for presentation; parent for final integrated/host acceptance. Dependencies: existing production commands plus selection/rotation integration where applicable.

| Source requirement | Classification | Remaining action / acceptance |
|---|---|---|
| [M08-UC1](../screens/M08-existing-room-details.md#primary-use-cases): Record current floor, walls, heating, windows, doors, and fixtures. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M08-UC2](../screens/M08-existing-room-details.md#primary-use-cases): Record condition in homeowner language. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M08-UC3](../screens/M08-existing-room-details.md#primary-use-cases): Add photos/documents/notes as evidence of the current state. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M08-UC4](../screens/M08-existing-room-details.md#primary-use-cases): Mark an existing element for change. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M08-I1](../screens/M08-existing-room-details.md#interactions): Select a surface chip on canvas → Focus corresponding Existing row in Inspector | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M08-I2](../screens/M08-existing-room-details.md#interactions): Expand a row → Show editable description, condition, measurements, and evidence links | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M08-I3](../screens/M08-existing-room-details.md#interactions): `Add existing detail` → Open contextual type picker pre-linked to room and Existing state | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M08-I4](../screens/M08-existing-room-details.md#interactions): Select photo thumbnail → Show photo metadata and related spatial pin | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M08-I5](../screens/M08-existing-room-details.md#interactions): `Mark something for change` → Start Planned/Change creation from the selected Existing item | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M08-I6](../screens/M08-existing-room-details.md#interactions): Existing/Work/Planned switch → Move between M08, M10, and M09 while retaining room/viewport | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M08-AC1](../screens/M08-existing-room-details.md#acceptance-criteria): Existing information can be added incrementally. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M08-AC2](../screens/M08-existing-room-details.md#acceptance-criteria): Derived values are labeled and not editable as if manually stored. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M08-AC3](../screens/M08-existing-room-details.md#acceptance-criteria): Starting a change preserves a link to the source Existing item. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M08-AC4](../screens/M08-existing-room-details.md#acceptance-criteria): The user can complete the workflow without interacting with canvas chips. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |

## M09 — Planned Room Details

Production entry points: `src/presentation/editor/renovation/RoomRenovationDetails.vue`; `src/presentation/editor/renovation/RenovationForm.vue`; `src/presentation/editor/renovation/RenovationLayer.vue`. Evidence/source revision: `7d4bc381`. Owner: fidelity for presentation; parent for final integrated/host acceptance. Dependencies: existing production commands plus selection/rotation integration where applicable.

| Source requirement | Classification | Remaining action / acceptance |
|---|---|---|
| [M09-UC1](../screens/M09-planned-room-details.md#primary-use-cases): Define intended floor/wall/heating finishes or elements. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M09-UC2](../screens/M09-planned-room-details.md#primary-use-cases): Represent added, removed, and modified geometry. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M09-UC3](../screens/M09-planned-room-details.md#primary-use-cases): Record unresolved decisions. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M09-UC4](../screens/M09-planned-room-details.md#primary-use-cases): Navigate from planned outcomes to required work. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M09-I1](../screens/M09-planned-room-details.md#interactions): Select planned overlay/marker → Focus corresponding Planned row | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M09-I2](../screens/M09-planned-room-details.md#interactions): Add planned detail → Choose semantic type; pre-link to selected room and optional Existing item | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M09-I3](../screens/M09-planned-room-details.md#interactions): Edit finish/element → Update draft and show downstream work/cost impact before commit where applicable | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M09-I4](../screens/M09-planned-room-details.md#interactions): Select unresolved decision → Open/edit linked Decision note | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M09-I5](../screens/M09-planned-room-details.md#interactions): `See required work` → Open M10 and highlight work producing selected Planned item | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M09-I6](../screens/M09-planned-room-details.md#interactions): Toggle Planned layer → Hide/show planned overlays without deleting data | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M09-AC1](../screens/M09-planned-room-details.md#acceptance-criteria): Planned items do not overwrite Existing records. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M09-AC2](../screens/M09-planned-room-details.md#acceptance-criteria): Each spatial change is readable without opening the Inspector. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M09-AC3](../screens/M09-planned-room-details.md#acceptance-criteria): A user can trace a Planned outcome to its required Work. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M09-AC4](../screens/M09-planned-room-details.md#acceptance-criteria): Hiding the Planned layer changes only presentation. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |

## M10 — Room Work

Production entry points: `src/presentation/editor/renovation/WorkRow.vue`; `src/presentation/editor/renovation/RoomRenovationDetails.vue`; `src/presentation/views/work/ProjectWorkState.vue`. Evidence/source revision: `7d4bc381`. Owner: fidelity for presentation; parent for final integrated/host acceptance. Dependencies: existing production commands plus selection/rotation integration where applicable.

| Source requirement | Classification | Remaining action / acceptance |
|---|---|---|
| [M10-UC1](../screens/M10-room-work.md#primary-use-cases): Add work required to reach the Planned state. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M10-UC2](../screens/M10-room-work.md#primary-use-cases): Order work and represent dependencies. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M10-UC3](../screens/M10-room-work.md#primary-use-cases): Assign responsibility such as DIY or trade. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M10-UC4](../screens/M10-room-work.md#primary-use-cases): Identify blocked work. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M10-UC5](../screens/M10-room-work.md#primary-use-cases): Navigate between a spatial marker and its work item. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M10-I1](../screens/M10-room-work.md#interactions): Select numbered canvas marker → Select matching work item in Inspector | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M10-I2](../screens/M10-room-work.md#interactions): Select work row → Highlight its spatial target/marker | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M10-I3](../screens/M10-room-work.md#interactions): Add work item → Create a contextual draft linked to Room and optional Planned outcome | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M10-I4](../screens/M10-room-work.md#interactions): Change order/dependency → Validate cycles and update blocked state | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M10-I5](../screens/M10-room-work.md#interactions): Change responsibility → Choose DIY or an existing Trade record | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M10-I6](../screens/M10-room-work.md#interactions): `Creates planned` link → Open the resulting Planned item in M09 | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M10-I7](../screens/M10-room-work.md#interactions): `View schedule` → Open the broader schedule view outside the Inspector while retaining context | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M10-AC1](../screens/M10-room-work.md#acceptance-criteria): Selecting marker and list row is bidirectional. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M10-AC2](../screens/M10-room-work.md#acceptance-criteria): Work dependencies cannot create a cycle. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M10-AC3](../screens/M10-room-work.md#acceptance-criteria): A work item can state what Planned outcome it creates. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M10-AC4](../screens/M10-room-work.md#acceptance-criteria): Inspector stays focused on the selected room rather than becoming a whole-project board. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |

## M11 — Multi-Selection

Production entry points: `src/presentation/editor/shell/MultiSelectionInspector.vue`; `src/presentation/editor/renovation/RenovationBatchForm.vue`. Evidence/source revision: `7d4bc381`. Owner: fidelity for presentation; parent for final integrated/host acceptance. Dependencies: existing production commands plus selection/rotation integration where applicable.

| Source requirement | Classification | Remaining action / acceptance |
|---|---|---|
| [M11-UC1](../screens/M11-multi-selection.md#primary-use-cases): Mark several walls for removal or planning. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M11-UC2](../screens/M11-multi-selection.md#primary-use-cases): Add shared work, note, or document links. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M11-UC3](../screens/M11-multi-selection.md#primary-use-cases): Inspect aggregate length/area. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M11-UC4](../screens/M11-multi-selection.md#primary-use-cases): Clear or modify the selection safely. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M11-I1](../screens/M11-multi-selection.md#interactions): Shift-click entity → Add/remove it from selection | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M11-I2](../screens/M11-multi-selection.md#interactions): Select numbered badge/list row → Focus one member without discarding selection | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M11-I3](../screens/M11-multi-selection.md#interactions): Mark for removal/planned → Preview affected entities, then execute one composite reversible command | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M11-I4](../screens/M11-multi-selection.md#interactions): Add shared detail → Link one new/existing record to all selected entities | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M11-I5](../screens/M11-multi-selection.md#interactions): Esc → Clear multi-selection and return to M01 | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M11-I6](../screens/M11-multi-selection.md#interactions): More → Delete → Require explicit impact summary and confirmation | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M11-AC1](../screens/M11-multi-selection.md#acceptance-criteria): Inspector never shows a mixed property as if it were shared. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M11-AC2](../screens/M11-multi-selection.md#acceptance-criteria): Batch commands are atomic and undo as one user action. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M11-AC3](../screens/M11-multi-selection.md#acceptance-criteria): Unsupported entity combinations disable actions with explanation. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M11-AC4](../screens/M11-multi-selection.md#acceptance-criteria): Esc reliably returns to the safe no-selection state. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |

## M12 — Room Materials

Production entry points: `src/presentation/editor/planning/MaterialsInspector.vue`; `src/presentation/editor/planning/MaterialRow.vue`; `src/presentation/editor/planning/MaterialMarkers.vue`. Evidence/source revision: `7d4bc381`. Owner: fidelity for presentation; parent for final integrated/host acceptance. Dependencies: existing production commands plus selection/rotation integration where applicable.

| Source requirement | Classification | Remaining action / acceptance |
|---|---|---|
| [M12-UC1](../screens/M12-room-materials.md#primary-use-cases): View materials grouped by related work. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M12-UC2](../screens/M12-room-materials.md#primary-use-cases): Derive quantities from area/length plus waste allowance. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M12-UC3](../screens/M12-room-materials.md#primary-use-cases): Track purchased versus needed quantity. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M12-UC4](../screens/M12-room-materials.md#primary-use-cases): Add a manual material. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M12-UC5](../screens/M12-room-materials.md#primary-use-cases): Create a shopping list. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M12-I1](../screens/M12-room-materials.md#interactions): Select material row → Highlight related room surface/work marker | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M12-I2](../screens/M12-room-materials.md#interactions): Edit waste allowance → Recalculate derived need and show cost impact preview | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M12-I3](../screens/M12-room-materials.md#interactions): Edit purchased quantity → Validate units and update procurement status | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M12-I4](../screens/M12-room-materials.md#interactions): Add material → Create manual or calculated material requirement linked to Room/Work | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M12-I5](../screens/M12-room-materials.md#interactions): Create shopping list → Generate/open a vault-backed list from outstanding quantities | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M12-I6](../screens/M12-room-materials.md#interactions): Select `Calculated` → Explain geometry, formula, unit, and waste inputs | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M12-AC1](../screens/M12-room-materials.md#acceptance-criteria): Geometry-derived quantities update after relevant geometry changes. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M12-AC2](../screens/M12-room-materials.md#acceptance-criteria): Calculated and manual values are distinguishable. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M12-AC3](../screens/M12-room-materials.md#acceptance-criteria): Unit-incompatible quantities cannot be combined silently. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M12-AC4](../screens/M12-room-materials.md#acceptance-criteria): Shopping list includes only outstanding quantities unless configured otherwise. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |

## M13 — Room Costs

Production entry points: `src/presentation/editor/planning/CostsInspector.vue`; `src/presentation/editor/planning/CostGroup.vue`; `src/presentation/views/quotes/QuoteComparisonState.vue`. Evidence/source revision: `7d4bc381`. Owner: fidelity for presentation; parent for final integrated/host acceptance. Dependencies: existing production commands plus selection/rotation integration where applicable.

| Source requirement | Classification | Remaining action / acceptance |
|---|---|---|
| [M13-UC1](../screens/M13-room-costs.md#primary-use-cases): Understand planned, committed, actual, and remaining room cost. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M13-UC2](../screens/M13-room-costs.md#primary-use-cases): Inspect cost by work group. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M13-UC3](../screens/M13-room-costs.md#primary-use-cases): Distinguish material and labor cost. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M13-UC4](../screens/M13-room-costs.md#primary-use-cases): Add a cost or link a quote/invoice. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M13-UC5](../screens/M13-room-costs.md#primary-use-cases): Compare quotes in a dedicated downstream view. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M13-I1](../screens/M13-room-costs.md#interactions): Select work-cost group → Expand breakdown and highlight related work/surface | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M13-I2](../screens/M13-room-costs.md#interactions): Add cost → Create planned/committed/actual item with context inherited from Room | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M13-I3](../screens/M13-room-costs.md#interactions): Link evidence → Choose vault document and relate it to cost/work/supplier | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M13-I4](../screens/M13-room-costs.md#interactions): Compare quotes → Open quote comparison outside the narrow Inspector | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M13-I5](../screens/M13-room-costs.md#interactions): Select calculated estimate → Explain quantity × rate × waste inputs | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M13-AC1](../screens/M13-room-costs.md#acceptance-criteria): Totals reconcile to visible cost items. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M13-AC2](../screens/M13-room-costs.md#acceptance-criteria): Remaining is derived and clearly defined. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M13-AC3](../screens/M13-room-costs.md#acceptance-criteria): Geometry-based estimates are marked Calculated. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M13-AC4](../screens/M13-room-costs.md#acceptance-criteria): The Inspector never implies accounting/tax validity. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |

## M14 — Room Evidence

Production entry points: `src/presentation/editor/planning/EvidenceInspector.vue`; `src/presentation/editor/planning/EvidenceGallery.vue`; `src/presentation/editor/planning/EvidencePins.vue`. Evidence/source revision: `7d4bc381`. Owner: fidelity for presentation; parent for final integrated/host acceptance. Dependencies: existing production commands plus selection/rotation integration where applicable.

| Source requirement | Classification | Remaining action / acceptance |
|---|---|---|
| [M14-UC1](../screens/M14-room-evidence.md#primary-use-cases): Add a photo already linked to a room/wall/work item. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M14-UC2](../screens/M14-room-evidence.md#primary-use-cases): Find evidence by phase: Before, During, After, Hidden services. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M14-UC3](../screens/M14-room-evidence.md#primary-use-cases): Link a vault document or note to the selected entity. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M14-UC4](../screens/M14-room-evidence.md#primary-use-cases): Navigate between canvas pin and evidence item. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M14-UC5](../screens/M14-room-evidence.md#primary-use-cases): Preserve evidence context for later maintenance, warranty, or disputes. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M14-I1](../screens/M14-room-evidence.md#interactions): Select numbered pin → Select matching evidence item in Inspector | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M14-I2](../screens/M14-room-evidence.md#interactions): Select thumbnail/row → Focus corresponding pin and metadata | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M14-I3](../screens/M14-room-evidence.md#interactions): Change phase filter → Filter evidence without changing entity selection | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M14-I4](../screens/M14-room-evidence.md#interactions): Add photo → Choose/capture file, then prefill room, phase, and optional work link | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M14-I5](../screens/M14-room-evidence.md#interactions): Add/link document → Use Obsidian file chooser and preserve vault link | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M14-I6](../screens/M14-room-evidence.md#interactions): Add note → Create/open Markdown note using configured folder/template | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M14-I7](../screens/M14-room-evidence.md#interactions): Open note in Obsidian → Reveal linked note in a workspace leaf | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M14-I8](../screens/M14-room-evidence.md#interactions): Switch Documents/Photos/Notes → Keep same entity and evidence context | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M14-AC1](../screens/M14-room-evidence.md#acceptance-criteria): New evidence inherits the current spatial context. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M14-AC2](../screens/M14-room-evidence.md#acceptance-criteria): Selecting a pin and evidence item is bidirectional. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M14-AC3](../screens/M14-room-evidence.md#acceptance-criteria): Files remain ordinary vault files/links. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M14-AC4](../screens/M14-room-evidence.md#acceptance-criteria): Documents and Notes can reuse the shell without requiring separate editor navigation systems. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |

## M15 — Stale-Data Warning

Production entry points: `src/presentation/editor/PlanEditorRoot.vue`; `src/presentation/editor/save-state/SaveStateIndicator.vue`; `src/presentation/editor/shell/PersistentWarningStrip.vue`. Evidence/source revision: `7d4bc381`. Owner: fidelity for presentation; parent for final integrated/host acceptance. Dependencies: existing production commands plus selection/rotation integration where applicable.

| Source requirement | Classification | Remaining action / acceptance |
|---|---|---|
| [M15-UC1](../screens/M15-stale-data-warning.md#primary-use-cases): Understand that the change was saved even though the view did not refresh. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M15-UC2](../screens/M15-stale-data-warning.md#primary-use-cases): Retry the read without repeating the write. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M15-UC3](../screens/M15-stale-data-warning.md#primary-use-cases): Open the source note to inspect data directly. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M15-UC4](../screens/M15-stale-data-warning.md#primary-use-cases): Avoid making another edit against stale geometry. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M15-I1](../screens/M15-stale-data-warning.md#interactions): `Try again` → Re-run hydration only; never replay the mutation | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M15-I2](../screens/M15-stale-data-warning.md#interactions): `Open source note` → Reveal the relevant Markdown source | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M15-I3](../screens/M15-stale-data-warning.md#interactions): Selection/navigation → May remain available for inspection | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M15-I4](../screens/M15-stale-data-warning.md#interactions): Geometry/add/delete actions → Disabled until refresh succeeds, with explanation | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M15-I5](../screens/M15-stale-data-warning.md#interactions): Successful retry → Remove strip and stale labels; restore actions | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M15-I6](../screens/M15-stale-data-warning.md#interactions): Failed retry → Keep current valid content and update accessible failure message | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M15-AC1](../screens/M15-stale-data-warning.md#acceptance-criteria): A failed read-back never causes a successful write to be repeated. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M15-AC2](../screens/M15-stale-data-warning.md#acceptance-criteria): Last valid content is not replaced by a generic failure page. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M15-AC3](../screens/M15-stale-data-warning.md#acceptance-criteria): Save state reads `Saved · refresh needed`. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M15-AC4](../screens/M15-stale-data-warning.md#acceptance-criteria): The warning persists while the stale condition persists. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |

## M16 — Constrained Workspace

Production entry points: `src/presentation/editor/shell/ResponsiveEditorShell.vue`; `src/presentation/editor/shell/PanelRail.vue`. Evidence/source revision: `7d4bc381`. Owner: fidelity for presentation; parent for final integrated/host acceptance. Dependencies: existing production commands plus selection/rotation integration where applicable.

| Source requirement | Classification | Remaining action / acceptance |
|---|---|---|
| [M16-UC1](../screens/M16-constrained-workspace.md#primary-use-cases): Keep planning while a related Markdown note is visible. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M16-UC2](../screens/M16-constrained-workspace.md#primary-use-cases): Temporarily open Property, Layers, or Inspector. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M16-UC3](../screens/M16-constrained-workspace.md#primary-use-cases): Focus the editor tab for more space. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M16-UC4](../screens/M16-constrained-workspace.md#primary-use-cases): Preserve selection and viewport across layout changes. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M16-I1](../screens/M16-constrained-workspace.md#interactions): Property/Layers rail button → Open one temporary panel; opening one closes the other | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M16-I2](../screens/M16-constrained-workspace.md#interactions): `Kitchen details` edge button → Open Inspector drawer over canvas | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M16-I3](../screens/M16-constrained-workspace.md#interactions): Click canvas / Esc → Close temporary panel when safe | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M16-I4](../screens/M16-constrained-workspace.md#interactions): `Focus this tab` → Ask Obsidian workspace to maximize/focus leaf using supported API | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M16-I5](../screens/M16-constrained-workspace.md#interactions): Resize leaf → Reflow at thresholds without resetting selection/viewport | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M16-AC1](../screens/M16-constrained-workspace.md#acceptance-criteria): No horizontal scrollbar appears at supported constrained widths. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M16-AC2](../screens/M16-constrained-workspace.md#acceptance-criteria): Select and Add remain reachable. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M16-AC3](../screens/M16-constrained-workspace.md#acceptance-criteria): Canvas state survives resizing and focusing the leaf. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M16-AC4](../screens/M16-constrained-workspace.md#acceptance-criteria): The editor clearly refuses unsupported widths rather than rendering broken controls. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |

## M17 — Review Perspective

Production entry points: `src/presentation/editor/renovation/ReviewInspector.vue`; `src/presentation/editor/renovation/ReviewRoomMarkers.vue`; `src/presentation/editor/planning/PlanningReview.vue`. Evidence/source revision: `7d4bc381`. Owner: fidelity for presentation; parent for final integrated/host acceptance. Dependencies: existing production commands plus selection/rotation integration where applicable.

| Source requirement | Classification | Remaining action / acceptance |
|---|---|---|
| [M17-UC1](../screens/M17-review-perspective.md#primary-use-cases): See which rooms are ready, need decisions, or miss information. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M17-UC2](../screens/M17-review-perspective.md#primary-use-cases): Review Existing → Work → Planned coherence for a selected room. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M17-UC3](../screens/M17-review-perspective.md#primary-use-cases): Find blocked work or missing cost. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M17-UC4](../screens/M17-review-perspective.md#primary-use-cases): Create a vault-backed review note. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M17-UC5](../screens/M17-review-perspective.md#primary-use-cases): Return to Renovate at the exact item needing attention. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M17-I1](../screens/M17-review-perspective.md#interactions): Select review marker → Select room/change and expand its readiness summary | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M17-I2](../screens/M17-review-perspective.md#interactions): Select readiness row → Center/focus relevant room on canvas | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M17-I3](../screens/M17-review-perspective.md#interactions): Select issue → Open the specific Decision, Work, Cost, or Evidence detail in Renovate | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M17-I4](../screens/M17-review-perspective.md#interactions): `Open Kitchen` → Switch to Renovate while retaining Kitchen selection | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M17-I5](../screens/M17-review-perspective.md#interactions): `Create review note` → Generate/open a Markdown summary with links to reviewed entities | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M17-I6](../screens/M17-review-perspective.md#interactions): `Back to renovate` → Return to prior Renovate selection and viewport | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M17-AC1](../screens/M17-review-perspective.md#acceptance-criteria): Readiness results are deterministic and explainable. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M17-AC2](../screens/M17-review-perspective.md#acceptance-criteria): Every issue routes to one actionable source screen. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M17-AC3](../screens/M17-review-perspective.md#acceptance-criteria): Review does not expose geometry editing or Add creation controls. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |
| [M17-AC4](../screens/M17-review-perspective.md#acceptance-criteria): Returning to Renovate preserves context. | implemented but unverified | Exercise this outcome on the final joined revision; inspect matching state; applicable H1–H6 remain separate. |

## Shared component interaction contracts

Source: [component library](../components/component-library.md), revision `7d4bc381`. Each row is implemented but unverified on the final joined release until fresh evidence is recorded; accepted exceptions above still apply. Parent owns final integrated/host acceptance; fidelity owns presentation corrections.

| Source component | Contract / acceptance |
|---|---|
| `ResponsiveEditorShell` | **Responsibility:** Arrange context bar, panels, canvas, Inspector, warnings, and status based on available leaf width. |
| `EditorContextBar` | **Responsibility:** Show current property/building/floor, perspective switch, Undo, Redo, and View. |
| `PerspectiveSwitch` | **Responsibility:** Switch Plan, Renovate, and Review while preserving compatible context. **Accessibility:** tablist or radiogroup semantics; arrow-key navigation; explicit active state. |
| `PersistentWarningStrip` | **Responsibility:** Present persistent recoverable conditions above the canvas. **Rule:** independent warnings must not suppress one another merely because they share a region. |
| `PropertyLayerPanel` | **Responsibility:** Container for Property hierarchy, Layers, and optional semantic legend. |
| `PropertyTree` | **Responsibility:** Navigate Property → Building → Floor/Site hierarchy. **Accessibility:** tree semantics, arrow-key navigation, level labels. |
| `LayerList` | **Responsibility:** Control presentation layers without confusing them with semantic Existing/Planned state. |
| `ChangeLegend` | **Responsibility:** Explain Existing wall, Wall to remove, New wall/opening, and optional markers. **Rule:** always pairs color with stroke pattern and plus/minus/numbered symbols. |
| `PanelRail` and `OverlayPanel` | **Responsibility:** Constrained-width access to Property/Layers. Only one overlay panel opens at a time. |
| `PlanCanvas` | **Responsibility:** Host the Konva stage, viewport, ordered layers, pointer routing, keyboard gestures, and overlays. **Rule:** It renders projections; it does not persist domain entities directly. |
| `SelectionOverlay` | **Responsibility:** Render selection outline, handles, dimensions, and focus state for one entity. |
| `MultiSelectionOverlay` | **Responsibility:** Render multiple selected entities and stable numbered badges. |
| `HoverOverlay` | **Responsibility:** Preview the entity that will be selected according to selection priority. Hover never changes data. |
| `DimensionLabel` / `EditableDimensionLabel` | **Responsibility:** Show formatted dimensions and optionally enter exact values. **Rule:** direct manipulation and numeric entry converge on the same command. |
| `SnapGuideLayer` | **Responsibility:** Render active alignment, endpoint, and angle guides from the snapping service. |
| `FloatingPrimaryActions` | **Responsibility:** Keep Select and Add reachable without a permanent tool ribbon. |
| `DirectActionPopover` | **Responsibility:** Show one or two high-frequency actions adjacent to a selection, such as Edit shape/Add detail or Edit length/Mark change. **Rule:** Actions are duplicated in keyboard/Inspector routes; popover is a convenience, not the only path. |
| `MultiSelectionActionBar` | **Responsibility:** Shared actions and selection count for M11. |
| `TemporaryToolBanner` | **Responsibility:** Short task instruction and Esc/Enter hints during a temporary creation task. |
| `CreationToolBar` | **Responsibility:** Current creation type, Undo point where applicable, Finish, Cancel, and repeated-creation option where applicable. |
| `RoomCreationOverlay` | **Responsibility:** Draft rectangular/free-shape room preview, handles, and dimensions. |
| `WallDrawingOverlay` | **Responsibility:** Draft connected segments, current segment, angle indicator, and close-loop detection. |
| `RoomDetectedPrompt` | **Responsibility:** Offer room creation when a wall loop closes. |
| `EntityInspector` | **Responsibility:** Shared Inspector frame: entity identity, close/back behavior, contextual body, primary action. |
| `TransformationSummary` | **Responsibility:** Compact Existing → Work → Planned glanceable narrative. **Rule:** Summary is not navigation when `HomeownerQuestionNav` is present; it avoids duplicated active destinations. |
