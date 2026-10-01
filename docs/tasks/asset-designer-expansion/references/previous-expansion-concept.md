---
title: Renovation Planner — Asset Designer Expansion Concept
type: product-concept
status: proposed
language: en
date: 2026-09-15
repository: Luis85/renovation-planner
reviewed-ref: f82695645601b98a7febd95dbc8171c19237a245
---

# Asset Designer: from shape editing to reusable renovation objects

## 1. Product decision

Evolve the existing Asset Designer into a purpose-built, top-down 2D object editor. Do not create a separate general-purpose illustration application, replace the current drawing stack, or duplicate the Plan Editor.

**User promise:** “I can create a recognizable, correctly sized object, use it in my renovation plan, and improve it later without starting again.”

The Asset Library finds and manages definitions. The Asset Designer authors an individual definition’s appearance and spatial behavior. The Plan Editor places instances and connects them to a renovation project. Project-specific work, purchases, costs, and evidence stay in their owning workflows.

Primary users are novice homeowners. Greater precision and portability should also make their work easier for professionals to interpret, without presenting the designer as a certified CAD or building-compliance system.

### Constraints retained

Use TypeScript, Vue 3, Pinia, Konva/vue-konva, Vite and Vitest. Keep the existing validation, command, geometry and persistence architecture. Remain local-first and Obsidian-native, using English product copy and host light/dark theme tokens. Do not introduce account, avatar, logo or cloud chrome into the editor. Cloud acquisition belongs in the library workflow; local design must work without it.

## 2. Review scope and evidence

This concept is based on a source review of `main` at commit `f82695645601b98a7febd95dbc8171c19237a245`. The running Obsidian interface and automated tests were not executed. Findings about controls and models are source observations, not measured usability results. All expansion behavior below is proposed unless explicitly identified as existing.

### Existing foundation

| Area | Observed implementation | Consequence |
|---|---|---|
| Object semantics | `AssetShape` contains footprint, separate clearance, anchor, facing, details and per-coordinate-group pending-scale flags. Dimensions are derived from geometry. | Extend this model; do not replace it with a generic drawing document. |
| Drawing | Registered tools include footprint/clearance tracing, rectangle and circle details, detail tracing, anchor/facing controls and calibration. | Basic drawing is not a new requirement. Improve composition and discoverability. |
| Selection | One part can be selected; modes include transform, points and bend. | Multi-selection and group interaction are genuine extensions. |
| Inspector | Single-part size/position/rotation, duplicate/delete/order actions and whole-asset properties are represented. | Consolidate controls instead of implementing a second transform system. |
| Presets | A preset form builds geometry from parameters; the catalogue includes tables, seating, sanitary objects, plants and beds. | Promote and improve an existing entry path rather than inventing templates from scratch. |
| Integration | The designer has its own Obsidian leaf context and reuses editor infrastructure, including background and theme mechanisms. | Share behavior selectively while preserving independent object/plan contexts. |
| History/persistence | Tool construction uses reversible edits, expected versions and guarded dispatch. | Extend this path for every new operation; do not add a separate canvas save/history mechanism. |

### Four priority findings

**1. Tool presentation has diverged.** `DesignerToolbar.vue` still presents the older toolbar, while its source documents the Plan Editor’s move to a context bar and floating Select/Add controls. Align the interaction family, not necessarily every control.

**2. Details are closed outlines only.** `AssetDetail` requires a closed curved outline enclosing an area. Open seams, simple strokes and open arcs need a real domain extension, not near-zero-width polygons masquerading as lines.

**3. Selection is explicitly single-part.** Building a recognizable object from several parts needs multi-selection, group/ungroup, alignment and consistent whole-object operations.

**4. Resize and replacement are conflated.** `editDimensions()` takes a replace-with-rectangle path for a scaled, straight-sided footprint with no details. A non-rectangular traced footprint therefore needs an explicit distinction between resizing and replacement. Preserve the useful ability to create a rectangle from dimensions, but label replacement honestly.

## 3. Scope boundary

Support furniture, appliances, sanitary fixtures, garden objects, planting symbols, custom built-ins and other reusable top-down objects. An asset may consist of several visual parts but remains one catalogue definition unless the user explicitly creates an assembly with independently managed assets.

Do not treat visual groups as a bill of materials. A cabinet with five drawn panels is not automatically five purchases. A drawn worktop must not create room geometry, and editing an asset must never alter a plan’s calibration.

Do not add Plan/Renovate modes here. The designer defines an object; an instance’s existing/planned state belongs in a plan.

## 4. Three creation journeys

### 4.1 Start from an object

The preferred entry point is a visual gallery of the existing presets. Show recognizable thumbnails, names and dimension fields. A homeowner chooses a sink, changes width and depth, and sees a meaningful preview before committing.

Use progressive disclosure: show a small set of meaningful parameters first, with optional details beneath. Explain whether the result remains parameter-editable or becomes freely editable geometry. Never silently regenerate a template over manual edits.

### 4.2 Start from measurements

A user knows a bench is 1,200 × 450 mm. Entering these values immediately creates a usable rectangle. They can add recognizable details later. Require only enough metadata to identify and save the object; category, price and supporting documents must not block its first placement.

Keep the interface unit-aware while preserving canonical millimetres. Display-unit changes must not change the stored geometry. Preserve fractional authored values internally; round for presentation only.

### 4.3 Trace a reference

Choose an existing vault image or a supported PDF page, calibrate a known length, lock the reference, trace the footprint, add details, and verify dimensions. Build on the existing background pipeline.

Distinguish an unscaled trace, a calibrated reference and independently verified real-world dimensions. Calibration alone is not evidence that a distorted photograph or an incorrect manufacturer drawing is accurate. Preserve the existing per-part pending-scale safeguards.

A draft may be saved before calibration, but it must not be presented as dimensionally ready for placement or handover.

## 5. Workspace design

### Header and context

Use an Obsidian workspace leaf with an asset name, library return action, save state, contextual help and a “Use in plan” action. Keep this header free of account or marketing chrome.

A draft auto-save is not the same as publishing a new geometry version into every existing plan. Keep persistence status and usage/update scope distinguishable.

### Left: Add and Parts

The Add surface offers object presets and basic shapes. The Parts surface gives a navigable hierarchy of the current object: footprint, graphic parts/groups, clearance, placement controls and reference.

Parts should support names, selection, ordering and edit locks. Grouping should initially apply to graphic parts, not silently absorb calibration, footprint ownership or placement anchors into arbitrary nesting.

An eye control used for editing isolation must be distinguished from “include in final symbol.” Hiding a reference or clearance while editing must not delete it or silently change a published asset.

### Centre: object canvas

Keep most space available for the object. Show a restrained grid, current measurement state, selection handles, live dimensions and visible snapping feedback. Preserve familiar pan/zoom, fit, selection and cancel behavior from the Plan Editor.

Give the footprint a clear outline; render interior details more quietly. Clearance and reference overlays should not obscure normal editing. Use view toggles to reveal them when relevant.

### Right: contextual inspector

With nothing selected, show asset dimensions, height, source/scale status and placement information. With one part selected, show that part’s geometry and appearance. With several parts selected, show group, align, distribute and common transform actions.

Keep whole-object and selected-part dimensions clearly labelled. Prefer “Placement point” and “Front direction” in introductory copy, while keeping the domain terms anchor and facing available in help.

### Narrow panes and touch

Collapse secondary panels into drawers instead of shrinking the canvas into an unusable strip. Provide visible alternatives to modifier-only interactions, including multi-select and proportional scaling. Keep preset creation and measurement editing usable in compact layouts; stage advanced phone-based point editing separately rather than claiming unsupported parity.

## 6. Editing capabilities

| Capability | Proposed behavior | Priority |
|---|---|---|
| Multi-selection | Add/remove selected parts; marquee selection; visible selected count; deterministic overlap selection. | First composition increment |
| Grouping | Group/ungroup graphic parts without changing appearance, ownership or cost semantics. Start with shallow groups. | First composition increment |
| Alignment | Align to selection bounds or a chosen reference; distribute evenly; show the reference explicitly. | First composition increment |
| Duplication | Duplicate, offset and repeat visual parts; preserve names predictably and assign fresh IDs. | First composition increment |
| Numeric editing | Position, width/depth and angle; dimension changes are commands, not separately stored measurements. | First composition increment |
| Whole-object resizing | Distinct from resizing a part and replacing a footprint; preview affected semantics. | Foundation |
| Open geometry | Line and polyline first; open arcs when their model/export/hit-testing path is ready. | Geometry increment |
| Primitive convenience | Rounded rectangles, clear corner-radius editing and later ellipse support. Reuse current rectangles/circles. | Geometry increment |
| Appearance | Restrained outline/detail styles; explicitly defined hidden/overhead notation; optional presentation fills later. | Geometry increment |
| Safe footprint editing | Explicit footprint editing and replacement; preview changes to dimensions and use. | Foundation |
| Preview in context | Preview at plan scale, including rotation, mirroring and optional clearance overlay. | End-to-end first release |

### Interaction rules

Select is the normal resting tool. Drawing returns to Select unless the user has explicitly enabled repeat drawing. A complete drag or transform is one undoable action. Escape cancels an active gesture before it clears selection. Invalid input retains the last valid saved state and leaves a recoverable draft/error explanation.

Selection, shortcuts and focus must be scoped to the active editor leaf. Canvas shortcuts must not consume ordinary typing in fields or notes. Parts and inspector controls provide keyboard-accessible alternatives to canvas-only manipulation.

Snapping must use visible feedback and a screen-space tolerance. Grid, vertices, centres and alignments need a documented priority to avoid jitter. Reuse current infrastructure rather than creating a competing snapping engine. Snapping preferences may differ between plan-scale work and object-scale work.

## 7. Spatial correctness and geometry decisions

### Keep meanings separate

The physical footprint answers “what space does the object occupy?” Graphic parts answer “what makes it recognizable?” Clearance answers “what additional space is reserved?” Placement controls answer “where and in which direction is it placed?” References and guides support authoring but are not the object itself.

Decorative bounds must not redefine physical dimensions automatically. “Fit footprint to details” is a deliberate command, not an implicit side effect of adding a handle or a plant symbol.

### Specify each transform

Moving, rotating and mirroring the whole definition must keep all relevant geometry and placement semantics coherent. Moving a detail must not alter the footprint or facing.

Resizing needs a policy different from simple transformation. Resizing visual geometry must not silently weaken a user-entered minimum clearance. Until clearance rules are formalized, warn that an authored clearance requires review after a significant resize; do not claim a fit check remains valid automatically.

Height remains independent of 2D scaling. Its existing role is descriptive, not vertical clash detection.

### Circular curves are a real constraint

The current `CurvedPolygon` represents circular arcs with bulges. An unequal X/Y scale of a circular arc is generally an elliptical arc, which that representation does not directly express. Do not promise mathematically exact unrestricted stretching before deciding how to represent the result.

Start with proportional scaling for curved custom geometry and explicit preset parameter edits. Add native ellipse/path support or a documented, tolerance-controlled conversion only when the same representation works for validation, bounds, hit-testing, persistence and export.

## 8. Architecture within the current stack

Keep the existing layered direction:

`Vue controls and canvas gestures → per-leaf runtime → pure domain edit → reversible application command → repository/persistence → refreshed read model`.

Extend the domain model first. A Konva node is a rendering object, not the canonical asset. Store user-authored geometry and semantic data; reconstruct the canvas from that data. This also leaves a future web client able to reuse the domain and render-model layers without importing Obsidian lifecycle objects.

### Reuse and extension points

- `src/domain/asset/AssetShape.ts`: preserve the object aggregate, physical semantics and derived dimensions.
- `src/domain/asset/AssetDetail.ts`: evolve closed-only details into a validated graphic-element union as needed.
- `src/core/geometry/CurvedPolygon.ts`: make curve/stretch policy explicit before broadening transforms.
- `src/presentation/designer/selection/designerSelection.ts`: extend singular selection into a selection set plus focused part.
- `src/presentation/designer/tools/registerDesignerTools.ts`: retain registration reachability and reversible writes for new tools.
- `src/presentation/designer/AssetDesignerRoot.vue`: separate resize from replacement and simplify creation entry points.
- `src/presentation/designer/DesignerToolbar.vue`: align the tool presentation with the current Plan Editor interaction family.
- `src/presentation/designer/inspector/DesignerSelectionInspector.vue`: add multi-part actions without duplicating existing geometry rules.

Do not turn the designer and Plan Editor into one large conditional component. Share gesture conventions, unit fields, focus behavior, save-state components and suitable geometry helpers; keep object and plan responsibilities separate.

### Migration and history

Retain stable IDs. Migrate existing details losslessly into the new representation. Preserve array order, names, solid/dashed semantics and pending-scale flags. Version the persisted schema and refuse unsupported future versions safely. Never save Konva’s scene JSON as the replacement geometry sidecar.

Group operations commit atomically to history. A mixed success after a multi-part edit is not acceptable. Extend existing expected-version/conflict handling so two open leaves cannot silently overwrite each other. User-visible save failures must not masquerade as success.

### Renderer caution

Konva’s Transformer changes node scale rather than width/height, and Vue integration requires explicit node attachment. The existing custom transform path should not be replaced casually. Any Transformer experiment must normalize its result through the same validated domain operations and command history.

Keep rendering-layer count small; a row in the Parts tree is not a new Konva layer. Avoid unnecessary hit testing on references/guides and benchmark complex assets before choosing caches or workers.

## 9. Product integration

### Definition versus instance

Preserve the repository’s existing direction: active working plans reference shared definitions so corrections can propagate. Expose where an asset is used before an impactful edit. Offer “Duplicate as new asset” for intentional divergence.

Issued/approved plans require reproducible asset state. The existing Asset Designer epic already records this obligation for Plan Revisions. Resolve it with immutable shape versions or complete referenced-state snapshots at approval. Include footprint, graphics, clearance, anchor, facing and relevant metadata—not only the main outline. Do not implement this solely as a designer-local version system.

### Editing from a plan

Provide distinct actions to edit the shared definition and to create a separate custom asset. Returning from the designer should preserve the user’s plan context and selection. Show update scope in words users can understand; auto-saving must not imply that an issued drawing can change silently.

### Preview and portability

Use a common geometry/render-model path for the designer, library thumbnails and placed instances. Ensure new element types work throughout that path before exposing their tools.

Separate portable native assets from picture exports. A PNG is a preview. A clean SVG may be useful vector output but does not automatically preserve clearance, pricing, source references or all editability. Native packaging needs versioned geometry plus metadata and any permitted reference resources.

Defer arbitrary SVG import until a supported subset, unit handling, unsupported-feature reporting, sanitization and external-resource policy are defined. Do not silently flatten unknown content or fetch remote resources.

## 10. Delivery sequence under the existing Asset Designer epic

| Increment | User outcome | Principal work |
|---|---|---|
| 0 — Consolidate | Existing assets survive the expansion. | Inventory schemas, units, transforms, rendering consumers, persistence and tests. Write migration fixtures. Resolve resize/replacement and arc-stretch behavior. |
| 1 — Easy object creation | Create a recognizable, correctly sized asset without a reference drawing. | Promote visual presets and measurement-first creation; align shell controls; explicit resize behavior; contextual inspector; use-in-plan return path. |
| 2 — Compose an object | Build and arrange a custom multi-part object. | Parts tree, multi-select, grouping, alignment/distribution, duplicate/repeat, predictable selection and atomic history. |
| 3 — Richer 2D symbols | Draw details that closed polygons cannot represent cleanly. | Open lines/polylines, rounded-rectangle convenience, deliberate curve expansion, render/export parity and schema migration. |
| 4 — Reliable reuse | Reuse and refine assets across projects without ambiguous changes. | Usage visibility, duplication/variants, coordinated revision integration and native asset portability. |
| 5 — Advanced authoring | Handle recurring advanced requests supported by user evidence. | Persistent parametric templates, restricted vector import, cut/merge geometry, reusable graphic subcomponents or multiple named clearance zones. |

Do not put a full CAD constraint solver, unrestricted vector import or recursive asset assemblies on the critical path. Simple graphic groups are not the same feature as nested catalogue assemblies.

## 11. First integrated validation scenario

Use a custom bathroom vanity as the first end-to-end scenario. Its dimensions below are only a test fixture, not recommended construction dimensions.

A user starts from a sanitary preset, creates a 1,000 × 500 mm vanity, adjusts the basin detail, duplicates a visual part, aligns the parts, adds a planning clearance, chooses a back-centre placement point and a front direction, saves to the library, and places the object into an existing bathroom plan. They reopen it and see the same geometry. They can distinguish updating the shared asset from creating a separate variant.

This scenario tests preset discoverability, measurement entry, composition, semantic geometry, persistence and product integration. It is more informative than testing tools individually on an empty canvas.

### Acceptance examples

```gherkin
Scenario: Resize does not replace a custom footprint
  Given a scaled straight-sided non-rectangular asset without graphic details
  When I use Resize object
  Then the operation preserves the footprint's topology
  And the designer does not substitute a rectangle
  And one undo restores the previous design

Scenario: A group operation is one reversible edit
  Given several graphic parts are selected
  When I align their centres
  Then every eligible part is updated consistently
  And one undo restores all affected parts
  And a refused write does not leave a partially updated design

Scenario: Reference calibration is isolated
  Given an asset designer and a project plan are open
  When I calibrate the asset reference
  Then only eligible pending asset coordinates are converted
  And the plan calibration and plan geometry are unchanged

Scenario: A visual part does not change purchasing quantities
  Given one placed asset is counted in a project
  When I duplicate a graphic detail in its definition
  Then the illustration contains the extra detail
  And the project still counts one placed asset

Scenario: A saved approved plan remains reproducible
  Given an approved plan revision references a recoverable asset state
  When the current library definition changes
  Then that approved revision renders and exports the original asset state
```

## 12. Proposed quality gates

These are targets to validate, not existing measured results.

**Usability:** In a formative test, at least four of five first-time users should create a measured preset asset and place it in a plan without facilitator intervention. Observe where they confuse whole-object editing with part editing, or shared definitions with placed instances.

**Correctness:** Unit conversion, reference calibration, transforms and reloads preserve canonical geometry without presentation rounding. New geometry types have consistent bounds, hit testing, thumbnail rendering, plan rendering and export. Test reflected arcs and repeated undo/redo explicitly.

**Reliability:** Cancel creates no write; one gesture creates one history entry; grouped edits are atomic; external changes produce conflict/reload behavior; missing references are recoverable; schema migrations round-trip representative legacy assets.

**Accessibility:** Keyboard users can select parts and edit through the DOM hierarchy/inspector. Focus survives selection changes, deletion and error recovery. Essential actions have visible alternatives to keyboard modifiers. Verify in both host themes and narrow panes.

**Performance:** Establish a supported-device baseline using small and complex fixtures, for example 25 and 250 graphic elements plus a reference image. Treat approximately 60 fps during ordinary interactions as an engineering target on the chosen baseline, not a guarantee. Measure before adding a new rendering engine or expensive caching architecture.

**Integration:** New tools must be reachable in the mounted designer and tested through the library → designer → plan journey, not only in isolated component tests. Run the repository's build, lint, test and analysis gates after implementation; none were run for this concept review.

## 13. Source references

### Reviewed repository snapshot

All source URLs below are pinned to the reviewed commit.

1. Stack: https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/package.json
2. Existing epic and invariants: https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/docs/requirements/Asset%20designer.md
3. Shape model: https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/src/domain/asset/AssetShape.ts
4. Detail model: https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/src/domain/asset/AssetDetail.ts
5. Circular geometry: https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/src/core/geometry/CurvedPolygon.ts
6. Root and dimension behavior: https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/src/presentation/designer/AssetDesignerRoot.vue
7. Toolbar: https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/src/presentation/designer/DesignerToolbar.vue
8. Tool registration: https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/src/presentation/designer/tools/registerDesignerTools.ts
9. Selection model: https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/src/presentation/designer/selection/designerSelection.ts
10. Selection inspector: https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/src/presentation/designer/inspector/DesignerSelectionInspector.vue
11. Preset form: https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/src/presentation/designer/presets/AssetPresetForm.vue
12. Preset catalogue: https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/src/domain/asset/presets/catalogue.ts
13. Obsidian leaf context: https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/src/presentation/designer/AssetDesignerContext.ts

### Official technical documentation checked

14. Konva application-state persistence: https://konvajs.org/docs/data_and_serialization/Best_Practices.html
15. Vue/Konva persistence: https://konvajs.org/docs/vue/Save-Load.html
16. Vue/Konva undo/redo: https://konvajs.org/docs/vue/Undo-Redo.html
17. Vue/Konva Transformer integration: https://konvajs.org/docs/vue/Transformer.html
18. Transformer scaling behavior: https://konvajs.org/docs/select_and_transform/Basic_demo.html
19. Konva performance guidance: https://konvajs.org/docs/performance/All_Performance_Tips.html
20. Obsidian host styling: https://docs.obsidian.md/Reference/CSS%20variables/About%20styling
