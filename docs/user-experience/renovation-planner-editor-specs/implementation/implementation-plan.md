# Renovation Planner — Editor Implementation Plan

**Status:** In progress — see [implementation status and remaining scope](implementation-status.md).
**Basis:** Locked mockups M00–M17 and shared component library  
**Constraint:** Evolve the existing Vue 3/Pinia/Konva editor; do not replace the working layered architecture

## 1. Outcome

Deliver a homeowner-first spatial renovation editor inside Obsidian that:

- opens in Select;
- uses one Add entry point;
- supports room-first and precise wall creation;
- manages imported reference plans contextually;
- exposes Existing, Planned, Work, Materials, Costs, and Evidence through the selected spatial entity;
- works in Obsidian light, dark, and custom themes;
- degrades safely in constrained workspace leaves;
- preserves Markdown as the source of truth and the canvas as a projection.

## 2. Existing foundation to preserve

The repository already contains:

- a five-region editor shell (`PlanEditorRoot`, toolbar, Layers, canvas, Inspector, status);
- Konva canvas and ordered layer management;
- viewport, pan/zoom, snapping, selection, tool manager, and command history;
- polygon/zone creation, calibration, undo/redo, and save-state handling;
- theme-token resolution;
- application commands, queries, repositories, and Markdown persistence boundaries;
- a browser harness and Vitest suites.

Implementation should refactor presentation and extend domain/application capabilities incrementally. It should not introduce a second editor runtime, direct vault writes from Vue, or a hidden database.

## 3. Delivery strategy

Use vertical slices. Each slice must deliver:

1. domain/read-model change where required;
2. command/query path;
3. presentation component and interaction;
4. localization keys;
5. automated tests;
6. harness scenario and visual/theme verification;
7. documentation/requirement traceability.

The visual shell is implemented before deeper renovation domains, but fake counts must not be hard-coded into production UI. Until a domain exists, omit or explicitly mark the unavailable section.

## 4. Work breakdown and dependencies

### Phase 0 — Specification and architecture alignment

**Goal:** Turn the locked design into accepted technical contracts.

Tasks:

- Review M00–M17 with product, UX, and engineering.
- Record ADRs for perspective state, typed spatial entity selection, and Inspector routing.
- Map existing Zone domain objects to user-facing Room/Area presentation types.
- Define minimum domain scope for Room, Wall, Opening, Existing item, Planned item, and Work item.
- Confirm persistence/frontmatter schemas and migration policy.
- Define supported minimum editor width and responsive thresholds.
- Add screen IDs to requirement/test traceability.

Exit criteria:

- No unresolved terminology conflicts.
- Domain/application/presentation ownership is explicit.
- First three delivery slices are estimable.

### Phase 1 — Obsidian-native responsive shell

**Screens:** M00, M01, M16  
**Depends on:** Phase 0

Tasks:

- Refactor `EditorToolbar` into `EditorContextBar`, `PerspectiveSwitch`, and contextual action areas.
- Remove visible Pan and Calibrate from the primary editor toolbar.
- Add `ResponsiveEditorShell` around existing root regions.
- Add full/constrained layout behavior using container/leaf width observation.
- Add `PanelRail`, overlay Property/Layers panel, and Inspector drawer.
- Preserve hydration, failure, stale, selection, and viewport state across layout changes.
- Remove product-specific logo/user/account concepts from prototypes and tests.

Tests:

- Full and constrained layout snapshots/DOM assertions.
- No horizontal overflow at supported widths.
- Panel focus trap/restore.
- Selection and viewport survive resize.

Exit criteria:

- M01 and M16 render with existing data.
- Editor is legible in default light/dark themes.

### Phase 2 — Safe selection model and contextual Inspector frame

**Screens:** M00, M01, M07, M11  
**Depends on:** Phase 1

Tasks:

- Make Select the explicit safe default after hydration and tool completion.
- Define typed `SpatialSelection` for Room/Area/Wall/Opening/Object and multi-selection.
- Implement deterministic selection priority: handle → object → opening → wall → room → background.
- Add hover preview and overlap cycling/alternate selection route.
- Refactor Inspector into shared `EntityInspector` frame with routed content.
- Implement Floor summary, Room overview, Wall overview, and Multi-selection overview.
- Add non-canvas entity lists for keyboard/mobile/read-only access.
- Ensure direct selection and list selection share one store/action.

Tests:

- Selection priority and overlap cycling.
- Clear selection and Esc behavior.
- Canvas/list bidirectional selection.
- Multi-selection shared-property/aggregation rules.
- Inspector retains viewport and entity context.

Exit criteria:

- M00, M01, M07, and M11 work with real entities/read models.

### Phase 3 — Add model and temporary tool lifecycle

**Delivered slice (2026-09-05):** Area creation through Add, temporary outline completion,
explicit repetition, Escape/input ownership and reversible Zone persistence. See the
[M02 delivered contract](../screens/M02-add-menu.md#delivered-area-contract--phase-3--increment-a-2026-09-05)
and [implementation status](implementation-status.md). Room and Area are available;
the remaining creation domains and full release acceptance remain open.

**Screens:** M02  
**Depends on:** Phase 2

Tasks:

- Implement declarative creation catalog and localized homeowner labels.
- Add `FloatingPrimaryActions` and anchored `AddMenu`.
- Route Room/Area internally to the appropriate geometry tools without exposing technical names.
- Guarantee one-shot creation returns to Select.
- Add explicit repeated-creation opt-in.
- Centralize Esc, Enter, Delete, and focus-in-field keyboard routing.

Tests:

- Menu keyboard behavior/search/localization.
- One menu activation starts exactly one tool.
- Esc closes menu or cancels tool in correct order.
- Tool completion returns to Select by default.

Exit criteria:

- M02 replaces the permanent creation-tool toolbar.

### Phase 4 — Room-first creation and direct precision

**Screens:** M03  
**Depends on:** Phase 3

Tasks:

- Introduce Room semantic read model over existing zone geometry or a dedicated Room entity per Phase 0 decision.
- Implement rectangular room draft overlay and live dimensions.
- Implement exact width/depth entry through shared unit parser.
- Add room type/name and calculated area.
- Add snapping guides and accessible numeric route.
- Commit one reversible room-creation command.
- Update dependent calculated values after geometry changes.

Tests:

- Drag and numeric entry produce equivalent geometry.
- Unit conversion/round-trip precision.
- Invalid/zero dimensions.
- Snapping and cancellation.
- Undo/redo of room creation.

Exit criteria:

- A novice can create, name, and resize a room without wall drawing.

### Phase 5 — Precise wall and opening model

**Screens:** M04, M07  
**Depends on:** Phases 3–4

Tasks:

- Implement/persist Wall and hosted Opening relationships as approved.
- Add connected-wall draft state, segment dimensions, angle indication, and undo point.
- Add loop detection and optional Room creation in one composite command.
- Add Wall Inspector measurements and change-state actions.
- Implement exact-length transform impact preview.
- Add Door/Window/Opening placement using wall hosting and snapping.

Tests:

- Connected-segment creation and cancellation.
- Closed-loop room detection.
- Opening remains hosted across valid wall edits.
- Referentially safe deletion.
- Composite undo/redo.

Exit criteria:

- Precise layouts can be created without compromising the room-first path.

### Phase 6 — Floor acquisition and reference-plan workflow

**Screens:** M05, M06  
**Depends on:** Phase 1; can run partly parallel with Phases 4–5 after contracts settle

Tasks:

- Replace generic empty canvas with floor-start choices.
- Compose upload, page selection, crop, rotation, known distance, and review into `ReferencePlanSetup`.
- Reuse existing background renderer, PDF rasterization, known-distance form, and calibration math.
- Move calibration entry from toolbar into selected Reference plan/settings.
- Persist reference opacity, lock, transform, page, and scale.
- Provide missing/unreadable reference warnings independent from stale-plan warnings.

Tests:

- Empty-state selection paths.
- Scale calculation and unit normalization.
- Replace/cancel restores previous reference.
- Layer lock prevents accidental movement.
- Missing/unreadable source behavior.

Exit criteria:

- Imported plans become locked, calibrated, revisitable layers.

### Phase 7 — Existing and Planned semantic state

**Screens:** M08, M09  
**Depends on:** Stable Room/Wall selection from Phases 2, 4, 5

Tasks:

- Add Existing and Planned domain records without overwriting one another.
- Add Change relationship/classification: unchanged/remove/modify/add.
- Implement `TransformationSummary`, `HomeownerQuestionNav`, and `SemanticStateSwitch`.
- Add room-surface/item read models and canvas overlays.
- Add condition vocabulary and unresolved Decision links.
- Ensure Planned changes use accessible line/pattern/marker semantics.

Tests:

- Existing and Planned persistence/migration.
- Change classification and relationship integrity.
- State switch preserves selection/viewport.
- Layer visibility affects projection only.
- Custom theme visual tests.

Exit criteria:

- The user can describe current and intended states independently and compare them spatially.

### Phase 8 — Work and readiness relationships

**Screens:** M10, M17  
**Depends on:** Phase 7

Tasks:

- Add Work item domain/read models with spatial targets, order, responsibility, status, and dependency.
- Implement dependency-cycle validation and derived blocked state.
- Add stable numbered Work markers and bidirectional list selection.
- Link Work outcomes to Planned items and optional Existing sources.
- Define explainable readiness rules for Review.
- Implement Review markers, readiness list, issues, and navigation back to actionable detail.
- Generate vault-backed review note using links to underlying records.

Tests:

- Dependency cycle prevention.
- Marker/list bidirectional selection.
- Deterministic readiness rules and explanations.
- Review → Renovate navigation restores context.
- Work composite command undo/redo.

Exit criteria:

- Existing → Work → Planned is navigable and reviewable end to end.

### Phase 9 — Materials and geometry-derived quantities

**Screens:** M12  
**Depends on:** Phases 4, 5, 8

Tasks:

- Add Material Requirement model, units, calculation provenance, waste allowance, and purchase state.
- Implement geometry/work calculation services outside presentation.
- Add Materials Inspector and optional markers.
- Recalculate through domain/application events when source geometry changes.
- Create/open vault-backed shopping list.

Tests:

- Area/length/unit calculations and precision.
- Waste allowance and provenance.
- Incompatible unit validation.
- Recalculation after geometry change.
- Manual override policy and history.

Exit criteria:

- Quantities are traceable to geometry/work and distinguish calculated from manual values.

### Phase 10 — Costs

**Screens:** M13  
**Depends on:** Phases 8–9

Tasks:

- Add Cost item stages: planned, committed, actual.
- Link costs to room, work, material, quote/document, and optional supplier.
- Implement project-currency money type and aggregation queries.
- Implement Costs Inspector and calculated-estimate provenance.
- Route quote comparison to a dedicated view rather than overloading Inspector.

Tests:

- Currency and aggregation correctness.
- Planned/committed/actual reconciliation.
- Remaining definition.
- Geometry-derived estimate updates.
- Evidence link integrity.

Exit criteria:

- Cost answers remain spatially contextual and reconcilable.

### Phase 11 — Evidence integration

**Screens:** M14  
**Depends on:** Phase 2; work links benefit from Phase 8

Tasks:

- Add common Evidence relationship metadata for documents, photos, and notes.
- Use Obsidian vault links/files; no proprietary blob store.
- Implement type/phase filters and stable numbered pins.
- Add thumbnail generation/fallback and missing-file handling.
- Add contextual creation with room/wall/work pre-linking.
- Add Open in Obsidian/reveal behavior.

Tests:

- Vault path normalization and link resolution.
- Missing/unreadable file fallback.
- Pin/list bidirectional selection.
- Filter and keyboard navigation.
- No writes outside infrastructure.

Exit criteria:

- Evidence captured from a spatial context remains findable from that context and as ordinary vault content.

### Phase 12 — Resilience, accessibility, localization, and release hardening

**Screens:** M15 and cross-cutting all screens  
**Depends on:** All preceding slices as applicable

Tasks:

- Complete stale-after-refresh behavior and disable unsafe actions.
- Audit all screens against WCAG 2.2 AA.
- Verify full keyboard flows for selection, Add, room/wall creation, Inspector, and dialogs.
- Verify no information relies on color alone.
- Complete English and German strings; test fallback behavior.
- Run default light/dark plus representative custom themes/accent colors.
- Performance-test large floors, many markers, images, and rapid pan/zoom.
- Add migration, recovery, and backup guidance.
- Update user documentation and release notes.

Tests:

- Stale retry never replays writes.
- Automated accessibility checks plus manual canvas keyboard audit.
- Theme matrix screenshots/visual QA.
- Error-surface policy tests.
- Performance budgets and memory cleanup on leaf close.
- End-to-end homeowner journeys in harness and Obsidian.

Exit criteria:

- No critical accessibility/theme/data-loss defects.
- All M00–M17 acceptance criteria are traced and verified.

## 5. Recommended release increments

| Increment | Included phases | User-visible outcome |
|---|---|---|
| A — Editor foundation | 0–3 | Obsidian-native shell, safe Select, contextual Inspector, scalable Add |
| B — Spatial creation | 4–6 | Room-first creation, wall precision, reference-plan setup |
| C — Renovation semantics | 7–8 | Existing, Planned, Work, Review |
| D — Planning depth | 9–11 | Materials, costs, documents/photos/notes |
| E — Hardening | 12 | Accessible, themed, resilient release |

Each increment should be releasable behind capability availability rather than feature flags that show empty fake data.

## 6. Testing strategy

### Domain/application tests

- geometry invariants and unit precision;
- Existing/Planned/Change relationships;
- work dependencies and readiness;
- material/cost calculations;
- referential deletion rules;
- reversible command behavior.

### Presentation tests

- component states and keyboard interactions;
- selection/Inspector routing;
- responsive layout;
- status/error surfaces;
- localization and semantic labels.

### Canvas tests

- pointer ownership and gesture chords;
- zoom-around-pointer and pan;
- snapping and handle transforms;
- selection priority and overlap;
- layer ordering and theme-token application.

### Harness journeys

1. Start a new floor and add a room.
2. Upload and scale a reference plan.
3. Draw walls and create a detected room.
4. Select Kitchen and define Existing → Planned → Work.
5. Derive materials and inspect cost.
6. Add a photo linked to a work item.
7. Review missing decisions and return to fix them.
8. Recover from stale read-back without replaying a write.
9. Repeat key journeys in dark theme and constrained leaf.

## 7. Migration and compatibility

- Preserve existing Zone Markdown files and IDs.
- Add a presentation/type mapping before attempting destructive schema renames.
- Introduce migrations only when new persisted fields are necessary.
- Make each migration idempotent, versioned, tested, and recoverable.
- Do not rewrite all vault files merely to change user-facing terminology.
- Continue supporting non-canvas access to every spatial record.

## 8. Performance budgets

Proposed budgets to validate during Phase 0/12:

- Editor initial usable render: under 1.5 seconds for a typical local project after Obsidian is ready.
- Pan/zoom interaction: target 60 fps, minimum acceptable 30 fps under representative floor complexity.
- Selection feedback: under 100 ms.
- Inspector change: under 200 ms from available read model.
- Recalculation: incremental and asynchronous when large; visible status for operations above 300 ms.
- No retained Konva stages, listeners, or object URLs after leaf close.

## 9. Definition of done per screen

A screen is done only when:

- its listed use cases work with real read models/commands;
- every interaction has success, cancel, invalid, busy, and failure behavior where applicable;
- keyboard and non-canvas alternatives are verified;
- light/dark/custom-accent rendering is checked;
- English strings are complete and German fallback/translation behavior is valid;
- automated tests cover critical rules;
- the harness exposes the state for review;
- screen acceptance criteria are traceable to tests;
- no production UI exposes internal Zone/Polygon/Vertex/Scene vocabulary.

## 10. Immediate next backlog

1. ADR: typed spatial selection and user-facing entity vocabulary.
2. ADR: perspective state and Inspector routing.
3. Component: `ResponsiveEditorShell` with current editor regions.
4. Component: `EditorContextBar` and `PerspectiveSwitch`.
5. Component: `EntityInspector` frame with Floor and Room overview.
6. Refactor: Select as safe default and Add menu entry.
7. Harness: M01 Standard Plan and M00 Kitchen Selected in light/dark themes.
8. Tests: responsive shell, selection routing, and theme semantics.

This backlog deliberately creates the interaction foundation before expanding the renovation domain.
