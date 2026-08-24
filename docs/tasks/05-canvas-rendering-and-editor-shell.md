---
type: Task
parent: "[[Plan editor and canvas]]"
order: 10
dependsOn:
  - "[[04-persistence-and-repository-layer]]"
status: Done
started: 2026-08-24
finished: 2026-08-24
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---
# Design Slice 5: Canvas Rendering & Editor Shell

## Purpose

Get a Plan's already-persisted domain geometry (Increment 3, slice 4) onto the screen: a
Plan Editor `ItemView` that mounts an isolated Vue + Pinia app, a layered Konva stage driven
through `vue-konva`, a background image or PDF page under it, and a pannable/zoomable
viewport — with nothing yet editable.

This is the SDD's Increment 4 (§91), and its own success criterion is this slice's
contract:

> Persisted domain geometry renders independently from canvas coordinates.

Keeping the **render pipeline** read-only is deliberate. `Domain Spatial Object → Render
Model → Vue Component → vue-konva → Konva Node` (§16) has to be provably correct — a pure
function of persisted geometry and viewport state — before slice 6 adds pointer
interaction, commands, and undo/redo on top of it. Validating the pipe without a mutation
path attached is the whole point of splitting these into two slices.

The one thing this slice writes sits outside that pipeline and does not weaken it:
`SetPlanBackgroundCommand` (§5 below) sets which file a Plan's background is, which is an
input the pipeline reads and never something the pipeline produces. Nothing rendered
here can write, and no geometry is mutated in this slice at all.

## Scope

### In scope

- The Plan Editor `ItemView`'s mount/unmount lifecycle: `createApp()` plus its own `Pinia`
  instance per view (§11–12), keyed to a specific Plan.
- Pinia scaffolding: `ProjectStore`, `EditorStore`, `WorkspaceStore` — their state shapes,
  and the persistent/ephemeral split (§14–15) they enforce.
- The Konva `Stage` and its seven fixed layers (§17), wired through `vue-konva`, including
  an empty `InteractionLayer` placeholder.
- The render pipeline that turns a persisted `Zone` into a read-only Konva shape.
- Background rendering: a PNG/JPEG rendered directly, a PDF page rendered via `pdfjs-dist`
  (§54), sourced from a Vault-relative path with no base64 embedding (§55).
- Setting that background in the first place: the Vault-file picker and
  `SetPlanBackgroundCommand` that produce a `PlanBackgroundRef` (see Design → §5). This
  slice defines the type, so it owns the command that makes one; slice 7 and slice 14
  both call it and neither reimplements it.
- Pan and zoom of the viewport, as a baseline camera interaction.
- Theme integration (Obsidian CSS variables, no hardcoded palettes, §84) and baseline
  accessibility (§85).
- The outer editor shell layout (§60): its five screen regions (toolbar, layers panel,
  plan canvas, inspector, status bar), as empty or read-only-content regions other slices
  fill in.

### Out of scope (covered by other slices)

- Any `EditorTool` (`SelectTool`, `DrawPolygonTool`, `PlaceAssetTool`, `MeasureTool`,
  `AnnotationTool`) and the `EditorTool` interface itself (§56–58) — slice 6.
- The Transformer, scale normalization, and persisting edited geometry (§20) — slice 6.
- `SnapService` (§21) — slice 6.
- Inspector panel behavior and the Inspector query pipeline (§59) — slice 6.
- Undo/redo, `CommandHistory`, transaction boundaries (§29–31) — slice 6.
- Calibration (§25) — slice 7. Before slice 7 exists, a Plan's background renders at a
  placeholder scale (see Design → Background Layer).
- Zone creation/editing/deletion via the UI (§26–28) — slice 8.
- Bases views (§13) — explicitly deferred, per the SDD and `docs/requirements/Architecture and Software Design.md`.
- Writing anything new to the Vault, including a Plan's background reference — see
  Persistence Impact.

## Dependencies

- **Slice 1 (Plugin Bootstrap & Composition Root)** — the `ItemView` registration pattern,
  the `revealView`/one-action-per-input convention, and the composition root that wires
  query services into a view's constructor.
- **Slice 2 (Core Primitives)** — `Point`, `Polygon`, `Transform` (§22–24). Slice 2
  explicitly excludes viewport transform from its own scope ("Core never sees a pixel"),
  so `worldToScreen()`/`screenToWorld()` and the `ScreenPoint` type are this slice's own
  contribution, built on slice 2's types — not math re-derived from elsewhere, and not
  math slice 2 provides.
- **Slice 3 (Domain Foundation)** — the `Zone` entity and its geometry value object.
- **Slice 4 (Persistence & Repository Layer)** — the `GetPlan` and `FindZonesByPlan`
  queries (§35) this slice's `ProjectStore` hydrates from, both declared there. This
  slice reads through those queries only; it introduces no new repository method and
  never calls a repository directly.
- **ADR-002 / ADR-011** — geometry sidecar shape and location (informs what a hydrated
  `Zone`'s geometry looks like, not how this slice persists anything).
- **ADR-003** — Konva as canvas renderer; this slice is where that decision is first built.
- **ADR-004** — Vue 3, isolated app per `ItemView`.
- **ADR-005** — Pinia as cache/working state, not source of truth.
- **ADR-009** — world coordinates in millimeters; this slice's viewport is the boundary
  ADR-009 names as the only place pixel conversion happens.

## Design

### 1. Plan Editor view lifecycle

The Plan Editor is per-plan, unlike the singleton `RenovationProjectView`: a user may
reasonably want two plans open in separate tabs at once (e.g. comparing Ground Floor and
First Floor). The view type is one constant; the open Plan is carried in Obsidian's own
per-leaf ephemeral view state, not in the view type:

```typescript
export const PLAN_EDITOR_VIEW = 'renovation-plan-editor';

interface PlanEditorViewState {
  readonly planId: string;
}
```

`getState()` / `setState()` are overridden so Obsidian's workspace layout (itself ephemeral,
rebuildable UI state, not the source of truth) remembers which Plan a leaf was showing
across an Obsidian restart:

```text
PlanEditorView extends ItemView

getState()  → { planId }
setState(s) → store s.planId, (re)hydrate ProjectStore if already open

onOpen()
 ├── read planId from current view state
 ├── resolve GetPlan(planId) + FindZonesByPlan(planId) via injected query services
 ├── create Pinia instance (createPinia())
 ├── hydrate ProjectStore, EditorStore, WorkspaceStore with the result
 ├── createApp(PlanEditorRoot).use(pinia).use(VueKonva)
 └── mount(this.contentEl.createDiv('renovation-plan-editor-view'))

onClose()
 ├── app.unmount()
 └── contentEl.empty()
```

`VueKonva` is installed on the app instance, not globally — each `ItemView`'s Vue app is
isolated (ADR-004), so a global `app.use` at plugin scope would leak `vue-konva`'s
registration across every future view whether it uses Konva or not.

Opening a specific Plan reuses the existing convention (`revealView`, slice 1) but needs to
match on `state.planId`, not just view type, since several Plan Editor leaves can coexist:

```typescript
// infrastructure/obsidian/workspace/revealPlanEditor.ts
// Same "one place decides what opening means" shape as revealView, extended to match
// on state — infrastructure/ still takes the view type as a string, never importing
// PLAN_EDITOR_VIEW from presentation/.
export async function revealPlanEditor(
  workspace: Workspace,
  viewType: string,
  planId: string,
): Promise<void>;
```

**This is a second function, and CLAUDE.md's "one action, every input" rule is what makes
that need justifying rather than assuming.** The rule's actual target is two entry points
that each decide what opening means — a ribbon and a command with their own activation,
which open a duplicate tab the moment a user uses both. That failure is about the number
of *deciders* per action, not the number of functions in the module, and every way of
opening a Plan Editor still lands on exactly one of them.

*Generalizing `revealView` with a matcher* was the alternative, and it is rejected on what
`revealView` can actually see: it matches with `getLeavesOfType(type)` and nothing else,
because that is all it needs, whereas matching a Plan means reading each candidate leaf's
`getState().planId`. A `revealView(workspace, type, match?)` would therefore make every
caller of the singleton case pay for a parameter that only one caller can supply, and its
body would branch on whether a matcher was given — which is the "tool-specific branching
inside the shared thing" shape slice 6 refuses for `ToolManager` for the same reason.

The two also want genuinely different behaviour, which is the deciding fact rather than a
preference: `revealView` exists to guarantee **one** leaf, and the Plan Editor's whole
premise is that several coexist (comparing Ground Floor against First Floor). One function
that both guarantees uniqueness and permits multiplicity guarantees nothing.

What the rule does buy, and what is therefore load-bearing here: the two share their
*mechanism* — find candidates, take the first or create one, `setViewState` only on a leaf
this call created, then `revealLeaf` — as one internal helper in this module, so
"`setViewState` only on a new leaf" is not a subtlety re-remembered per function. And a
third activation, whenever it arrives, extends one of these two rather than becoming a
third: the test is whether it needs to match on state, and that is a closed question.

Query-service access is constructor-injected from the composition root, exactly like
`RenovationProjectView` would be once it has data needs — `registerView(PLAN_EDITOR_VIEW,
(leaf) => new PlanEditorView(leaf, planQueryServices))`. The view never imports an Obsidian
repository directly; it only sees the query interfaces slice 4 defines.

### 2. Pinia store scaffolding

Three stores are this slice's responsibility. Two more are named by the SDD (§14) but not
built here.

```typescript
// presentation/stores/ProjectStore.ts
// The current Plan Editor's working copy of persisted data — always rebuildable by
// re-running the same queries. Never a write path: nothing here calls a repository.
interface ProjectStoreState {
  readonly project: ProjectSummaryDto | null;
  readonly plan: PlanDto | null;
  readonly zones: ReadonlyMap<string, ZoneDto>; // keyed by ZoneId, never Konva identity
}
```

```typescript
// presentation/stores/EditorStore.ts
// Editor-scoped ephemeral state (§15). This slice defines the SHAPE; it is inert until
// slice 6's tools start writing into it. activeToolId has no tool implementation yet —
// it exists as a typed slot so slice 6 does not have to touch this store's shape.
interface EditorStoreState {
  readonly viewport: Viewport;           // pan + zoom, see §5 below
  readonly activeToolId: ToolId | null;  // always null until slice 6
  readonly hoveredObjectId: string | null;
  readonly dragState: DragState | null;
  readonly temporaryPolygon: readonly Point[] | null;
}
```

```typescript
// presentation/stores/WorkspaceStore.ts
// Editor CHROME state: which shell regions are open/collapsed, and per-Konva-layer
// visibility toggles (the Layers panel, §60) — a pure rendering concern, not an edit.
interface WorkspaceStoreState {
  readonly layersPanelOpen: boolean;
  readonly inspectorPanelOpen: boolean;
  readonly layerVisibility: Readonly<Record<KonvaLayerId, boolean>>;
}
```

`SelectionStore` (selected domain IDs, marquee) and `InspectorStore` (the Inspector DTO
pipeline) are named here only because §14 lists all five stores together — their state
shapes and behavior belong to slice 6, which owns everything selection- and
editing-related.

Persistent-vs-ephemeral (§15), restated against these concrete fields:

| Persistent (Vault, via slice 4) | Ephemeral (Pinia only, this slice) |
| --- | --- |
| `project`, `plan`, every `ZoneDto` in `zones` | `viewport`, `activeToolId`, `hoveredObjectId`, `dragState`, `temporaryPolygon`, all of `WorkspaceStoreState` |

If a Plan Editor view is closed and reopened, `ProjectStore` is rebuilt from the same two
queries; nothing is lost because nothing canonical ever lived only in Pinia (ADR-005). Open
is the only moment this slice hydrates, because nothing here mutates a Zone. Slice 8 adds
the other moment — one `hydrate` action, re-run after every committed command, so the
canvas shows what was just written — and it re-uses this routine rather than adding a
second one.

### 3. Konva scene structure

One `Stage`, seven layers, fixed order (§17), each its own Vue component wrapping a
`vue-konva` `<v-layer>`:

```text
<v-stage>                     PlanCanvas.vue — owns Stage sizing + pan/zoom, see §5
 ├── <BackgroundLayer/>       §18 — imported plan, image or rendered PDF page
 ├── <ArchitectureLayer/>     future structural elements — empty in this slice
 ├── <ZoneLayer/>             renders persisted Zones — this slice's main content
 ├── <ConstructionLayer/>     future construction sections — empty in this slice
 ├── <AssetLayer/>            future placed assets — empty in this slice
 ├── <AnnotationLayer/>       future annotations — empty in this slice
 └── <InteractionLayer/>      empty placeholder — slice 6 populates it
```

Stage size is bound to its container via `ResizeObserver`, not a fixed size — the Plan
Editor fills its leaf. Every layer's Konva config sets `listening: false` in this slice:
there is no interactive tool yet to receive pointer events, and per §62's performance
rules, an inert hit graph on layers nothing yet interacts with is pure cost. Slice 6 turns
listening on selectively, per node, as tools arrive — it does not need to restructure this
layer list to do so.

`BackgroundLayer` "should redraw rarely" (§18), and under the content-Group transform
below that is true of **every** world-space layer, not just this one: a pan or zoom moves
the Group and re-renders no shape's points. What still makes the background the special
case is that its content changes only when the Plan's background does, so it is the
natural candidate for Konva's `cache()` once a real background asset is in place.

### 4. Render pipeline: a persisted Zone on screen

The pipeline is exactly §16's diagram, made concrete for `Zone`:

```text
Zone (domain entity, slice 3)
        ↓  query service                — maps entity → flat read model at the boundary
ZoneDto (presentation read model)
        ↓  toZoneRenderModel()          — pure mapping, presentation-only, no mutation
ZoneRenderModel
        ↓  <ZoneShape :model>           — Vue component; points passed through
        ↓                                 UNCHANGED, still world millimetres
        ↓  <v-line :points :closed>     — vue-konva, inside the content Group
        ↓
Konva Node (world mm in its own coordinate space; the content Group's
            position/scale is the whole pan/zoom/dpr transform — see below.
            Never read back as a geometry source either way.)
```

**Pan and zoom are the Stage's transform, not a per-point conversion.** An earlier
version of this pipeline had `ZoneShape` convert every vertex through
`worldToScreen()` with the reactive `Viewport` as an input. That is `O(total vertices)`
of JavaScript on **every pan and zoom frame**, and it re-derives on each one the single
affine transform Konva's own scene graph applies for free — a plan with a few hundred
zones drops frames on a drag that should cost nothing. It also contradicted the
concession two sections up, that `BackgroundLayer` "only needs a new `Stage` transform
applied": a Stage transform is not something one layer can have, so either every layer
got it and the zone points were transformed twice, or the background's exemption was
fictional.

So the transform is expressed **once**, on a single content `Group` that holds every
world-space layer:

```text
Stage                                   ← size bound to the container (ResizeObserver)
└── content Group
      x, y     = pan, in screen pixels
      scaleX/Y = zoom × devicePixelRatio
      ├── BackgroundLayer   ← world mm
      ├── ZoneLayer         ← world mm; ZoneShape hands ZoneRenderModel.points straight
      │                       to <v-line>, no per-point math anywhere
      └── … (transient/interaction layers, slice 6)
```

A `Group` rather than the `Stage` itself, because slice 6 needs somewhere to put nodes
that must **not** scale — `Konva.Transformer` handles, snap guides, vertex handles are
constant-size screen affordances — and that somewhere is a sibling of this Group, not a
child. Naming it now costs one line; retrofitting it means moving every layer.

Two consequences worth stating, since both are silent when got wrong:

- **`strokeScaleEnabled: false`** on every stroked world-space shape. Konva scales
  stroke width with the node, so a 1-pixel zone outline becomes 20 pixels at 20× zoom.
- **`worldToScreen`/`screenToWorld` do not go away**, and this is not a retreat from
  §24 — they are still the single declared home of the transform's math
  (Interfaces & Contracts), still what slice 6's `EditorPointerEvent` uses to turn a
  pointer's `ScreenPoint` into the `worldPoint` a tool reads, and still what anything
  needing genuine pixels calls. What changed is that **rendering** is no longer one of
  those callers. The Group's `x`/`y`/`scale` are derived from the same `Viewport` by the
  same module, so there is one definition of the transform, not two that can disagree.

```typescript
// presentation/editor/layers/zone/ZoneRenderModel.ts
interface ZoneRenderModel {
  readonly id: string;         // ZoneId, never a Konva node reference
  readonly zoneType: string;
  readonly status: string;
  readonly label: string;
  readonly points: readonly Point[]; // world millimeters, from Zone geometry
}

function toZoneRenderModel(zone: ZoneDto): ZoneRenderModel;
```

`ZoneLayer.vue` iterates `ProjectStore.zones` and renders one `ZoneShape` per entry, keyed
by `zone.id` — never by array index or Konva instance identity, so React/Vue-style
reconciliation stays correct if the zone list changes shape later (slice 6). `ZoneShape`
itself takes a `ZoneRenderModel` and renders a closed `<v-line>` from its world-millimetre
points directly, with fill/stroke resolved from theme tokens (§7 below) and
`strokeScaleEnabled: false`. It does **not** take a `Viewport` and does not call
`worldToScreen()`: pan and zoom are the content Group's transform, so a pan re-renders
nothing at all. Nothing it does writes back to `ProjectStore` or to a repository.

### 5. Background layer: images and PDF pages

Both source formats converge on the same Konva primitive: `<v-image>` needs an already
decoded raster (`HTMLImageElement | HTMLCanvasElement`), not a URL, so the loading step is
format-specific but the render step is not.

```text
PNG / JPEG                              PDF
    ↓                                     ↓
vault.getResourcePath(file)          vault.readBinary(file) → ArrayBuffer
    ↓                                     ↓
new Image(); img.src = ...           pdfjs-dist: getDocument(buf) → getPage(n)
    ↓                                     ↓
await img.decode()                   page.render({ canvasContext, viewport })
    ↓                                     ↓
    └──────────────→ HTMLCanvasElement / HTMLImageElement ←──────────────┘
                                 ↓
                    <v-image :image :x :y :scaleX :scaleY>   (BackgroundLayer)
```

The original PNG/JPEG/PDF file stays exactly where it is in the Vault; only its
Vault-relative path is referenced, per §55 — no base64 anywhere in this pipeline, including
in Pinia (a `BackgroundRenderModel` holds the resolved raster handle in memory for the life
of the view, not a data URI in any store).

**Placeholder scale before calibration.** Increment 4 (this slice) precedes Increment 5
(Calibration, slice 7) in the SDD's own roadmap, so a Plan can — and per the SDD's own
success criterion, must — render a background before it has been calibrated. Until slice
7 exists, a Plan without calibration data renders its background at a fixed placeholder
scale (1 image pixel = 1 world millimetre).

Where calibration lands when slice 7 arrives is worth stating precisely, because it is
easy to assume wrongly: it does **not** become a parameter of `worldToScreen()`. §24
fixes that transform's components as translation, zoom, rotation and device pixel ratio,
and calibration is none of them. What calibration fixes is `BackgroundRenderModel.
worldScale` — how many world millimetres one source pixel of *this Plan's background*
covers. Slice 7 additionally rescales every stored coordinate to match, so world units
remain genuine millimetres everywhere downstream and the viewport transform never learns
that calibration exists. Nothing in this render pipeline changes when slice 7 lands
except the value of `worldScale`.

**Assumption, flagged explicitly:** this slice assumes the Plan DTO already carries an
optional, nullable background reference —

```typescript
interface PlanBackgroundRef {
  readonly path: string;             // Vault-relative
  readonly kind: 'image' | 'pdf';
  readonly page?: number;            // pdf only
}
```

— matching the `PlanBackgroundRef` slice 3 declares on the `Plan` entity and slice 4
persists as `background-path`/`background-kind`/`background-page`. This slice reads it;
*setting it for the first time* (a file picker, copying the asset into the Vault,
persisting the reference) is a user-triggered write and is out of scope here (see
Persistence Impact).

**This slice owns that import flow.** It was previously left open across three
documents, each naming the gap and deferring to the others — which is precisely the
shape that survives to implementation, and did: slice 14 ships an "Import a plan" button
with nothing behind it. Ownership lands here rather than on slice 7 or 14 by the rule
that a type belongs with the code that produces it: this slice defines
`PlanBackgroundRef` and everything that reads one, so it owns the command that makes
one. Slice 7 *needs* a background; needing it is not owning it.

```typescript
// application/commands/plan/SetPlanBackground.ts
interface SetPlanBackgroundInput { planId: PlanId; background: PlanBackgroundRef }
type SetPlanBackgroundCommand = Command<SetPlanBackgroundInput,
  Result<Plan, ValidationError | ReferenceError | PersistenceError>>;
// Validates that the referenced file exists in the Vault and its kind is supported,
// then writes background-path/background-kind/background-page through slice 4's
// PlanRepository update path (frontmatter only — no sidecar write, so no barrier and
// no compensation: one file, one write). Publishes PlanBackgroundChanged on success.
```

The picker selects a file **already in the Vault**, and the command stores a reference
to it; nothing is copied. That keeps the whole flow inside `normalizePath` plus a
`getAbstractFileByPath` existence check, and it matches how a Vault-native plugin is
expected to behave — a user who wants a PDF in their vault puts it there, and Obsidian's
own import affordances handle getting it in. Importing from outside the Vault is
deliberately not in scope for any slice: it needs file-system access this plugin does not
otherwise take, and the Vault-file path covers the PRD's stated flow.

Dispatched through `CommandHistory` like every other user-triggered mutation, with a
`ReversibleSetPlanBackgroundCommand` adapter whose `undo()` restores the previous
`PlanBackgroundRef` (or `null`, for the first import). That is a **snapshot inverse**, and
it takes slice 6's *snapshot-inverse contract* rather than restating its obligations —
snapshot before the forward write, restore conditional on the version that write produced,
and no event re-emitted, since a background reference is one field on one note with no
cascade behind it. Obligation 3 (the compensated-sequence contract) does not apply: this
is a single-file write.

The conditional half is worth naming concretely because this slice is where it first
appears: the mechanism is slice 3's `PlanRepository.save` taking `expected` and
comparing-and-writing as one operation, so an undo presenting the version its own
`execute()` returned refuses with `plan.revision-conflict` — or
`plan.external-modification`, if the note was changed outside the plugin — rather than
overwriting a background someone set since, from another tab, another synced device, or by
hand. Undo passes the version `execute()` returned; it does not re-read to find one, which
would be the check-then-act this design rejects. An earlier draft of this section claimed
the undo was conditional without naming any mechanism capable of enforcing it, which was a
promise with nothing behind it — and the shared contract exists so the next slice cannot
make that promise without inheriting the mechanism.

Slice 14's `noBackground` empty state dispatches exactly this, and slice 7's
`CalibrateTool` requires it to have run — neither reimplements it, and neither is left
holding an action with no command behind it.

### 6. Pan and zoom

Viewport state lives in `EditorStore`:

```typescript
interface Viewport {
  readonly pan: Point;     // world-space origin under the screen origin
  readonly zoom: number;   // scale factor, screen px per world mm
}
```

Wheel-zoom (centered on the pointer) and click-drag-to-pan on the Stage background are
implemented here as a fixed, always-available **camera** interaction — not an `EditorTool`.
This is a deliberate scope call, made here rather than sourced: §57 lists `PanTool` among
the *Initial Editor Tools* governed by the `EditorTool` interface (§56), which is slice
6's Editor Tool Framework. Nothing in the SDD or the slice map assigns pan/zoom to either
slice, so this slice claims it — a baseline camera that works with no tool selected is
standard for this class of editor (comparable to Figma/Illustrator's always-on wheel-zoom
regardless of active tool), and the read-only view this slice must deliver needs one
before any tool exists to select. Slice 6's `PanTool` —
if built as a dedicated, selectable mode rather than dropped — would share this same
`Viewport` state and the same `worldToScreen()`/`screenToWorld()` calls; it would not
change how panning fundamentally works.

Every pointer-to-world conversion goes through this slice's own `screenToWorld()`
(defined below, over slice 2's `Point`/`Transform`), taking the current `Viewport` and
the Stage's device pixel ratio — no tool or component computes its own pixel math.
`Viewport` is not persisted: reopening a Plan Editor resets to a
computed "fit to background" (or a fixed default zoom if there is no background yet), since
the SDD gives no requirement to remember a per-plan camera position across sessions.

### 7. Theme and CSS integration

Konva draws to a `<canvas>`, so a Konva shape's `fill`/`stroke` needs a resolved color
string — `var(--text-normal)` cannot be written directly into a Konva config the way it can
into a stylesheet. The bridge: a small theme-token resolver reads the currently computed
values of the Obsidian CSS variables this plugin uses (`getComputedStyle` against the
view's own root element) into a plain object, re-resolved whenever Obsidian's theme changes
(the workspace `css-change` event). `ZoneShape` and `BackgroundLayer` consume that resolved
object, never a hardcoded hex value — satisfying §84 ("avoid hard-coded global palettes")
inside a rendering technology that cannot itself read CSS variables.

The outer shell (toolbar, layers panel, inspector, status bar regions) is ordinary DOM +
CSS, styled exactly like `styles/view.css` today: Obsidian variables only, following
`.renovation-planner-view`'s existing pattern.

### 8. Accessibility baseline

- **Keyboard-accessible controls** (§85): the Konva `Stage` itself is a `<canvas>` and is
  not keyboard-operable by default, and this slice adds no pointer tool that would need
  keyboard parity yet. The chrome around it (toolbar buttons, layers panel toggles) is
  ordinary focusable DOM. Zoom is additionally reachable via keyboard (`+`/`-`), not only
  the wheel, so the one interaction this slice does add is not mouse-only.
- **Visible focus**: rely on Obsidian's own focus-visible styling; nothing in this slice
  suppresses an outline.
- **Status not color-only**: `ZoneRenderModel.status` is rendered as a visible label
  alongside fill color, not as color alone — this is set now so slice 6 does not have to
  retrofit it once zones become interactive.
- **Alternative data access**: Bases views are deferred, but this slice does not preclude a
  future non-canvas list — `ProjectStore.zones` is a plain, queryable map, not something
  only the canvas can read.

### 9. Editor shell layout

The five regions from §60 are stood up as empty or read-only-content Vue components so
slice 6 fills in behavior without restructuring the shell:

```text
┌─────────────────────────────────────────────────────┐
│ Toolbar (empty — tool buttons arrive in slice 6)     │
├──────────────┬────────────────────────┬──────────────┤
│ Layers panel │                        │ Inspector    │
│ (real: layer │      PlanCanvas        │ (empty —     │
│ visibility   │   (this slice's main   │  slice 6)    │
│ toggles)     │      deliverable)      │              │
├──────────────┴────────────────────────┴──────────────┤
│ Status         │ Measurements         │ Save state   │
│ (plan name)    │ (zoom %, world coords│ (empty —     │
│                │  at pointer)         │  slice 13)   │
└─────────────────────────────────────────────────────┘
```

The status bar keeps §60's own three named regions — `Status / Measurements / Save
State` — rather than inventing a different split, because slice 13 mounts its save-state
indicator into the third of them by name. The Measurements readout is read-only
telemetry (`screenToWorld()` on the last known pointer position): it demonstrates the
viewport transform working without needing any editable state. Save State stays an empty
region here — there are no edits until slice 6 and no indicator until slice 13.

## Interfaces & Contracts

```typescript
// presentation/views/PlanEditorView.ts
export const PLAN_EDITOR_VIEW = 'renovation-plan-editor';

export interface PlanEditorViewState {
  readonly planId: string;
}

export class PlanEditorView extends ItemView {
  constructor(leaf: WorkspaceLeaf, queries: PlanEditorQueryServices);
  getViewType(): string;                 // PLAN_EDITOR_VIEW
  getState(): PlanEditorViewState;
  setState(state: PlanEditorViewState, result: ViewStateResult): Promise<void>;
  onOpen(): Promise<void>;
  onClose(): Promise<void>;
}

// The only application-layer surface this slice's presentation code depends on —
// concrete Obsidian repositories are wired at the composition root, not here.
// Both methods return slice 4's query Result verbatim: a missing Plan is ok(null),
// and a failed read is isErr. Flattening either into a bare `PlanDto | null` would
// make "no such plan" and "the vault read failed" indistinguishable, which is exactly
// the distinction slice 14's empty-state selectors and slice 17's error routing
// both branch on.
export interface PlanEditorQueryServices {
  getPlan(planId: string): Promise<Result<PlanDto | null, PersistenceError>>;
  findZonesByPlan(planId: string): Promise<Result<readonly ZoneDto[], PersistenceError>>;
}
```

**The read-model DTOs.** `PlanDto`, `ZoneDto`, and `ProjectSummaryDto` are
presentation-facing read models, and this slice is where they are declared
(`presentation/read-models/`). They are **not** slice 4's `PlanFrontmatterDTO` family:
those are shape-of-storage types that, per §37, never leave an Obsidian repository. Two
different things called "the Plan DTO" in one codebase is a real hazard, so the two
families are named apart — `*FrontmatterDTO` for storage, `*Dto` for presentation — and
the query services above are the boundary that maps a domain entity into the latter.

```typescript
// presentation/read-models/PlanDto.ts — flat, serializable, no domain methods
export interface PlanDto {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly background: PlanBackgroundRef | null;
  readonly layers: readonly string[];
}

export interface ZoneDto {
  readonly id: string;
  readonly planId: string;
  readonly name: string;
  readonly zoneType: string;
  readonly status: string;
  readonly points: readonly Point[]; // world millimetres, straight from Zone.geometry
}

export interface ProjectSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly status: string;
}
```

```typescript
// presentation/editor/viewport/Viewport.ts
export type { Point } from '@core/geometry/Point'; // re-exported from slice 2, never redeclared:
                                                    // a second structurally-identical Point would
                                                    // type-check everywhere and mean nothing

// A screen coordinate is a distinct, incompatible type from Point (always
// world millimeters, per ADR-009). Slice 2 deliberately never sees a pixel,
// so ScreenPoint is introduced here — the first slice that needs it — not
// in core/geometry. Slice 6 imports this same type rather than redefining
// it, so there is exactly one ScreenPoint in the codebase, not two
// coincidentally-shaped ones.
export interface ScreenPoint { readonly x: number; readonly y: number; readonly __brand: 'ScreenPoint'; }

// The only way to obtain a ScreenPoint from raw pointer/DOM coordinates. Without it
// the brand would be unconstructible outside worldToScreen, and every call site would
// reach for a cast — which is the same as having no brand.
export function screenPoint(x: number, y: number): ScreenPoint;

export interface Viewport {
  readonly pan: Point;     // world-space; see "Pan and zoom" above
  readonly zoom: number;
}

// The math is built here, on top of slice 2's Point/Transform — slice 2
// itself excludes viewport transform from its scope ("Core never sees a
// pixel"), so this module, not slice 2, owns worldToScreen/screenToWorld.
// This is also the ONE home for these two functions and for ScreenPoint:
// slice 6 imports them from here, and defines neither.
export function worldToScreen(point: Point, viewport: Viewport, dpr: number): ScreenPoint;
export function screenToWorld(point: ScreenPoint, viewport: Viewport, dpr: number): Point;
```

```typescript
// presentation/editor/layers/zone/ZoneRenderModel.ts
export interface ZoneRenderModel {
  readonly id: string;
  readonly zoneType: string;
  readonly status: string;
  readonly label: string;
  readonly points: readonly Point[];
}

export function toZoneRenderModel(zone: ZoneDto): ZoneRenderModel;
```

```typescript
// presentation/editor/layers/background/BackgroundRenderModel.ts
export type BackgroundRenderModel =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'raster';
      readonly image: HTMLImageElement | HTMLCanvasElement;
      readonly worldOrigin: Point;
      readonly worldScale: number; // world mm per source pixel; placeholder until calibrated
    };

export function loadBackground(ref: PlanBackgroundRef, vault: Vault): Promise<BackgroundRenderModel>;
```

```typescript
// presentation/stores — Pinia store IDs, so slice 6 extends rather than renames
export const useProjectStore   = defineStore('project', ...);
export const useEditorStore    = defineStore('editor', ...);
export const useWorkspaceStore = defineStore('workspace', ...);
// Named, not built here:
// export const useSelectionStore = defineStore('selection', ...);   — slice 6
// export const useInspectorStore = defineStore('inspector', ...);   — slice 6
```

## Persistence Impact

This slice is read-only against every repository slice 4 introduces **except one write**:
`SetPlanBackgroundCommand`, which this slice owns (Design → §5).

- `ProjectStore` hydrates via `GetPlan` and `FindZonesByPlan` (§35 query architecture) —
  queries only, never a repository `.save()` call.
- The background asset (PNG/JPEG/PDF) is read via generic Vault file APIs
  (`vault.getResourcePath`, `vault.readBinary`), not through a slice-4 domain repository —
  it is a raw file read, not a domain entity load.
- **The one write is a Plan's background reference.** `SetPlanBackgroundCommand` writes
  `background-path`/`background-kind`/`background-page` through slice 4's
  `PlanRepository.save`, conditional on the expected revision like every other write, and
  publishes `PlanBackgroundChanged`. Frontmatter only: no sidecar entry changes, so there
  is one file and one write, and neither slice 4's per-plan geometry lock nor a
  compensating sequence is involved. Its undo restores the previous `PlanBackgroundRef`
  (or `null`) presenting the revision `execute()` returned, per slice 6's rule for
  inverses. An earlier draft of this section declared the slice write-free while the
  Design section above assigned it this command — the two halves of one document
  disagreeing, which is the same failure that left the background import unowned in the
  first place.
- Nothing else in this slice writes. Rendering, hydration, pan and zoom touch no
  repository, and the write boundary stays where `WRITE_BOUNDARY` puts it: the command
  goes through `PlanRepository`, not through a view reaching for the Vault.
- Konva nodes hold no canonical data at any point (§16) — closing and reopening a Plan
  Editor discards the Stage and rebuilds it from the same two queries, with identical
  output, because nothing about a shape's position is stored anywhere but the Zone's
  persisted geometry and the current (ephemeral) `Viewport`.
- Pinia contents are fully rebuildable from the Vault at any time (ADR-005) — a crash or a
  forced Pinia reset loses no project data.

## Testing Strategy

Per §73–74 (Vue component tests, canvas adapter tests):

- **View lifecycle**: opening and closing a `PlanEditorView` repeatedly leaks no Vue app,
  Pinia instance, or Stage — mirrors the existing shape of
  `tests/plugin/registration.test.ts`, driven against the same `obsidian` module mock the
  suite already shares.
- **Render pipeline (adapter tests, not geometry tests)**: given a fixed `ZoneRenderModel`
  and `Viewport`, `ZoneShape` renders a `<v-line>` with the expected screen-space point
  list — asserting the adapter renders what it is given, per §74, not re-verifying
  `worldToScreen()`'s own math, which gets its own direct unit tests below.
- **`worldToScreen`/`screenToWorld` unit tests** (this slice's own responsibility, since
  slice 2 excludes viewport transform from its scope): table-driven over
  pan/zoom/dpr combinations, including the round-trip property
  `screenToWorld(worldToScreen(p, v, dpr), v, dpr) ≈ p`. No Konva, no Obsidian.
- **Store tests**: `ProjectStore` hydration from mocked query services; `EditorStore`'s
  viewport update actions call this slice's own transform functions with the right
  arguments rather than reimplementing them.
- **Background**: a PNG/JPEG fixture and a PDF fixture (rendered via `pdfjs-dist` in
  jsdom/a headless canvas) both resolve to a `BackgroundRenderModel` with a decoded raster
  handle, sourced from a Vault-relative path — no literal base64 string appears anywhere in
  a store or a render model, asserted directly.
- **Scene structure**: a test asserts all seven layers exist in §17's fixed order and that
  `InteractionLayer` is present and empty — the contract slice 6 builds against.
- **Theme**: a test asserts `ZoneShape`'s resolved fill comes from the theme-token resolver,
  not a literal color constant.
- **Manual/harness verification**: `npm run harness` for visual confirmation of the layered
  scene against Obsidian's real `app.css` in light and dark — faithful to Obsidian's default
  themes only, per the harness's documented limits (`CLAUDE.md`), not a substitute for
  checking against a real, community-themed vault via `npm run test-build`.
- **`SetPlanBackgroundCommand` tests** (application, in-memory repositories): a
  supported Vault file sets `background-path`/`background-kind`/`background-page` and
  publishes `PlanBackgroundChanged`; a path resolving to no Vault file is a
  `ReferenceError` and an unsupported kind a `ValidationError`, with nothing written in
  either case. Undo restores the previous `PlanBackgroundRef`, including `null` for the
  first import — the case an adapter treating `null` as "nothing to restore" fails while
  passing the replace-an-existing-background case.
- Enforcement of the write boundary and layer-dependency lint rules (`WRITE_BOUNDARY`,
  `no-restricted-imports` in `eslint.config.mjs`) is exercised by `npm run lint` as part of
  `npm run check` — this slice adds no exception to either rule.

## Definition of Done

1. `PlanEditorView` is registered under `PLAN_EDITOR_VIEW`; opening the same Plan twice
   reveals one leaf, and opening two different Plans opens two independent leaves, each
   with its own Vue app and Pinia instance.
2. Closing a Plan Editor leaf and reopening it leaves no leaked Vue app, Pinia instance, or
   Konva `Stage` — verified by a mount/unmount test.
3. A fixture Plan with fixture Zones (from slice 4's test vault) renders as Konva shapes
   whose on-screen positions derive solely from `ProjectStore`-hydrated render models and
   the current `Viewport` — no code path reads a Konva node's properties as a geometry
   source.
4. Rehydrating the same Plan twice (e.g., close/reopen) produces an identical set of
   rendered points for every Zone, with no residual state carried by Konva itself.
5. Panning and zooming changes on-screen shape position/scale only; the Zone geometry in
   slice 4's repository/sidecar is byte-identical before and after a pan/zoom session.
   **And it changes no shape's `points`**: a pan asserts that every `<v-line>`'s points
   array is reference-identical before and after, so the transform demonstrably lives on
   the content Group and not in a per-vertex conversion. Asserted this way rather than by
   timing, because the defect is structural and a frame-rate assertion is flaky on CI.
6. A background renders correctly from both a PNG/JPEG fixture and a PDF fixture (via
   `pdfjs-dist`), sourced by Vault-relative path, with no base64 string anywhere in the
   render path, a store, or persisted Plan data.
7. All seven Konva layers exist in the fixed §17 order; `InteractionLayer` is present,
   mounted, and empty, ready for slice 6.
8. `ScreenPoint`, `screenPoint()`, `worldToScreen()` and `screenToWorld()` are declared
   in exactly one module (`presentation/editor/viewport/`), and `Point` is re-exported
   from `core/geometry/` rather than redeclared — asserted by a check that no second
   declaration of either type name exists under `src/`, since two structurally
   identical brands would type-check everywhere and guarantee nothing.
9. Zone fill/stroke colors are resolved from Obsidian CSS variables at render time and
   change correctly when Obsidian's theme changes, without a code change or restart.
10. Zone status is visually distinguishable without relying on color alone.
11. `SetPlanBackgroundCommand` is the only code path in this slice that writes, and it
    writes only a Plan's three background frontmatter keys through `PlanRepository`: a
    test asserts that rendering, hydration, and a pan/zoom session leave every repository
    untouched, and that the command's own failure cases (a path resolving to no Vault
    file, an unsupported kind) write nothing at all.
12. Undoing a background import restores the previous `PlanBackgroundRef`, `null`
    included, and refuses if the Plan's background was changed by anything else in
    between — `plan.revision-conflict` for another tab, `plan.external-modification`
    for a hand edit that left the revision alone. Asserted directly, since an
    unconditional restore passes every single-writer test.
13. `npm run check` (build, lint including the write-boundary and layer-dependency rules,
    coverage-thresholded tests, fallow) passes with this slice's code included.

## Implementation Notes

Written after the fact, and only where the built thing differs from the design above or
where building it turned up something the design could not have known. Where this section
and the Design section disagree, **this one is what the code does**.

### Where Konva refused the design

The scene is not `Stage → content Group → layers`, because Konva will not build it:
`group.add(layer)` throws *"You may only add groups and shapes to groups"* — measured, not
reasoned — since a `Layer` owns a canvas and only a `Stage` may parent one.

So the viewport transform is bound to **each world-space layer's own config**, still from
one function (`viewportTransform`), still derived from `worldToScreen` so the scene and the
transform cannot drift, and still costing no per-vertex math. What the content Group was
actually FOR survives intact: slice 6 needs somewhere for nodes that must not scale, and
that somewhere is the `InteractionLayer`, which is deliberately the one layer the transform
is NOT bound to. `tests/presentation/editor/scene.test.ts` asserts exactly that split.

Konva also warns that a stage with seven layers exceeds its recommended 3–5. §17's list is
kept as-is: it is the SDD's structure, and §62's first performance rule ("separate static
and dynamic layers") is the reason to want real layers rather than groups. `Konva.showWarnings`
was considered and refused — it would also have hidden the warning that caught the
flat-points defect below.

### Deviations from the declared interfaces

- **`BackgroundRenderModel` has a third arm**, `{ kind: 'unavailable', reason }`, beside
  `none` and `raster`. A plan whose background file was deleted or is corrupt has to draw
  something honest, and one union renders all three states without a second error channel
  beside it — the same argument that keeps `ok(null)` and `isErr` apart in the queries.
- **`loadBackground` takes `BackgroundVault`**, spelled `Pick<Vault, 'getAbstractFileByPath'
  | 'getResourcePath' | 'readBinary'>`, rather than the whole `Vault`. A real `Vault`
  satisfies it, the contract cannot drift from Obsidian's own API, and a test supplies three
  members instead of a hundred.
- **`PlanEditorQueryServices` and its adapter live in `presentation/read-models/`**, not in
  the view file: the adapter PRODUCES the DTOs, and the rule is that a type belongs with the
  code that produces it. It gained a sibling the design did not foresee —
  `unavailablePlanEditorQueries()`, which REFUSES both reads. With settings unrecovered
  there is no query service to hand over, and the alternatives were a nullable dependency
  every caller branches on, or not registering the view at all — which would leave a
  restored Plan Editor leaf pointing at a view type Obsidian does not know.
- **`ToolId`, `DragState`, `ProjectStoreStatus` and `PlanEditorViewState` are declared but
  not EXPORTED.** The shapes are defined as the design asks; the exports are not, because an
  export with no consumer is dead code by this repository's own gate and "slice 6 will want
  it" is exactly the argument that gate refuses. Slice 6 exports each in the change that
  gives it a caller.
- **The stores expose less than they hold.** `setViewport` and `setLayerVisible` were built,
  used only by tests, and removed; `toggleLayer` is the Layers panel's whole surface. The
  four §15 slots that ARE exposed with no reader (`activeToolId`, `hoveredObjectId`,
  `dragState`, `temporaryPolygon`) carry per-line `fallow-ignore` comments, the same
  treatment `Zone.area()` gets in slice 3 and for the same reason.
- **`EditorContext` is one `app.provide`**, carrying the plan id, the query services, the
  vault slice, a theme-change subscription and a plan-change subscription. The last is what
  makes `SetPlanBackgroundCommand` visible on the canvas without the command knowing a
  canvas exists: it publishes `PlanBackgroundChanged`, the composition root turns the event
  bus into a per-plan callback (`createPlanChangeSource`), and the root re-runs the SAME
  hydrate routine that ran at open. Slice 8's "re-hydrate after every committed command" is
  this seam widened, not a second mechanism.
- **`loadPlan` and `savePlan` were extracted** once this slice gave the Plan command family
  a second member and `npm run analyze` reported the nine duplicated lines. `loadZone` had
  been the Zone side's version of the first since slice 3.

### What pdf.js actually cost — and why it was replaced immediately after

This slice bundled `pdfjs-dist` as a production dependency. **It no longer does**, and the
measurement is kept rather than deleted because the next dependency should be able to read
what this one cost.

Three facts held while the copy was ours, all measured, all recorded in `pdfRaster.ts` at
the time:

- The **legacy** build is required. The standard one constructs a `DOMMatrix` at module
  scope, so importing it under jsdom throws before a line of this plugin runs; the legacy
  build carries pdf.js's own Node polyfill hook, which lets one import path serve the suite
  and the plugin. In Obsidian the polyfill branch never executes.
- A plugin ships **one file**, so there is no `pdf.worker.js` for `GlobalWorkerOptions` to
  point at. pdf.js's documented escape hatch is `globalThis.pdfjsWorker`, which means parsing
  runs on the main thread — §63 lists PDF rasterization among the future worker workloads,
  and this is the constraint that would motivate it.
- `useWasm: false`, because pdf.js 6 loads its WebAssembly from a URL a bundled plugin has
  none of. The cost is decoding speed on image-heavy PDFs; vector floor plans use none of it.

The bundle went from roughly 60 KB to **2216 KB**, of which pdf.js alone was **1728 KB —
78%**. Because a plugin is one bundled `main.js`, that is parse cost on every Obsidian start
for every user, whether they ever open a PDF or not. That is what ADR-003 and §54 cost as
this slice built them.

**What replaced it**, in the increment straight after this slice was marked done: Obsidian's
own pdf.js, via the `@public` `loadPdfJs()`. The `obsidian` devDependency is pinned to
exactly `minAppVersion`, so the compiler gate already proved the API is promised at the
floor, and the library it answers is the same version this slice bundled (6.2.108, verified
against the installed app). The bundle is **488 KB**. `pdfjs-dist` moved to devDependencies,
where the legacy-build constraint still applies and the other two facts do not: the module
mock hands the suite a real pdf.js and pdf.js's own node path finds its worker beside
itself, while in Obsidian a real worker thread does the parsing — so §63's future-worker
note no longer has PDF rasterization as its motivating case. `useWasm: false` survived with
a different reason, written down where the flag is.

The gap that swap opens, and it cannot be closed here: the suite runs OUR pdf.js, production
runs Obsidian's. Same version today; nothing keeps them so. A live vault is the only place
the production path exists at all.

### Testing the canvas at all

jsdom implements no canvas, no `DOMMatrix`, no `Path2D`, and loads no images, so
`tests/helpers/canvas.ts` puts `@napi-rs/canvas` — prebuilt per platform, no build
toolchain, and the same package pdf.js's own Node support reaches for — behind jsdom's
`<canvas>` and `<img>`. An inert stub was built first and refused: a fake that accepts every
call and draws nothing is the fake kinder than the real thing this project has already paid
for once. What runs instead is real Konva building a real scene graph and real pdf.js
rasterizing a real page, and the background tests assert on **sampled pixels**.

Its honest limit, stated in the file: the pixels live in a backing canvas, not in the jsdom
element, so a test that wants to look at them asks `backingCanvas(el)`.

### Defects this slice's own checks caught

Recorded because each one shows which gate is load-bearing.

- `PDFDocumentProxy.destroy` does not exist in pdf.js 6; the loading TASK owns it. Called
  wrongly it threw inside `loadBackground`'s catch, turning **every successful PDF render
  into `unavailable/unreadable`**. Found by the test that asserts a sampled pixel rather
  than "it did not throw".
- Konva's `points` is a flat number array, not `Point[]`. Handed the latter it warns per
  vertex and draws nothing.
- Re-hydration dropped the store to `loading`, which unmounted the Konva stage and rebuilt
  it — the whole canvas flashing, and the camera position lost, because one background
  reference changed.
- `backgroundKindFor` treated `Plans/.pdf` as a PDF: the dotfile guard compared against the
  whole path's first character rather than the filename's.
- Three found only by **looking** (`npm run harness-shot`), every one of them green in the
  suite: the layers panel sized with `--size-4-18`, which is 72 pixels; a caption offset
  multiplied by the scale twice, putting three of four zone names off the top of the pane;
  and every zone type drawn the same grey, because the harness page applied its theme class
  after mounting and the editor resolved its palette when no `--color-*` existed.
- Three `aria-label`s on role-less `<div>`s in the status bar — a real
  `aria-prohibited-attr` violation, caught the first time
  `tests/harness/accessibility.test.ts` was pointed at a surface that actually draws
  something.

### Reviewing it inside Obsidian — the gap this slice shipped with

Every item in the Definition of Done above was verified by the suite and by
`npm run harness-shot`, and **none of them had been seen inside Obsidian**, because slices
3, 4 and 5 were all unreachable from the app: `CreateProjectCommand`, `CreatePlanCommand`
and `CreateZoneCommand` had no caller outside `application/`, so a vault held no project,
plan or zone note; `open-plan-editor`'s `checkCallback` required a plan note to be the
active file and therefore never appeared in the palette; and `set-plan-background` required
a Plan Editor that could not be opened. A human could install the plugin and see a settings
pane and one empty pane. The suite passing is exactly why that went unnoticed.

Closed in the increment after this slice by two things: `create-sample-project`
(`src/plugin/sampleProject.ts`) — scaffolding, loudly, seeding a project, a plan and five
zones through the real commands and then opening the editor on them — and `open-plan-editor`
becoming a plan picker over the Project Index with no active-file precondition.

**The walkthrough, which only a human in a vault can run.** `npm run test-build`, then in
Obsidian:

1. Create a project, a plan and at least two zones from inside Obsidian
   (`Create sample renovation project` does all three).
2. Open the Plan Editor for that plan (`Open plan editor` → pick it).
3. See §60's five shell regions: toolbar, layers panel, canvas, inspector, status bar.
4. See the zones drawn, each with its name and a status caption, with fills that differ by
   zone type and dash patterns that differ by status.
5. Toggle a layer off in the Layers panel and watch it disappear.
6. Pan by dragging; zoom by wheel **and** by `+`/`-`; watch the zoom percentage and the
   world-millimetre pointer readout in the status bar.
7. Set a **PNG** background through `Set plan background` and see it under the zones.
8. Set a **PDF** background and see the page rendered — the one thing only a vault can
   prove, now that production uses Obsidian's pdf.js and the suite uses ours.
9. Switch Obsidian's theme and confirm the zone colours follow **without a reload**.
10. Open two different plans in two tabs at once; confirm each has its own camera, and that
    opening the same plan twice reveals one leaf rather than two.
11. Close a Plan Editor tab and reopen it; confirm the zones render identically.
12. Restart Obsidian and confirm each Plan Editor leaf reopens onto the plan it was showing.

Anything on that list which does not work is a slice 5 defect, not a later slice's work.

### Coverage

Measured 99.66 / 98.64 / 99.78 / 99.81. **Nothing ratcheted**, and that is the policy
working: rounded down, this increment measures exactly the floors already in force.
`vitest.config.ts` carries the numbers and names every remaining uncovered arm.

## References

- SDD §11 Workspace Views
- SDD §12 Vue Mounting Strategy
- SDD §13 Bases Integration (noted only as explicitly deferred; not designed here)
- SDD §14 State Management
- SDD §15 Persistent vs Ephemeral State
- SDD §16 Spatial Rendering Architecture
- SDD §17 Konva Scene Structure
- SDD §18 Background Layer
- SDD §19 Interaction Layer (existence only; detailed content is slice 6's)
- SDD §35 Query Architecture, §80 Naming Conventions (`FindZonesByPlan` example)
- SDD §54 Document Import
- SDD §55 Asset Handling
- SDD §60 UI Layout
- SDD §62 Performance Architecture (static/dynamic layer separation, hit-graph cost)
- SDD §84 CSS and Theme Integration
- SDD §85 Accessibility
- SDD §91 Increment 4 — Canvas (success criterion this slice fulfills)
- ADR-002 JSON Sidecar for Plan Geometry
- ADR-003 Konva as Canvas Renderer
- ADR-004 Vue 3 for Plugin UI
- ADR-005 Pinia for Presentation State
- ADR-009 World Coordinates in Millimeters
- ADR-011 Project-Scoped Geometry Sidecar Folder and Dedicated File Extension
- `docs/requirements/Architecture and Software Design.md` — slice map and shared conventions
