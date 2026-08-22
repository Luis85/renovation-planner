# Design Slice 5: Canvas Rendering & Editor Shell

## Purpose

Get a Plan's already-persisted domain geometry (Increment 3, slice 4) onto the screen: a
Plan Editor `ItemView` that mounts an isolated Vue + Pinia app, a layered Konva stage driven
through `vue-konva`, a background image or PDF page under it, and a pannable/zoomable
viewport — with nothing yet editable.

This is the SDD's Increment 4 (§91), and its own success criterion is this slice's
contract:

> Persisted domain geometry renders independently from canvas coordinates.

Keeping this slice strictly read-only is deliberate. The render pipeline
(`Domain Spatial Object → Render Model → Vue Component → vue-konva → Konva Node`, §16) has
to be provably correct — a pure function of persisted geometry and viewport state — before
slice 6 adds pointer interaction, commands, and undo/redo on top of it. Validating the pipe
without a mutation path attached is the whole point of splitting these into two slices.

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
- Bases views (§13) — explicitly deferred, per the SDD and `docs/design/README.md`.
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

`BackgroundLayer` "should redraw rarely" (§18): it is not touched by the pan/zoom
transform's redraw path in the same way `ZoneLayer` is (its own `Layer` only needs a new
`Stage` transform applied, not per-shape re-render), and is a natural candidate for Konva's
`cache()` once a real background asset is in place.

### 4. Render pipeline: a persisted Zone on screen

The pipeline is exactly §16's diagram, made concrete for `Zone`:

```text
Zone (domain entity, slice 3)
        ↓  query service                — maps entity → flat read model at the boundary
ZoneDto (presentation read model)
        ↓  toZoneRenderModel()          — pure mapping, presentation-only, no mutation
ZoneRenderModel
        ↓  <ZoneShape :model :viewport> — Vue component
        ↓  worldToScreen() per point    — this slice (§ Interfaces & Contracts)
        ↓  <v-line :points :closed>     — vue-konva
        ↓
Konva Node (canvas pixels only — never read back as a geometry source)
```

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
itself takes a `ZoneRenderModel` and the current `Viewport`, converts every point through
`worldToScreen()`, and renders a closed `<v-line>` with fill/stroke resolved from theme
tokens (§7 below) — nothing it does writes back to `ProjectStore` or to a repository.

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

**Who owns that import flow is an open question this document does not close.** The SDD
does not say, and neither does any slice: slice 7 is the natural host (it already needs a
background to calibrate against) and slice 14's `noBackground` empty state already has an
"Import a plan" button that will need somewhere to hand off to. Both those slices name
the gap and defer to whoever resolves it. It is called out in all three places rather
than silently assumed, because a gap three documents each expect another to close is
exactly the kind that survives to implementation.

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

This slice is **read-only** against every repository slice 4 introduces:

- `ProjectStore` hydrates via `GetPlan` and `FindZonesByPlan` (§35 query architecture) —
  queries only, never a repository `.save()` call.
- The background asset (PNG/JPEG/PDF) is read via generic Vault file APIs
  (`vault.getResourcePath`, `vault.readBinary`), not through a slice-4 domain repository —
  it is a raw file read, not a domain entity load.
- No new Vault writes are introduced anywhere in this slice, including a Plan's background
  reference: reading an existing `PlanBackgroundRef` is in scope; writing one for the first
  time is not (see Design → §5, flagged assumption).
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
11. No Vault write occurs anywhere in this slice's code paths — `npm run check` (build,
    lint including the write-boundary and layer-dependency rules, coverage-thresholded
    tests, fallow) passes with this slice's code included.

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
- ADR-011 Configurable Geometry Sidecar Folder and Dedicated File Extension
- `docs/design/README.md` — slice map and shared conventions
