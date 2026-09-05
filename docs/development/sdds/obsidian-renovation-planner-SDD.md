# Software Design Document
## Renovation Planner

**Status:** Revised draft  
**Version:** 0.2 · 2026-09-05 (0.1 was the document as received)  
**Product Type:** Obsidian Community Plugin  
**Primary Language:** TypeScript  
**UI Stack:** Vue 3 · Pinia  
**Build Tool:** Vite  
**Test Framework:** Vitest  
**Rendering:** Konva · vue-konva  
**Persistence:** Obsidian Vault · Markdown · YAML Properties · JSON Sidecars (`.rpgeo`)  
**Architecture Style:** Modular · Layered · Domain-Oriented · Local-First · Event-Aware

---

## Revision 2026-09-05

Version 0.1 was written before a line of code existed. This revision brings the document level
with three things that have happened since, and says which of them decides a disagreement:

1. **Three design packages under [`docs/user-experience/`](../../user-experience/)** now specify
   what the user SEES: the editor ([M00–M17](../../user-experience/renovation-planner-editor-specs/README.md)),
   the project overview and details ([P00–P07](../../user-experience/renovation-planner-project-specs/README.md))
   and the asset library ([AL00–AL11](../../user-experience/asset-library-delivery/README.md)),
   with a [journey catalogue](../../user-experience/user-journeys/README.md) extracted from all three.
   A package is the authority for the user-facing behaviour it describes. This SDD is the
   authority for how that behaviour is BUILT, and the PRDs in `docs/product/prds/` for what the
   product IS. Where a package's proposal is not yet adopted, the
   [adoption ledger](../../reviews/2026-09-05-design-package-adoption.md) says so, and this
   document does not describe it as shipped.
2. **Seventeen accepted ADRs** in [`docs/development/adrs/`](../adrs/), seven of them taken after
   0.1 and four of them refining sentences 0.1 made (§39, §40, §51, §11). Their refinements are
   now folded into the sections they refine; each ADR remains the record of WHY. ADR-009, ADR-011
   and ADR-012 each say "the SDD stays verbatim as received" — true when written, and this revision
   is where that stopped being the policy.
3. **The WP0 model consolidation**
   ([`docs/development/consolidation/2026-09-editor-model-consolidation.md`](../consolidation/2026-09-editor-model-consolidation.md))
   inventoried every implemented entity, DTO, mapper, command and query against the homeowner
   vocabulary, and produced ADR-0016 and ADR-0017 plus six deferred decisions with triggers. §94
   and §97 restate its conclusions; the report holds the evidence.

**Section numbers are stable identifiers.** They are cited by number from `CLAUDE.md`, from the
ADRs, from `docs/` notes and from docblocks throughout `src/` — on the order of fifteen hundred
citations. No section in §1–§93 is renumbered or retitled by this revision; content changes
inside them, and everything new is appended as §94 onward. A section whose 0.1 content is
superseded says so in place rather than disappearing.

**What this document deliberately does not carry:** slice status, counts of things `src/`
already counts, and dated measurements. Those live in
[`docs/development/agent-guide-increment-history.md`](../agent-guide-increment-history.md),
`docs/tasks/` and `CLAUDE.md`, which are re-run; a status sentence here would be one nothing
re-runs.

---

# 1. Purpose

This Software Design Document defines the technical foundation and target architecture of the Renovation Planner.

The system is an Obsidian plugin for spatially planning and managing renovation projects. It is
**not a CAD application** and is not designed as one: its user is a private homeowner with little
or no CAD experience, and the plan is a navigational and planning surface over the renovation
project rather than a drawing for its own sake. The homeowner's mental model, which every surface
reinforces and which §94 and §97 map onto the domain, is:

```text
PROPERTY → SPACE → EXISTING STATE → CHANGE → WORK → PLANNED STATE
```

It combines:

- spatial planning
- floor and site plan visualization
- renovation zones (presented as Rooms and Areas)
- construction sections
- assets and materials
- quantity calculation
- cost planning
- trades
- work packages
- tasks
- procurement
- scheduling
- project documentation

The architecture must support the product vision while keeping the implementation maintainable, testable, portable, and independent from individual UI or rendering technologies.

---

# 2. Architectural Goal

The central architectural principle is:

> The Obsidian Vault is the persistent source of truth, while Vue, Pinia, and Konva are replaceable presentation and interaction technologies.

The system must avoid coupling domain logic to:

- Obsidian API classes
- Vue components
- Pinia stores
- Konva objects
- browser DOM structures

Dependency direction:

```text
UI
 ↓
Application
 ↓
Domain
 ↓
Core
```

Infrastructure implements interfaces defined by inner layers.

```text
Infrastructure
      ↓
Application Ports
      ↓
Domain
```

---

# 3. Design Principles

## 3.1 Local First

All project data is stored locally inside the user's Obsidian Vault.

Core functionality must not depend on:

- remote databases
- SaaS APIs
- cloud accounts
- telemetry services

## 3.2 Markdown Native

Human-readable project entities should be represented as Markdown files wherever practical.

## 3.3 Domain First

A `Zone` is not a Konva polygon.

A `WorkPackage` is not a Markdown file.

A `Requirement` is not a Pinia object.

These technologies are representations of domain concepts.

**And a domain concept is not a UI label.** The user reads *Room, Area, Floor, Wall, Reference
plan, Work*; the domain and the vault keep *Zone, Plan, calibration*. The two vocabularies meet in
one tested projection (§94), never in a rename and never in a persisted discriminator.

## 3.4 Framework Independence

Core modules use plain TypeScript.

Prohibited in Domain/Core:

```text
vue
pinia
konva
vue-konva
obsidian
DOM APIs
```

## 3.5 Explicit State Changes

Business-changing operations should be represented through commands.

This provides a foundation for:

- undo/redo
- validation
- event generation
- persistence
- testing
- auditability

## 3.6 Derived Data over Duplicate Data

Values that can be reliably calculated should not be stored redundantly unless required for overrides or historical snapshots.

## 3.7 Progressive Complexity

The MVP should remain simple. In domain terms:

```text
Project
→ Plan
→ Calibration
→ Zones
→ Assets and Requirements
→ Quantities
→ Costs
```

In the user's terms, the same path is *create a project (a floor plan is optional) → add a room,
or set up a reference plan and trace over it → attach materials → see what they cost*. A user
never has to produce a complete floor plan, and starting a project without one is a valid state
rather than an error (P01).

---

# 4. Technical Context

The plugin runs inside Obsidian (1.13.0 is the floor, pinned exactly in `package.json`).

Primary integration surfaces:

- plugin lifecycle
- workspace views, each carrying its own per-leaf **view state** (`getState`/`setState`), which
  is where a view's subject — the open project, plan or asset — lives (§95)
- commands and the ribbon
- Vault API and `FileManager`
- metadata cache
- `registerExtensions`, for the `.rpgeo` sidecar (§39)
- `loadPdfJs()`, Obsidian's own PDF.js, for PDF reference plans (§54)
- declarative settings (`getSettingDefinitions`)
- `getLanguage()`, the only source of the UI language (§102)
- Bases views (planned, §13)

---

# 5. Technology Stack

What is installed is decided by `package.json`; this section says why each entry is there and
names what 0.1 listed that has NOT arrived. A dependency arrives with its first real use, because
`npm run analyze` fails on one nothing imports.

## Core Runtime

```text
TypeScript
```

## Host Platform

```text
Obsidian
```

## UI

```text
Vue 3
Pinia
```

`@vueuse/core` (listed in 0.1) is not installed; nothing has needed it.

## Rendering

```text
Konva
vue-konva
```

`konva` is `vue-konva`'s peer dependency and is named in `.fallowrc.json` for that reason:
`src/` never imports it directly.

## Validation

```text
zod
```

## Identity

```text
ulid
```

## Financial Calculations

```text
decimal.js
```

## Geometry

```text
custom geometry-core (src/core/geometry)
```

`clipper2-ts` and `rbush` are not installed. Their sections (§27, §28) stand as the design for
when boolean operations or a spatial index are first needed.

## Date Handling

Nothing. `dayjs` arrives with scheduling (§53), which does not exist yet.

## Document Handling

Nothing bundled. PDF rendering goes through Obsidian's own `loadPdfJs()`; `pdfjs-dist` is a
**devDependency** for the suite only (§54). `pdf-lib` is not installed.

## Testing and gates

```text
vitest · @vue/test-utils · jsdom · @napi-rs/canvas (a real rasterizer behind jsdom's <canvas>)
axe-core (accessibility, §85) · playwright-core (harness captures)
eslint + eslint-plugin-obsidianmd · oxlint · fallow · lightningcss (the colour gate, §84)
```

`CLAUDE.md` is the authority on what each gate refuses and what each cannot see.

---

# 6. High-Level Architecture

```text
┌──────────────────────────────────────────────────────────────────┐
│                            Obsidian                              │
│                                                                  │
│  Workspace views (per leaf, with their own view state)           │
│   Renovation project · Plan editor · Asset library · Asset       │
│   designer · (.rpgeo sidecar view)          Bases views (planned)│
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
                       Presentation Layer
                               │
                   ┌───────────┴────────────┐
                   │                        │
                 Vue 3                   Pinia
                   │
                   ▼
              Editor runtime  (tools · selection · history · snapping)
                   │
               vue-konva
                   │
                 Konva
                   │
             Canvas / DOM

──────────────────────────────────────────────────────────────────

                       Application Layer

                       Commands / Queries
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                 │
             ▼                 ▼                 ▼
         Reference           Cost           Change sources
         integrity          engine          and events
             │                 │                 │
             └─────────────────┼─────────────────┘
                               ▼
                            Domain

──────────────────────────────────────────────────────────────────

                          Core Layer

                Geometry · Units · Money · Derived values
                IDs · Results · Errors · Events

──────────────────────────────────────────────────────────────────

                     Infrastructure Layer

                 Obsidian Repositories · Project Index
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
           Markdown          .rpgeo         Plugin data
           Properties       Sidecars       (settings, continue
                                             context, markers)
```

---

# 7. Architectural Layers

## 7.1 Core Layer

Generic technical concepts independent of renovation domain.

```text
core/
├── geometry/
├── units/
├── money/
├── derived/       ← DerivedValue<T> (§52)
├── identity/
├── events/
├── errors/
└── result/
```

## 7.2 Domain Layer

Renovation-specific business rules. What exists and what is reserved:

```text
domain/
├── project/          ✓
├── plan/             ✓  (presents as Floor — ADR-0017)
├── zone/             ✓  (presents as Room or Area — ADR-0016)
├── asset/            ✓  (vault-wide catalogue entry, with an optional shape — ADR-0014)
├── asset-price/      ✓  (project-scoped price override, a separate entity)
├── requirement/      ✓
├── cost/             ✓  (quantity engine and cost pipeline)
│
├── site/                 reserved
├── construction-section/ reserved
├── trade/                reserved
├── work-package/         reserved
├── task/                 reserved
├── procurement/          reserved
├── supplier/             reserved
├── quote/                reserved
├── schedule/             reserved
├── document/             reserved
├── risk/                 reserved
└── decision/             reserved
```

**Deliberately NOT modules, by decision rather than omission:** `Room`, `Floor`, `Building`,
`Property` (ADR-0016, ADR-0017 — projections, not entities), and the Existing/Planned/Work state
model, walls and openings, and evidence links, each of which waits on a deferred ADR with a
named trigger (§89, §97). A module the SDD draws and Git cannot hold is created when its first
entity arrives.

Each module may contain:

- entities
- value objects
- domain services
- domain events
- business rules (the prose versions live in `docs/product/business-rules/`)
- error catalogues

## 7.3 Application Layer

Coordinates use cases.

Responsibilities:

- loading entities
- invoking domain logic
- validating operations
- calling repositories through ports
- publishing events and exposing change sources
- coordinating multi-file write sequences (the ledger and its recovery)
- guarding reference integrity on delete
- returning `Result`s to the UI

```text
application/
├── commands/        (project · plan · zone · asset · asset-price · requirement)
├── queries/
├── ports/           (repositories, sidecars, index, logger, probes, versioning)
├── events/          (change sources a surface subscribes to)
├── event-handlers/  (the recalculation cascade)
├── reference/       (delete resolution, locks, interrupted-sequence recovery)
├── editor/          (WriteLedger, asset design)
├── errors/          (exception mapping, guardAgainstThrowing)
└── continueContext  (what Resume remembers — §95)
```

## 7.4 Infrastructure Layer

Concrete implementations for external concerns.

```text
infrastructure/
├── obsidian/
│   ├── repositories/   (note ⇄ entity, sidecar stores, keyed queues, paths)
│   ├── vault/          (file change adapter, file probe)
│   ├── workspace/      (revealView, revealPlanEditor, revealAssetDesigner,
│   │                    navigateToProject, openNote, theme changes)
│   ├── plugin-data/    (continue context, sequence markers)
│   └── settings/       (data.json door)
├── persistence/
│   ├── dto/            (Zod schemas per note type and sidecar)
│   ├── mappers/
│   ├── index/          (project index, vault change adapter, echo window)
│   ├── migration/
│   └── in-memory/      (test doubles that honour the same ports)
└── logging/
```

## 7.5 Presentation Layer

One isolated Vue app per workspace view (§12). Contains:

- Vue components and Pinia stores
- workspace `ItemView` subclasses and their per-leaf context
- the editor runtime: tools, selection, command history, snapping, viewport, scene layers
- read models (DTOs the views consume, including the homeowner projections of §94)
- the Inspector, dialogs, modals, notices, empty states, error surfacing
- the i18n catalogue (§102)

```text
presentation/
├── views/          (Renovation project surface, plan editor and sidecar views, forms)
├── editor/         (plan editor: shell · tools · layers · inspector · save-state · viewport)
├── designer/       (asset designer)
├── library/        (asset library)
├── read-models/
├── stores/
├── dialogs/  modals/  notices/  emptyStates/  errors/  references/
├── components/  composables/
└── i18n/
```

`src/prototypes/` sits inside `src/` and outside this layering: harness-only mocks, importable
by nothing (`CLAUDE.md` carries the one-way-door rule and its two checks).

---

# 8. Dependency Rule

Valid:

```text
Presentation
     ↓
Application
     ↓
Domain
     ↓
Core
```

Valid:

```text
Infrastructure
     ↓
Application Ports
```

Invalid:

```text
Domain
     ↓
Obsidian
```

Invalid:

```text
Geometry Engine
     ↓
Konva
```

Invalid:

```text
Cost Engine
     ↓
Pinia
```

`src/plugin/` is the composition root and the only layer that may reach all of the others; it is
also the only place anything is registered with Obsidian (a check, `registration-locality`, not
a sentence). The rule is enforced by per-directory `no-restricted-imports` in
`eslint.config.mjs`, which also bans `vue`, `pinia`, `konva` and `obsidian` by name in `core/`,
`domain/` and `application/` (§76).

Two corollaries: a type lives with the code that PRODUCES it, never with its consumer; and
nothing writes to the vault outside `infrastructure/` (§41).

---

# 9. Plugin Bootstrap

The plugin entry point should remain small.

```text
RenovationPlannerPlugin

onload()
 ├── load settings (through settingsFrom — data.json is a trust boundary)
 ├── build the composition root
 ├── register workspace views (§11) and the .rpgeo extension
 ├── register commands and the ribbon button
 ├── register vault listeners → project index
 └── rebind open views when settings are saved

onunload()
 ├── stop listeners
 ├── dispose services
 └── release window.Konva, only while it is still the one this load claimed
```

No domain logic belongs in the plugin entry point. Every detached door — ribbon, command,
modal — goes through one `runDetached` step that maps, logs and notifies a fault (§66).

---

# 10. Dependency Composition

Dependencies are composed centrally.

```text
CompositionRoot

├── repositories and sidecar stores
├── project index
├── application commands and queries
├── change sources
├── reference-integrity services
├── settings
└── per-view dependency bundles
```

A settings save builds a new root and **rebinds every open view** to it, which remounts each
view's Vue tree. That is why a view's subject lives in Obsidian's view state and not in Pinia
(§14, §95).

---

# 11. Workspace Views

Four surfaces ship, plus one registration that draws no Vue root. Each surface has a design
authority under `docs/user-experience/`, and each carries its subject in Obsidian's own per-leaf
view state, validated on restore rather than cast (a workspace layout is a file the user can
edit).

| Surface | Multiplicity | View state | Design authority |
|---|---|---|---|
| **Renovation project** | singleton (ribbon + command) | `{ projectId }`; `''` is the list | P00–P07. Two states: a project LIST that is a launcher (search, Resume, active and completed groups) and a DETAIL state per project (name, status, currency, plans, project prices, note access) |
| **Plan editor** | one per plan | `{ planId }` | M00–M17. §60's shell regions around the Konva stage |
| **Asset library** | singleton | `{ assetId, expanded }` | AL00–AL11. Category shelves and a right inspector over the vault-wide catalogue |
| **Asset designer** | one per asset | `{ assetId }` | ADR-0015; the editor package's component library and the archived library specification. Shares the editor's gesture surface and tool context |
| Geometry sidecar view | per `.rpgeo` file | — | none; it exists so `registerExtensions` has a view to name |

The Plan editor and the Asset designer were decided as separate view TYPES rather than modes of
the project view (ADR-0015 records why the code took that path over an earlier note that chose
otherwise). A view type is data — Obsidian persists it in the layout and binds hotkeys to the
command beside it — so none of these ids is renamed.

**Superseded:** 0.1's "Future: Budget, Schedule, Procurement, Dashboard" views. The workspace
PRD's seven-item navigation is not built and not designed. What the packages specify instead:
the project detail state's three guided entries (*Describe your renovation*, *Start with a plan*,
*Set project prices* — a design proposal, §100) and the editor's three perspectives (Plan /
Renovate / Review — proposed, §96). Rooms, work, budget and schedule arrive with their own domain
increments as sections or entries, not as views. Cross-project dashboards are not a direction.

Views should be mounted only when visible where practical.

---

# 12. Vue Mounting Strategy

Each Obsidian view receives an isolated Vue app.

```text
Obsidian ItemView
      │
      ▼
createApp()
      │
      ├── Pinia (one per app)
      └── <Surface>Root.vue
```

Unmount when the Obsidian view closes. Nothing outside a view knows it is Vue.

Two consequences worth stating. A REBIND (§10) remounts the whole tree, so any selection or
subject held in Pinia would be lost on a settings save — subjects live in view state. And the
count of Vue ROOTS is not the count of REGISTRATIONS: the geometry sidecar view is registered
and mounts none.

---

# 13. Bases Integration

Bases is the alternative, non-canvas route to every spatial object and catalogue entry
(principle 5 in `PRODUCT.md`; editor principle 10). Decided: *the alternative list route is a
Bases view*. Undecided, and recorded as such in `docs/issues/`: what has to ship for the
catalogue's Bases access to count as reachable.

Potential custom Bases views:

- Renovation Plan
- Budget
- Assets
- Procurement
- Schedule
- Risk

No Bases view is registered yet, and none replaces a plugin surface: the library does not
replace Bases, and Bases does not replace the library (AL decision D12).

No separate Bases-specific domain model.

---

# 14. State Management

Pinia manages UI state within one view's Vue app. Pinia is not the persistent source of truth,
and it is not where a view's SUBJECT lives either.

Four kinds of presentation state, and who owns each:

| State | Owner | Survives |
|---|---|---|
| Which project / plan / asset a leaf shows | **Obsidian view state** (`getState`/`setState`) | rebind, restart, layout restore |
| Entities hydrated for display, selection, tool, history, save state | Pinia stores (`ProjectStore`, `EditorStore`, selection, save-state, inspector, `AssetLibraryStore`, `AssetSelectionStore`, `RenovationProjectStore`, `ProjectDetailStore`, `WorkspaceStore`) | the leaf's life |
| Search text, group expansion, scroll, focus target, guidance visibility | a leaf-local UI snapshot | Vue remounts; never written to a note |
| An unsaved field draft and its field errors | form state bound to ONE entity id and ONE baseline version | selection change only through the draft guard (§101) |

Reads carry a **generation ticket**: a result for an earlier selection is dropped, so quickly
switching between two assets or two projects never shows the first one's late answer under the
second (`ticketedSection`, `single-flight`).

---

# 15. Persistent vs Ephemeral State

Persistent (the vault):

- project
- plan (with its background reference and calibration)
- zone (Room or Area) and its geometry
- asset, and its shape
- asset price override
- requirement (calculated and overridden figures)
- reserved: construction section, work package, cost item, evidence link

Persistent (plugin data, outside the vault's notes):

- settings (`data.json`, through `settingsFrom` both ways)
- the Continue context — one global last target, project and optional plan (§95)
- sequence markers for interrupted multi-file writes (§42)

Per-leaf, host-owned:

- view state: the leaf's subject

Ephemeral:

- hover
- context menu
- drag state
- draft geometry (an unfinished room is UI state and is never persisted — spec §68)
- selection marquee
- active tool and perspective
- command history (the resulting entity state persists; the history does not)

Settings:

- units
- default projects folder (where a NEW project's folder is created; an existing project's folder
  derives from where its `Project.md` sits — ADR-0013)
- library folder (informational plus a migration action; never a bare control — `CLAUDE.md`)
- default currency
- verbose logging
- diagnostics report action

---

# 16. Spatial Rendering Architecture

```text
Domain Spatial Object (Zone)
        ↓
Read model (ZoneDto → SpatialRecordDto: kind room|area, derived area)
        ↓
Vue Component
        ↓
vue-konva
        ↓
Konva Node
```

Interaction:

```text
Pointer Interaction
        ↓
Editor Tool
        ↓
Application Command
        ↓
Domain Change
        ↓
Query-based refresh (never a store mutated as a second truth)
```

Konva objects are never written directly to the Vault.

---

# 17. Konva Scene Structure

```text
Stage
│
├── BackgroundLayer      (the reference plan — §18)
├── ArchitectureLayer    (walls and openings, reserved — §97)
├── ZoneLayer            (Rooms and Areas)
├── ConstructionLayer    (reserved)
├── AssetLayer           (reserved for placements)
├── AnnotationLayer      (measurements, notes, markers)
└── InteractionLayer     (§19)
```

These are RENDER layers. The layer list the user sees (`LayerList`, §60) is a presentation
catalogue keyed onto them — *Reference plan* and *Rooms* today; *Planned changes, Notes, Work
markers, Material markers, Photo pins, Review markers* in the design — and each row states
whether it is `available` or `supported-empty`, never inventing a count. **Layers are visibility,
not ownership**: hiding *Work* hides its visualization and deletes nothing. **Existing and
Planned are not layers** (§97).

---

# 18. Background Layer

Contains the **reference plan**: an imported image or a rendered PDF page. In the user's mental
model it is reference material, not editable project geometry (spec §25), so it is:

- locked by default once its scale is set, with the consequences shown before unlocking;
- given an opacity control;
- replaceable and removable without touching any zone.

This layer should redraw rarely. The only thing the plan editor's first slice WRITES about it is
which document a plan's background IS (`ReversibleSetPlanBackgroundCommand`).

---

# 19. Interaction Layer

Transient only:

- selection handles
- snap guides (with a visible reason for the snap — spec §22)
- measure previews
- drawing previews (the room draft sketch)
- transform controls

---

# 20. Selection and Transformation

Konva transformation results must be normalized into true domain geometry before persistence.

```text
Konva Transform
      ↓
Normalize Transform
      ↓
Domain Geometry
      ↓
Command
```

Do not persist `scaleX`/`scaleY` as true dimensions.

Selection is by stable entity id, shared by the canvas, the non-canvas room list and the
Inspector, so the three never disagree about what is selected (spec INV-01). When entities
overlap, selection priority is predictable — handle → object → opening → wall → room →
background — and hover previews what a click would select.

ADR-0018 assigns selection and Inspector ownership. Room/Area selection now uses ordered unique
IDs, Shift toggling and Alt overlap cycling. M11 badges and rows focus a member independently of
membership; a missing member is explicitly unavailable in aggregates. Wall/Opening/Object
priority remains reserved until those types exist. The property panel keeps the non-canvas list
reachable while an Inspector subject is selected, including a modifier-free multiple-selection
option. Selected geometry is not covered by reference-plan onboarding.

---

# 21. Snapping Architecture

Implement as an editor/application service.

```text
SnapService

snapPoint()
snapRotation()
snapResize()
snapToGrid()
snapToVertex()
snapToEdge()
```

Snapping is automatic and VISIBLE: the guide says why the pointer snapped (endpoint, alignment,
angle). Grid and snap toggles sit in the status bar; finer configuration is a tier-4 setting and
does not clutter the primary surface.

---

# 22. Geometry Core

Plain TypeScript primitives:

```text
Point
Vector
LineSegment
BoundingBox
Polyline
Polygon
Transform
```

Operations:

- distance
- length
- area
- perimeter
- centroid
- bounding box
- point-in-polygon
- segment intersection
- projection
- translation
- rotation
- scale conversion

---

# 23. World Coordinate System

```text
1 world unit = 1 millimeter
```

Domain geometry uses real-world coordinates, never screen pixels (ADR-009). The sidecar states
`unit: 'mm'` explicitly. Display units (mm, cm, m, m²) are a formatting concern, converted once
at the presentation edge; internal precision and display precision are separate.

---

# 24. Viewport Transform

Centralized functions:

```text
worldToScreen()
screenToWorld()
```

Transformation components:

- translation
- zoom (cursor-centred)
- rotation
- device pixel ratio

Pan and zoom are NAVIGATION GESTURES — wheel, trackpad, Space+drag, middle button — not a
persistent tool. An explicit Pan mode is a temporary override, never a primary toolbar item
(spec §11, §79).

---

# 25. Calibration

A Plan calibration defines how background pixels map to world coordinates.

Minimum:

- Point A
- Point B
- known real-world distance

The user never meets a *Calibrate* tool. Setting the scale is step two of the reference plan
setup (M06: *prepare → set scale → review*, §98), and the whole setup persists as one
transaction. Until a plan is calibrated, no measurement is presented as true — the business rule
*An uncalibrated plan never presents a measurement as true* — and the status bar's scale state
says so.

---

# 26. Geometry Validation

Validate before persistence:

- polygon has >= 3 vertices
- finite coordinates
- no NaN
- no Infinity
- valid unit
- valid transform

Prefer prevention over validation at the tool: a zero-length wall cannot be drawn, a
self-intersecting room cannot be completed, and the refusal is shown spatially rather than as a
dialog about polygons (spec §52).

Future:

- self-intersection detection
- winding normalization
- polygon repair

---

# 27. Advanced Polygon Operations

Use an adapter around `clipper2-ts` when the first boolean operation is needed (not installed
yet — §5).

Operations:

- union
- intersection
- difference
- offset

No Clipper-specific types escape Infrastructure/Core adapters.

---

# 28. Spatial Index

Use `rbush` when needed (not installed yet — §5).

Use cases:

- hit candidate lookup
- objects in viewport
- assets inside zone
- collision candidates
- selection marquee

The index is an optimization only.

---

# 29. Command Architecture

Meaningful changes pass through commands.

Concept:

```ts
interface Command<TInput, TResult> {
  execute(input: TInput): Promise<TResult>;
}
```

Every write takes an **expected version** and refuses a stale one; the outcome is a typed
`DispatchOutcome`, never a thrown exception past the application boundary (§65).

In place, by aggregate:

- project: `CreateProject`
- plan: `CreatePlan`, `SetPlanBackground`, `CalibratePlan` (reversible)
- zone: `CreateZone`, `DeleteZone`, `MoveSpatialObject`, restore (reversible wrappers around the
  first two)
- asset: `CreateAsset`, `UpdateAsset`, `DeleteAsset`, `SetAssetFootprint` (and from
  dimensions), `SetAssetClearance`, `SetAssetAnchor`, `SetAssetFacing`, `SetAssetHeight`,
  `SetAssetBackground`, `CalibrateAsset`
- asset price: `SetAssetPriceOverride`, `ClearAssetPriceOverride`
- requirement: `AssignAsset`, `RecalculateRequirement`, `SetRequirementQuantityOverride`,
  `SetRequirementCostOverride`, `DeleteRequirement` (reversible where the Inspector edits them)

Reserved, from 0.1: `CreateWorkPackage`, `CompleteWorkPackage`, `ResizeSpatialObject`.

**A homeowner intent is a facade, not a new command.** *Add → Room* dispatches `CreateZone` with
`zoneType: 'Room'`; a rectangle is stored as a polygon and nothing in frontmatter says otherwise.
Direct manipulation and numeric entry of the same dimension converge on the same command.

---

# 30. Undoable Editor Commands

```ts
interface UndoableCommand {
  execute(): Promise<void>;
  undo(): Promise<void>;
}
```

History:

```text
CommandHistory

undoStack
redoStack
```

The reversible wrappers live in `application/commands/*/Reversible*` and the history in the
editor runtime. Undo removes both halves of a zone — note and geometry — and redo replays exactly
once with valid revision handling. The prototype's array-snapshot undo is not a production
contract (AL decision D11): Undo is offered only where this history can safely reverse the
operation.

---

# 31. Transaction Boundary

One user intent equals one logical transaction AND one history entry.

```text
Drag Zone
  ↓
MoveZoneCommand
  ↓
ONE domain change
ONE history item
ONE persistence operation
```

"Resize room from 4.2 m to 4.5 m" undoes in one step; *move vertex 1, move vertex 2, update
dimension* are implementation details. A continuous gesture commits when it ends (pointer up),
never during pointer movement.

A zone spans a note and a sidecar entry; the two are written as ONE logical sequence through the
`WriteLedger`, with a sequence marker that lets an interrupted sequence be recovered or
compensated on the next load (§42).

---

# 32. Event Architecture

Commands may emit domain/application events after successful state changes.

Example:

```text
ZoneGeometryChanged
     ↓
RequirementInvalidated
     ↓
RequirementRecalculated
     ↓
CostEstimateChanged
```

Beside domain events, the application layer exposes **change sources** a surface subscribes to
(`planChangeSource`, `projectListChangeSource`, `projectPlansChangeSource`,
`projectPricesChangeSource`, `assetCatalogueChangeSource`, `assetDesignChangeSource`,
`assetLibraryChangeSource`, `requirementFiguresChangeSource`). They fold domain events, project
index changes and sidecar changes into "this view's data may have moved", and every subscription
is disposed with the view.

---

# 33. Event Bus

Initial implementation: in-process synchronous or promise-aware bus.

No external event infrastructure.

---

# 34. Domain Events

In place:

- `ProjectCreated`
- `PlanCreated`, `PlanCalibrated`, `PlanBackgroundChanged`
- `ZoneCreated`, `ZoneGeometryChanged`, `ZoneDeleted`
- `AssetCreated`, `AssetUpdated`, `AssetDeleted`, `AssetDesignChanged` (keyed on `assetId`
  alone — an asset belongs to no project)
- `AssetPriceOverrideChanged`
- `RequirementCreated`, `RequirementInvalidated`, `RequirementRecalculated`,
  `RequirementRestored`, `RequirementDeleted`, `CostEstimateChanged`

Reserved, from 0.1: `ConstructionSectionCreated`, `WorkPackageCreated`,
`WorkPackageCompleted`, `BudgetChanged`.

---

# 35. Query Architecture

Queries are read-only and answer a DTO, never an entity. A list query answers what it LOADED and
what it REFUSED (`{ loaded, refused }` at the port; `{ projects, unreadable }` at the
application edge), so a surface can distinguish *empty* from *unreadable* (§66).

In place:

- `GetProject`, `ListProjects`, `ListPlansByProject`, `GetPlan`
- `FindZonesByPlan`, `GetZone`, `GetZoneInspector`
- `ListAssets`, `ListCatalogueEntries`, `ListAssetOutlines`, `GetAssetDesign`
- `ListProjectAssetPrices`, `ListOverridingProjects`
- `GetRequirementsForZone`, `ListRequirementsReferencing`, `ListReassignmentTargets`
- `GetDiagnosticsSnapshot`

Reserved, from 0.1: `GetProjectBudget`, `GetConstructionSectionSummary`,
`GetRequirementsForWorkPackage`. No aggregate a query does not supply is ever invented on a
surface — no cross-project totals, no progress percentages, no per-floor cost until a query
answers it (`FloorSummaryDto.estimatedCost` is `unavailable` until then).

---

# 36. Repository Pattern

Example:

```ts
interface ZoneRepository {
  getById(id: ZoneId): Promise<Result<Loaded<Zone> | null, RepositoryError>>;
  save(zone: Zone, expected: Expected): Promise<Result<void, RepositoryError>>;
  delete(id: ZoneId, expected: EntityVersion): Promise<Result<void, RepositoryError>>;
  listByProject(projectId: ProjectId): Promise<Result<ZoneListing, RepositoryError>>;
  listByPlan(planId: PlanId): Promise<Result<ZoneListing, RepositoryError>>;
}
```

Concrete implementation:

```text
ObsidianZoneRepository
```

Every repository takes an expected version on write, holds a per-entity keyed queue for mutual
exclusion, and answers a listing that names what it could not read. In-memory implementations
honour the same ports and are what the application tests drive (§71).

---

# 37. Obsidian Repository Layer

Explicit mapping:

```text
Markdown / Frontmatter (+ sidecar)
        ↕
Persistence DTO   (Zod-parsed, §43)
        ↕
Domain Entity
```

Raw frontmatter must not leak throughout the application. The mapper is where casing is
bridged: the domain says `'Room'`, the note says `zone-type: room`.

---

# 38. Markdown Entity Model

Six note types, each discriminated by `type`, versioned by `schema-version`, identified by `id`
and optimistically locked by `revision`:

| `type` | Entity | Keys beyond the four shared ones |
|---|---|---|
| `renovation-project` | Project | `name`, `status`, `description`, `start`, `target-completion`, `currency` |
| `renovation-plan` | Plan | `project`, `name`, `background-path`, `background-kind`, `background-page`, `layers` |
| `renovation-zone` | Zone | `project`, `plan`, `name`, `zone-type`, `status` |
| `renovation-asset` | Asset | `name`, `category`, `unit`, `unit-cost`, `currency`, `waste-factor-default`, `supplier`, `sku`, `height`, `notes`, background fields |
| `renovation-asset-price` | Asset price override | `project`, `asset`, `unit-cost`, `currency` |
| `renovation-requirement` | Requirement | `project`, `asset`, `origin-kind`, `origin-zone`, quantity and cost figures, `recalculation-status`, `required-date` |

Example:

```yaml
---
type: renovation-zone
schema-version: 1
id: zone-01HXYZ…
revision: 3

project: project-01HABC…
plan: plan-01HDEF…

name: Kitchen
zone-type: room
status: planned
---
```

Rules the model holds:

- The note body remains free-form and user-owned; a plugin save preserves it.
- **A homeowner label is never persisted.** No `kind: room`, no `floor` key: Room and Floor are
  derived on read (§94).
- Enum values are kebab-case in the note and restored to the domain label by the mapper.
- `status` on a zone is a PROGRESS axis (planned / in progress / complete). It is never read as
  Existing or Planned (§97).
- A type or value this version does not know should survive a round trip verbatim (business
  rule). One known exception is recorded as an issue: an asset `category` outside the seven
  currently fails the parse rather than surviving it.

---

# 39. Sidecar Files

> Store plan geometry per plan rather than one sidecar per spatial object.

Where the file goes was decided twice after 0.1, and both decisions follow one principle: **the
unit that owns the data owns the folder, and nothing is configured a second time.**

```text
Renovation/
├── Kitchen Refit/                 ← a project folder (derived from Project.md — ADR-0013)
│   ├── Project.md
│   ├── Plans/
│   │   └── Ground Floor.md
│   ├── Zones/ …
│   └── Geometry/
│       └── plan-01JABC….rpgeo     ← one per plan (ADR-011)
└── Library/                       ← the one library folder (a setting)
    ├── Assets/
    │   └── Base cabinet 600.md
    └── Geometry/
        └── asset-01JDEF….rpgeo    ← one per asset shape (ADR-0014)
```

- The extension is `rpgeo`, registered with `registerExtensions` so the files are visible and
  manageable in Obsidian's explorer. The content is JSON.
- A sidecar is named by its owner's full id, prefix included, never by a display name.
- Resolution goes through the Project Index; derivability is a repair path for a damaged index,
  not a second lookup.
- A library-folder change moves `Assets/` and `Geometry/` together, inside one migration, and
  persists the new value only after the move succeeded.

0.1's `Ground Floor.geometry.json` beside `Ground Floor.md` is superseded.

---

# 40. Plan Sidecar Schema

```json
{
  "schemaVersion": 1,
  "planId": "plan-01JABC…",
  "revision": 4,
  "unit": "mm",
  "calibration": { "pointA": {"x":0,"y":0}, "pointB": {"x":800,"y":0},
                   "knownDistance": 4000, "pixelsPerWorldUnit": 0.2 },
  "objects": [
    { "id": "zone-01HXYZ…", "type": "polygon", "points": [[0,0],[4200,0],[4200,3600],[0,3600]] }
  ]
}
```

An asset's sidecar carries `assetId`, `revision`, `unit` and a shape: `footprint`, optional
`clearance`, `anchor`, `facing`, and provenance flags saying which of those still await a scale.

**Sidecar entries are polygon-only today** and carry no subtype, layer or state. Walls, openings
and annotations are the trigger for ADR-SO (§89), which must evolve this schema compatibly
rather than replace it.

---

# 41. Persistence Boundary

UI must not directly call Vault write APIs.

```text
Vue
 ↓
Application Command
 ↓
Repository
 ↓
Obsidian Adapter
```

Held by lint, not habit: `WRITE_BOUNDARY` in `eslint.config.mjs` refuses the write spellings it
can see anywhere outside `infrastructure/`, and names the ones it cannot.

---

# 42. Persistence Consistency

A spatial entity may span:

```text
Markdown metadata
+
Plan geometry sidecar
```

Updates affecting both are treated as one logical transaction: the `WriteLedger` records a
sequence marker before the first file and clears it after the last, so a load that finds a
marker knows a sequence was interrupted and recovers or compensates it.

**A write and its read-back are two outcomes, and the UI says which one failed.** A confirmed
write followed by a failed refresh is *Saved · Refresh needed* (M15, AL09, P states), never
*Save failed*: the last valid projection stays on screen marked stale, unsafe follow-up edits are
disabled with a reason, and *Try again* repeats the READ only. A write is never replayed to cure
a failed read. Only a completed domain action persists; no optimistic projection becomes a second
truth.

Failure handling should preserve previous valid data where practical.

---

# 43. Schema Validation

Use Zod.

```text
raw data
  ↓
schema parse (one door: parsePersisted)
  ↓
persistence DTO
  ↓
domain mapping
```

Invalid persisted data must not silently enter the domain. It also must not silently vanish: a
note that fails to parse is counted as UNREADABLE and reported beside what did load (§35, §66).

---

# 44. Schema Versioning

Every persistent format carries a schema version — notes in `schema-version`, sidecars in
`schemaVersion`, `data.json` implicitly through `settingsFrom`. A newer version than this build
knows is refused with a message naming a plugin update as the remedy, never with a suggestion to
edit fields.

Which additive changes stay at v1 and which require a bump is ADR-SV, deferred with its trigger
(§89).

---

# 45. Migration Architecture

```text
migration/
├── project/
├── entities/
└── geometry/
```

Migrations must be:

- deterministic
- tested
- idempotent where practical

The `MigrationRunner` exists and no schema version has moved yet, so no entity migration is
registered. The library-folder move (§39) is the one migration in place; it is a folder
migration, not a schema one.

---

# 46. Vault Change Detection

Respond to:

- file created
- file modified
- file renamed
- file deleted

Pipeline:

```text
Obsidian Event
      ↓
Vault Change Adapter
      ↓
Entity Resolver (what the note DECLARES, not where it sits)
      ↓
Validation
      ↓
Project Index Update (reconciling; an echo window drops our own writes)
      ↓
Change source → view refresh through queries
```

---

# 47. Project Index

Avoid repeated full-Vault scans.

Responsibilities:

```text
entity ID → file path
entity type → IDs
project ID → entity IDs
plan ID → spatial objects (sidecar mapping)
library overlaps (a note filed where two folders would claim it)
```

The index is bounded by what a note declares — since ADR-0013 there is no registered root and no
folder scan — and it is rebuildable from Vault data at any time. A project's folder is derived
from where its `Project.md` sits; the default projects folder setting decides only where a NEW
project is created.

---

# 48. Cost Engine

Independent domain service.

Supports:

- piece
- length
- area
- volume
- hour
- day
- fixed

An asset's unit kind must match the dimension its requirement is derived from (business rule);
an incompatible unit change on a referenced asset is refused, not coerced.

---

# 49. Money

Never use native floating-point arithmetic directly for financial calculations.

Use `decimal.js` (ADR-010). `core/money/Money.ts` is the only module that touches a `Decimal`
for a monetary amount; across every other boundary an amount is a decimal STRING.

Domain concept:

```text
Money
├── amount
└── currency
```

A mismatched currency is an error, not a conversion; money is rounded once, where the pipeline
finalizes it; a project's currency is shown as the project's, never the reader's.

---

# 50. Quantity Engine

Pipeline:

```text
Geometry
   ↓
Measured Quantity
   ↓
Requirement Rule
   ↓
Required Quantity
   ↓
Waste (a separate factor, multiplying)
   ↓
Purchase Quantity (rounded up to whole lots, then to the minimum order)
```

No stage stands in for another, and the source of a figure is visible to the user
("19.6 m² · calculated from room area + 10% waste").

---

# 51. Cost Pipeline

All six of PRD §74's price components have a stated placement (ADR-012), and the order is fixed
and not configurable:

```text
quantity × unit price → − discount → + shipping → + surcharge → + tax → round → estimated cost
```

Contingency is **not a stage** — held beside the estimate so the remaining buffer stays
answerable — and a deposit is **not a stage** — a payment against a commitment, part of the
financial lifecycle rather than the price.

The unit price a requirement uses resolves in order: a project-scoped override for that asset
(§52), else the catalogue price. Estimate, quotes, committed and actual are four figures the
Inspector (M13) shows side by side; each cost type has exactly one source of record, and a
forecast counts a commitment only until it is invoiced.

---

# 52. Manual Overrides

Concept:

```ts
DerivedValue<T> {
  calculated: T;
  override?: T;
}
```

Effective value:

```text
override ?? calculated
```

The UI must distinguish calculated from overridden values — *Area 17.8 m² · Calculated* against
*Material quantity 19.5 m² · Overridden* — and a derived value leads to its source when editing
is requested.

A **project price** is an override with its own entity (`AssetPriceOverride`,
`renovation-asset-price`), stored beside what it replaces: setting one never changes the shared
catalogue price, and correcting the catalogue price never changes an override, a quotation or a
historical actual cost. Recalculation of dependent requirements follows the event contract (§32)
and is reported honestly: "saved" is claimed for the asset write, not for every downstream figure.

---

# 53. Scheduling Architecture

Not an MVP core requirement, but domain boundaries should support:

- WorkPackage
- Task
- Milestone
- Dependency
- DateRange

A dependency is allowed only between five pairs of things (business rule). A future Gantt renderer
remains an adapter. `dayjs` arrives with this and not before.

---

# 54. Document Import

Images:

- PNG
- JPEG

PDF:

```text
PDF
 ↓
Obsidian's own PDF.js (loadPdfJs, promised at minAppVersion)
 ↓
Rendered Page
 ↓
Reference plan layer
```

`pdfjs-dist` was bundled for exactly one increment and cost 78% of the bundle; it is a
devDependency now, for the suite alone. The residual gap — the suite runs our copy and production
runs Obsidian's — is written down in `pdfRaster.ts`.

Original files remain in the Vault.

---

# 55. Asset Handling

Two things carry the name, and the architecture keeps them apart.

**Imported documents** (reference plans, photos, attachments) remain Vault files. Plans and
assets reference Vault-relative paths. No base64 embedding.

**Catalogue assets** (`Asset`) are vault-wide definitions of a thing or service — one library per
vault, owned by no project (*Work belongs to one project, catalogues belong to the vault*). An
asset carries a unit, a catalogue price with explicit currency, a waste allowance, an optional
supplier and SKU, and an optional shape in its own sidecar (ADR-0014). A requirement is the
amount a project needs of it; procurement and incurred cost are separate concepts again. The
library shows no aggregate money and never sums across currencies. Deleting an asset re-checks
its references at commit and never removes a project's requirements on its own (§99).

---

# 56. Editor Tool Architecture

Shared abstraction:

```ts
interface EditorTool {
  id: ToolId;

  activate(context: EditorContext): void;
  deactivate(): void;

  pointerDown(event: EditorPointerEvent): void;
  pointerMove(event: EditorPointerEvent): void;
  pointerUp(event: EditorPointerEvent): void;

  cancel(): void;
}
```

A `ToolManager` owns the switching lifecycle; a creation tool is TEMPORARY and hands back to
Select after one creation; Esc cancels the current action and returns toward Select (§96).

---

# 57. Initial Editor Tools

Tool ids are internal. What the user meets is an intent, and the mapping is explicit:

| Tool id | User-facing intent |
|---|---|
| `select` | the default and the safe home state |
| `draw-room` | *Add → Room*: drag a rectangle or type two lengths |
| `draw-polygon` | Legacy free-shape Room completion (not exposed by Add) |
| `draw-area` | *Add → Area*: shared polygon gesture, Custom Zone completion, explicit repetition |
| `calibrate` | *Set scale*, one step inside reference plan setup (§98) — never a toolbar tool |
| pan override | Space+drag / middle button — a gesture, not a mode |

Reserved: `WallTool`, `OpeningTool` (door, window), `PlaceAssetTool`, `MeasureTool`,
`AnnotationTool`, `PathTool`, `BooleanTool`.

Creation entries live in a **declarative catalogue** (`creationCatalogue`); an entry the build
does not support says so with a reason and THROWS if activated, so a menu never mislabels a row
at runtime.

---

# 58. Editor Context

Tools receive controlled access to:

- viewport
- selection
- snap service
- command dispatcher
- render state
- the **subject** — a plan in the plan editor, an asset in the asset designer; the tool context
  names a subject rather than a Plan so both surfaces share one gesture surface

Tools must not call repositories directly.

---

# 59. Inspector Architecture

```text
Selection (stable id)
   ↓
Inspector Query
   ↓
Inspector DTO
   ↓
Vue UI
```

Edits become commands. The Inspector is the bridge between spatial geometry and project
information: selection-driven, context-sensitive, progressively disclosed.

- **No selection** shows the floor summary (rooms, areas, scale state) and guidance.
- **One room** shows Overview and the homeowner's questions as sections — Existing, Planned,
  Work, Materials, Costs, Documents, Photos, Notes (M08–M14).
- **Several entities** show numbered members, shared or mixed type and the sum of individual
  areas (M11). Overlap is counted separately. Unavailable members are disclosed and do not become
  a fabricated zero or shared property. Shared renovation actions remain future domain work.

**Unavailable is not empty.** A section whose domain does not exist yet is marked *not yet
supported*; a section whose query answered nothing is *empty*; and the two never look alike
(`RoomOverviewDto.unavailableSections`). No fabricated zeros, counts, costs or statuses.

---

# 60. UI Layout

Five shell regions around the canvas, drawn by `ResponsiveEditorShell`:

```text
┌──────────────────────────────────────────────────────────────┐
│ Project › Floor            Plan · Renovate · Review   ↶ ↷ ⋯  │  EditorContextBar
├──────────────┬─────────────────────────────┬─────────────────┤
│ PROPERTY     │                             │ INSPECTOR       │
│  Ground floor│                             │  Kitchen        │  PropertyLayerPanel
│              │        PlanCanvas           │  Overview       │  EntityInspector
│ LAYERS       │                             │  Existing …     │
│  Reference ✓ │   [ Select ]  [ + Add ]     │                 │  FloatingPrimaryActions
│  Rooms     ✓ │                             │                 │
├──────────────┴─────────────────────────────┴─────────────────┤
│ 100%   Grid ✓  Snap ✓   Scale: set                   Saved   │  StatusBar
└──────────────────────────────────────────────────────────────┘
```

The shell owns LAYOUT only — not hydration, not commands, not selection. Tier-1 actions are
Select, Add, Undo, Redo; zoom, fit, layers and the Inspector are tier 2; contextual actions sit
beside the selection; snap configuration and calibration are tier 4. The perspective switch and
the Property tree are drawn as the design specifies once their domains exist (§96); until then
the breadcrumb has two segments (ADR-0017).

Superseded: 0.1's toolbar-with-Layers/Objects/Assets rails, and *Pan*, *Calibrate* and *Draw
polygon* as equal primary tools (spec §79).

---

# 61. Responsive Strategy

Layout is driven by the **leaf's container width**, never the window's (container queries).

| Width | Editor (M16) | Library (AL10) / Project (P06–P07) |
|---|---|---|
| Full | persistent panels + canvas + Inspector | list beside inspector |
| Constrained | panels become rail-triggered overlays; Inspector becomes an edge drawer; selection and viewport survive the reflow | compact inspector, secondary columns dropped |
| Below supported width | editing replaced by *Focus this tab* and a non-canvas summary; no horizontal scroll | one surface at a time with a back control that restores search, groups and scroll |

**Mobile is read-only** — a product decision (`PRODUCT.md`), not a breakpoint. A narrow desktop
leaf keeps its editing; a CSS breakpoint grants no writing; the two are tested separately.
`isDesktopOnly: false` is a promise bounded to reading.

---

# 62. Performance Architecture

Primary risks:

- large plan
- many shapes
- high-resolution background
- frequent pointer events
- frequent persistence
- reactivity overhead

Rules:

1. separate static and dynamic layers
2. avoid full redraws
3. no persistence during pointer movement
4. do not mirror every Konva property into Vue state
5. keep transient interaction state outside persistent stores
6. use spatial indexing when justified
7. render only relevant content where practical
8. no retained Konva stages, listeners or object URLs after a leaf closes

Proposed budgets to validate rather than assume (editor implementation plan §8): usable render
under 1.5 s on a typical project; pan/zoom at 60 fps, 30 minimum; selection feedback under
100 ms; Inspector change under 200 ms; a visible status for any operation over 300 ms.

---

# 63. Worker Strategy

Possible future worker workloads:

- large polygon operations
- bulk requirement recalculation
- large imports
- report calculations

`comlink` may be introduced later.

---

# 64. Error Model

One `AppError` shape with a coded `code` per failure, grouped by category:

- DomainError
- ValidationError
- PersistenceError
- GeometryError
- ImportError
- MigrationError
- ReferenceError (four kinds of reference failure are detected by name — business rule)
- CalculationError

A code is data: `trError(language, code)` maps it to a user sentence, so an unrecovered
settings file and a vault fault say different things.

---

# 65. Result Pattern

Expected business failures should use typed `Result<T,E>` style handling.

Unexpected technical failures may throw and are translated at the application boundary
(`guardAgainstThrowing`, the exception mapper); nothing past it throws into a view.

---

# 66. Error Boundary

```text
Infrastructure Exception
        ↓
Application Error Mapping
        ↓
Typed Result / AppError
        ↓
Presentation (surfaceError → the right door)
        ↓
User Message (t / trError)
```

Rules the surfaces hold:

- **Missing is not zero, and unreadable is not empty.** A list that could not be read says so; a
  vault whose only projects refuse to parse draws an empty list beside a refusal notice, never
  *No projects yet*.
- A failure is shown in the REGION it belongs to — a price read failing leaves the plans usable.
- Retry exists only where the error policy permits it; a session failure gets no decorative retry.
- No raw exception message, stack or path reaches a notice (`NOTICE_TEXT_BAN`); every notice and
  every detached door goes through `notify*` / `runDetached`.
- A refusal is a state with a way back, never a redirect: a project that is gone draws "no longer
  available" with *All projects*, and nothing navigates on its own.

---

# 67. Logging

Local logger levels:

- debug
- info
- warn
- error

Logs never leave the device automatically. Verbose logging is a setting; `console` is reachable
only from `infrastructure/logging/` (lint, mirrored in both linters).

---

# 68. Diagnostics

The diagnostics report (a palette command and a settings action) exposes:

- plugin version
- Obsidian version
- schema versions
- migration state
- entity validation issues (which notes refused, and why, from the diagnostics ledger)

Do not include project content unless explicitly exported.

---

# 69. Testing Strategy

```text
                    E2E  (a vault: npm run test-build + docs/tests/ manual cases)
                     ▲
                Integration  (fixture vault, browser harness, harness captures)
                     ▲
                 Component  (jsdom, @vue/test-utils, axe-core)
                     ▲
                   Unit
```

`npm run check` is the definition of done: build, two linters, the coverage-floored suite and
fallow. `CLAUDE.md` carries what each gate refuses, what the fakes cannot see, and the fake rule
(never kinder, thinner, harsher or faster than the real thing).

---

# 70. Unit Tests

## Geometry

- distance
- area
- perimeter
- centroid
- transform
- calibration
- snapping
- intersection

## Money

- addition
- tax
- discounts
- rounding
- currency safety

## Quantity

- length requirements
- area requirements
- waste
- packaging
- manual overrides

## Domain

- status transitions
- relationship rules
- validation
- dependency rules

---

# 71. Application Tests

Use in-memory repositories that honour the same ports.

Example:

```text
CreateZoneCommand
 ↓
InMemoryZoneRepository
 ↓
Assertions
```

---

# 72. Repository Contract Tests

Shared repository contract suites should be reusable across:

- InMemory repositories
- Obsidian repositories

The in-memory and the fixture-vault stacks share one foundation (`tests/helpers/repositoryStack.ts`)
and differ in three host fakes and nothing else. The editor round-trip instrument asserts, field
by field, that the note-and-sidecar read path and the creation path agree about one record.

---

# 73. Vue Component Tests

Use:

```text
Vitest
@vue/test-utils
```

Test:

- inspector behavior
- toolbar state
- selection behavior
- dialogs
- validation messages
- the shell's regions being drawn AND reachable by import (two instruments for two failure
  modes)

---

# 74. Canvas Tests

Focus on adapter behavior:

- polygon renders expected points
- transform completion emits correct command
- selection emits domain ID

Geometry correctness remains in unit tests. jsdom draws nothing, so a real rasterizer sits
behind its `<canvas>` (an inert stub is refused: a fake kinder than the real thing turns a
shipped crash into a green suite).

---

# 75. Integration Test Vault

```text
tests/
├── vault/            (valid-project, broken-references, legacy-schema, large-project)
└── fixtures/         (the background PNG and PDF the manual cases use — never read from docs/)
```

What only a vault can verify is written down in `docs/tests/suites/` and its cases, each with a
Runs table; an unrun manual case is a plan to find out, not a finding.

---

# 76. Architecture Test Rules

Implemented, not proposed:

```text
domain/**, core/**, application/** may not import: vue · pinia · konva · obsidian
presentation → application → domain → core; infrastructure → application ports
src/prototypes/** is imported by nothing, and composes no built chunk
nothing outside infrastructure/ spells a vault write
nothing outside src/plugin/ registers with Obsidian
no literal reaches the six i18n call sites; no message/stack reaches a notice
```

Tooling: ESLint `no-restricted-imports` and `no-restricted-syntax` (with `noInlineConfig`, so no
comment turns a rule off), plus `tests/build/` reading the tree for the claims lint cannot
express. `dependency-cruiser` was not needed.

---

# 77. Proposed Repository Structure

```text
renovation-planner/
│
├── manifest.json · package.json · vite.config.ts · vite.harness.config.ts
├── vitest.config.ts · tsconfig.json · eslint.config.mjs · .oxlintrc.json · .fallowrc.json
├── CLAUDE.md · PRODUCT.md · RELEASING.md · CHANGELOG.md
│
├── src/
│   ├── main.ts
│   ├── plugin/            (RenovationPlannerPlugin, composition-root, settings, diagnostics,
│   │                       per-view dependency bundles, sampleProject scaffolding)
│   ├── core/              §7.1
│   ├── domain/            §7.2
│   ├── application/       §7.3
│   ├── infrastructure/    §7.4
│   ├── presentation/      §7.5
│   └── prototypes/        (harness-only mocks, outside the layering)
│
├── styles/                (partials assembled into one sheet; Obsidian variables only — §84)
├── scripts/               (everything npm run invokes)
├── tests/                 (mirrors src/, plus build/, harness/, release/, helpers/, fixtures/, vault/)
│
└── docs/
    ├── product/           (vision, PRDs, business rules, research)
    ├── user-experience/   (the three design packages, journeys, archive)
    ├── development/       (this SDD, adrs/, consolidation/, increment history)
    ├── requirements/ · entities/ · components/ · actors/ · issues/ · tasks/ · reviews/
    ├── tests/             (manual suites and cases; the vault this repository IS)
    └── setup/
```

Build artifacts go to `dist/` and nothing is written to the repository root. Worktrees live in
`.worktrees/`, gitignored.

---

# 78. Internal Module Pattern

Example:

```text
domain/zone/

├── Zone.ts
├── ZoneId.ts
├── ZoneType.ts
├── ZoneStatus.ts
├── Zone.errors.ts
└── Zone.events.ts
```

Commands:

```text
application/commands/zone/

├── CreateZone.ts
├── DeleteZone.ts
├── MoveSpatialObject.ts
├── reversible-create-zone-command.ts
└── reversible-delete-zone-command.ts
```

---

# 79. Public Boundaries

Prefer explicit module public APIs.

Avoid deep internal imports.

---

# 80. Naming Conventions

Domain:

- Zone
- Asset
- WorkPackage

Commands:

- CreateZone
- AssignAsset
- DeleteWorkPackage

Events:

- ZoneCreated
- AssetAssigned
- WorkPackageCompleted

Queries:

- GetZone
- ListAssets
- FindZonesByPlan

User-facing labels (Room, Floor, Reference plan) are locale KEYS, never identifiers.

---

# 81. TypeScript Rules

Use:

```text
strict: true
```

Avoid:

- any
- non-null assertions
- unchecked casts

Prefer:

- unknown
- runtime validation
- discriminated unions
- readonly data where practical

`tests/**` is type-checked by the same `build` step as `src/**`.

---

# 82. Entity IDs

Persistent entities use stable IDs independent from filenames.

Shape: `<prefix>-<ULID>`, minted with `ulid`:

```text
project-01JABC…
plan-01JABC…
zone-01JABC…
asset-01JDEF…
```

The note's `id`, a sidecar's own id field and the sidecar filename are the same string.

---

# 83. Entity References

References use stable IDs.

Markdown links may additionally be stored for navigation.

Filename alone is never identity (business rule: *Identity is the id, never the filename, title
or path*). A write LOCATION may derive from a path (ADR-0013); identity never does.

Deleting either end of a reference goes through the reference-integrity engine: the delete
reports what references it and offers four resolutions, and the referent set is re-checked as a
set at commit.

---

# 84. CSS and Theme Integration

Obsidian is the design system. Use its CSS variables — `--background-primary`,
`--background-secondary`, `--background-modifier-border`, `--background-modifier-hover`,
`--text-normal`, `--text-muted`, `--interactive-accent` and the error/focus roles — for every DOM
colour; canvas colours resolve through one theme-token adapter.

No hard-coded palette: the build parses the assembled stylesheet and fails on any literal colour
the parser can resolve. No plugin theme switch, logo, wordmark or standalone shell.

Support:

- light themes
- dark themes
- custom themes

Renovation states additionally use line weight, dash pattern, markers, labels and icons; colour
is never the only channel.

---

# 85. Accessibility

Binding target: **WCAG 2.2 AA**.

Core requirements:

- keyboard-accessible controls, including every editor operation
- visible focus at every stop
- semantic labels and correct roles (a row that is the current one uses `aria-current`; a group
  header is a button with `aria-expanded`)
- status not encoded only by color
- **nothing canvas-only**: every spatial object is reachable from a list, a note or a Bases row
- adequate hit targets
- live regions used sparingly and never flooded by background updates
- no nested interactive elements

axe-core runs in the suite against the real mounted surfaces and grades roles, names, labels,
heading order and ARIA validity. It cannot grade contrast, focus visibility, hit size or anything
on `document.body` (notices); a live vault is where those are checked.

---

# 86. Security and Privacy

Default:

```text
no telemetry
no remote calls (held by a network-boundary test)
no account
no cloud persistence
```

Future integrations are explicit and optional. `data.json` and a restored view state are trust
boundaries: parsed and validated, never cast.

---

# 87. Data Safety

Rules:

1. never develop against production Vaults
2. validate before write
3. preserve unknown Markdown content and the user-authored body
4. avoid full-note rewrites where targeted changes suffice
5. never cascade-delete silently
6. maintain migration tests
7. fail closed on unsupported schema versions
8. never present a missing or refused read as zero, empty or "nothing yet"
9. a manual edit in the vault is never silently overwritten: a conflict shows the current value
   and asks, with no last-write-wins
10. a successful write followed by a failed read-back is reported as exactly that (§42)

---

# 88. Non-Functional Requirements

Aligned with ISO/IEC 25010.

## Functional Suitability

Domain calculations must be deterministic and verifiable.

## Performance Efficiency

Interactive editing should remain responsive.

Target pointer feedback:

```text
< 16–32 ms where practical
```

## Compatibility

Coexist with:

- standard Markdown
- Obsidian Properties
- Obsidian links
- Bases
- common community plugins

## Usability

Primary workflows should require minimal editor knowledge: a first-time homeowner creates,
selects and recovers a room without CAD vocabulary or instruction.

## Reliability

Persistence errors must never silently discard project data.

## Security

No unnecessary external communication or privileged APIs.

## Maintainability

Core domain logic remains framework independent.

## Portability

Data remains understandable without the plugin.

---

# 89. Initial Architecture Decisions

Accepted, in `docs/development/adrs/`:

| ADR | Decision |
|---|---|
| 001 | Markdown as canonical metadata storage |
| 002 | JSON sidecar for plan geometry (one per plan) |
| 003 | Konva as canvas renderer |
| 004 | Vue 3 for plugin UI |
| 005 | Pinia for presentation state, never persistent truth |
| 006 | Plain TypeScript domain |
| 007 | Command-based mutations |
| 008 | Event-aware architecture |
| 009 | World coordinates in millimetres |
| 010 | Decimal money arithmetic |
| 011 | Project-scoped `Geometry/` folder and the `.rpgeo` extension |
| 012 | Price component placement: six components, one order, two not stages |
| 013 | A project's folder is derived from its note |
| 014 | Library-scoped asset geometry sidecar |
| 015 | The asset designer is its own workspace view, per asset |
| 016 | A Room-classified Zone presents as Room; every other type as Area |
| 017 | Plan presents as Floor; no Floor, Building or Property entity |

Deferred, each with a trigger (the consolidation report holds the evidence):

| ADR | Question | Trigger |
|---|---|---|
| HI | Property → Building → Floor persistence | two buildings, or two plans aligned as floors |
| EPW | Existing / Planned / Work representation | the first Existing or Planned record |
| SO | polygon-only sidecar → walls and openings | the first non-polygon spatial object |
| RL | one relationship mechanism between spatial targets and vault records | the first Work item or evidence link |
| SV | which additive changes stay at v1 | the first key that moves or changes meaning |
| RK | a room KIND (kitchen, bathroom…) beside the Room/Area split | the first query BY kind |

---

# 90. MVP Architecture Slice

```text
Plugin Bootstrap
      │
      ▼
Plan Editor View
      │
      ▼
Vue + Pinia
      │
      ▼
Konva Renderer
      │
      ▼
Editor Commands
      │
      ▼
Domain
      │
      ├── Project
      ├── Plan
      ├── Zone
      ├── Asset
      └── Requirement
      │
      ▼
Repositories
      │
      ▼
Markdown + .rpgeo
```

Every entity and mechanism this slice names exists (`CLAUDE.md`); what follows it is feature
work on a proven template.

---

# 91. MVP Technical Increments

These seven increments are the plan 0.1 was written against, and all seven have landed. They are
kept because the requirement notes cite them; what each actually delivered, withdrew or narrowed
is in the increment history, and current sequencing lives in `docs/tasks/` and in each design
package's own implementation plan.

## Increment 1 — Plugin Foundation

Deliver:

- Vite build
- Vue mounting
- Pinia
- Vitest
- plugin bootstrap
- settings
- workspace view
- architecture dependency rules

Success:

> Empty Renovation Planner view opens reliably inside Obsidian.

## Increment 2 — Domain Foundation

Deliver:

- identity
- units
- geometry primitives
- Result
- errors
- Project
- Plan
- Zone

Success:

> Domain can be instantiated and tested without Obsidian.

## Increment 3 — Persistence

Deliver:

- Project repository
- Plan repository
- Zone repository
- Zod validation
- Vault indexing
- geometry sidecar format

Success:

> Project, Plan, and Zone survive unload/reload.

## Increment 4 — Canvas

Deliver:

- Konva Stage
- viewport
- pan
- zoom
- background layer
- spatial layer
- selection layer

Success:

> Persisted domain geometry renders independently from canvas coordinates.

## Increment 5 — Calibration

Deliver:

- calibration tool
- world/screen transform
- distance calculation
- scale persistence

Success:

> Imported plan can produce real-world measurements.

## Increment 6 — Zone Editing

Deliver:

- polygon tool
- selection
- move
- edit vertices
- delete
- undo/redo

Success:

> User can create and safely modify persistent spatial zones.

## Increment 7 — Assets & Requirements

Deliver:

- Asset
- Requirement
- area-based requirement calculation
- unit price
- estimated cost

Success:

```text
Zone Geometry
→ Area
→ Requirement
→ Cost
```

works end to end.

---

# 92. Architecture Completion Criteria

The technical foundation is successful when:

1. Domain logic runs without Obsidian.
2. Domain logic runs without Vue.
3. Domain logic runs without Konva.
4. UI communicates through commands and queries.
5. Konva stores no canonical business data.
6. Pinia stores no canonical persistent data.
7. Vault files remain understandable without the plugin.
8. All persistence input is runtime validated.
9. Schema migrations can be introduced without redesign.
10. Geometry uses real-world coordinates.
11. Editor actions can participate in undo/redo.
12. Geometry and cost calculations have deterministic unit tests.
13. A broken project file does not prevent the entire plugin from loading.
14. Project indexes can always be rebuilt from the Vault.
15. New views can reuse the same application/domain layers.
16. The user-facing vocabulary and the persisted vocabulary are joined by one tested projection,
    and no homeowner label is persisted.
17. Every surface distinguishes *unavailable*, *empty*, *unreadable* and *stale*.

---

# 93. Target Architectural Outcome

```text
                  Renovation Planner
                         │
                 ┌───────┴────────┐
                 │                │
             Obsidian UI       Bases UI
                 │                │
                 └───────┬────────┘
                         │
                    Application
                         │
              Commands / Queries
                         │
       ┌─────────────────┼──────────────────┐
       │                 │                  │
   Spatial            Project            Financial
    Domain             Domain             Domain
       │                 │                  │
       └─────────────────┼──────────────────┘
                         │
                        Core
                         │
        Geometry · Units · Money · Events
                         │
                         ▼
                    Repository Ports
                         ▲
                         │
                 Obsidian Adapters
                         │
                         ▼
                 Obsidian Vault
```

The architecture separates:

> **what the renovation project means**

from:

> **how Obsidian stores it**

and from:

> **how Konva renders it.**

This separation allows the Renovation Planner to grow from a spatial planning tool into a broader renovation project management system without requiring fundamental architectural rewrites.

---

# 94. Vocabulary Projection

The editor exposes homeowner concepts and hides geometric implementation concepts (editor
principle 8; PRD amendment). The two vocabularies are joined in the presentation layer by one
projection, tested end to end, and never by a rename or a persisted discriminator.

| Homeowner term | Presentation read model | Domain | Persisted | Decision |
|---|---|---|---|---|
| Renovation project | `ProjectSummaryDto` | `Project` | `renovation-project` | retain |
| Floor | `FloorDto` (a `PlanDto` with the project's name beside it) | `Plan` | `renovation-plan` | ADR-0017 |
| Room | `SpatialRecordDto` kind `room` | `Zone` with `zoneType === 'Room'` | `renovation-zone`, `zone-type: room` | ADR-0016 |
| Area (garden, terrace, driveway, roof, construction area, other) | `SpatialRecordDto` kind `area` | `Zone`, any other `ZoneType` | same | ADR-0016 |
| Reference plan | plan background + calibration state | `PlanBackgroundRef`, `Calibration` | plan note + sidecar `calibration` | — |
| Material | `RequirementInspectorDTO` | `Asset` + `Requirement` | two notes | partial |
| Project price | price rows | `AssetPriceOverride` | `renovation-asset-price` | — |
| Wall, Door, Window, Opening | — | — | — | ADR-SO |
| Existing / Planned / Work | — | — (NOT `ZoneStatus`) | — | ADR-EPW |
| Documents / Photos / Notes | — | — | — | ADR-RL |
| Property, Building | breadcrumb has two segments | — | — | ADR-HI |

Rules:

- The projection carries the `ZoneId` unchanged, so canvas, list, Inspector and note share one
  identity.
- Area, perimeter and any other derived figure are computed in the projection from geometry,
  never copied into a note.
- Labels are locale keys (`editor.zone-type.<type>`), so the seven zone types read as Room,
  Garden, Terrace, Driveway, Roof, Construction area, Other in the reader's language.
- A room KIND (kitchen, bathroom…) is unmodelled: *Add → Room* offers name suggestions and
  persists the visible name only (ADR-RK deferred).
- Words the user never meets on a primary surface: *Zone, Polygon, Vertex, Scene, Layer* (as a
  Konva term), *Calibrate* (as a tool).

---

# 95. Navigation and View State

**Obsidian's own view state and history are the navigation authority.** No router, no second
history stack, no selection duplicated in a store (the vue-router refusal and its trigger are in
`CLAUDE.md`).

- A view's subject is written by `getState` and restored by `setState`; a restored value is
  validated as `unknown`. `''` means "no subject" everywhere a subject is optional, never an
  absent key.
- In-app navigation goes through `leaf.setViewState` with `history` set, so the pane's own back
  and forward arrows walk it. The in-app *‹ back* SETS a state; the arrow asks Obsidian to
  RESTORE one; both carry the same sentinel.
- The project view REMOUNTS per navigation, which is what keeps its `projectId` from going
  stale.
- Every leaf-creating door (`revealView`, `revealPlanEditor`, `revealAssetDesigner`,
  `openNote`) holds a map of what is in flight, so two activations in one tick open one leaf,
  keyed by what makes two calls the same request. Keying on the type alone would collapse the
  per-plan multiplicity.
- **Open project** goes to the detail state and never straight into the editor. **Resume**
  names its target before it acts (*Home renovation · Ground floor*), validates it, and resolves
  through six ordered cases (P03): both present → open the editor; project present, plan gone →
  detail with a missing-last-plan explanation; project only → detail; project gone → an
  unavailable state with an explicit return, never a redirect loop; read failed → the error,
  with the saved context retained; nothing saved → no Resume entry.
- The Continue context is ONE global last target — `{ projectId, planId | null }` — in plugin
  data, parsed back with fall-back-to-absent. Recording an opening intent and confirming a
  successful opening are different events; an unsuccessful attempt is never recorded as work.
- On return, search text, group preference, scroll and an id-based focus target are restored
  from the leaf-local UI snapshot; if the row is gone, focus falls back to the filter.
- No initial autofocus when a view opens beside a note; user-triggered navigation moves focus
  to the new heading or region.

---

# 96. Editor Interaction Model

The editor is intent-driven rather than tool-driven (spec §88). The technical tools of §57
remain underneath; what the user meets is:

- **Select is the safe home state** (INV-01–03): after load, after a creation, after cancel,
  after Esc, after a perspective change. The user always knows what is selected and whether a
  creation tool is active.
- **One `+ Add` entry point** over a declarative catalogue grouped as Structure (Room, Wall,
  Door, Window, Opening, Stairs), Site (Area, Path, Fence, Structure) and Planning (Object,
  Measurement, Note). An entry the build does not support is labelled so; today Room is
  available and the rest say *not yet*.
- **Creation tools are temporary** and return to Select after one creation; a short banner
  states the gesture and its Esc/Enter hints.
- **Room-first creation** is the beginner path — drag a rectangle with live width and depth,
  or type two lengths — and wall drawing is the precise path (M04, proposed). Direct
  manipulation first, numeric precision on demand, converging on one command.
- **Undo is global and predictable**: one intent, one history entry; a continuous gesture is one
  action.
- **Destructive actions communicate consequences**: a room carrying work, photos or documents
  asks first and names what it carries; an unused object deletes immediately with undo.
- **Three perspectives** — *Plan* (what is the property and how is it arranged), *Renovate*
  (what exists, what changes, what work follows), *Review* (is it complete and coherent) — are
  the design's answer to tool sprawl. Changing perspective returns to Select. They are a PROPOSED
  extension; the context bar reserves their place and the domains behind Renovate and Review
  (§97) do not exist yet.
- Every toolbar command has a keyboard path; shortcuts (V, R, W, D, Esc, Delete, Ctrl/Cmd+Z,
  Ctrl/Cmd+Shift+Z, Space) are secondary affordances and never override an Obsidian command
  without care.
- The empty canvas teaches: *add your first room, or use an existing floor plan as reference*.

---

# 97. Renovation State Model

The homeowner's model distinguishes **Existing** (what is here), **Planned** (the intended
result) and **Work** (the transformation between them), with change states *unchanged / remove
/ modify / add*. None of it is implemented, and this section reserves the seams so that nothing
built now conflates them.

Constraints already binding:

- **State is not a layer.** Existing and Planned are semantic states of the same entity — a wall
  that is *existing: brick, planned: removed* is one wall — not two visibility layers (spec §7).
- **`ZoneStatus` is a progress axis** (planned / in progress / complete) and is never read as
  Existing or Planned. The consolidation report rates misuse here as its one high-severity gap.
- **A change is a state on an object, not a second object** (business rule), so Existing and
  Planned will be represented on the entity or as a comparison, decided by ADR-EPW — the spec's
  own open question 7.
- **Work belongs to one project** and is linked to one or more stable spatial target ids by the
  single relationship mechanism ADR-RL will decide; the same mechanism carries evidence
  (documents, photos, notes) at every granularity from project to point (spec §71).
- The canvas will communicate change states without the Inspector — line weight and dash for
  existing, removed, new and modified — with colour never the only channel (§84).
- Until these arrive, the Inspector shows their sections as **not yet supported** (§59). The
  next increment after the room slice is *Existing → Planned → Work for one selected room*, one
  truthful relationship before Materials and Costs widen the chain.

---

# 98. Reference Plan Workflow

An imported floor plan is **reference material**, not editable geometry. Its lifecycle is a
three-step contextual setup (M06), persisted as one transaction, and it replaces the permanent
Calibrate tool 0.1 implied:

```text
Prepare   → choose page (PDF), rotate, crop
Set scale → draw over one known distance, enter its real length; the scale is derived
Review    → confirm scale, opacity and alignment; Locked is on by default
```

- Cancel restores the prior reference state, if any.
- *Choose another distance* clears the calibration draft and keeps the prepared source.
- The layer row shows *available* or *supported-empty*, and offers *Set scale* as its action.
- An unreadable source is a named state (*Reference unavailable*), never an empty layer.
- A plan may exist with no reference at all: drawing rooms first and importing later is a valid
  order (M05).

---

# 99. Asset Library and Asset Designer

**The library** is one vault-wide catalogue in its own singleton view (AL00–AL11), reached by
command or from the project overview. It is not the *Library* pane 0.1's shell drew inside the
editor.

- Category shelves with aligned columns and a right inspector; empty categories stay visible and
  disabled for the current small taxonomy; order comes from the production vocabulary, never
  from demo fixtures.
- Search matches name, supplier and SKU (and category), case-insensitively; it changes no data,
  keeps the selection, and restores prior group expansion when cleared.
- The inspector shows identity, *Used in* (project, requirement count, price source: library or
  project-specific), the definition fields, and the shape as a read-only measured outline with
  *Edit shape* and *Open note*. Usage may be loading, empty or failed while the definition is
  readable; a failed usage read never means unused.
- Reads are ticketed per selection (§14). Definition, geometry and usage load independently.
- A category icon is never proof of geometry: *not read, no shape, unscaled, measured, read
  failed* are distinct states, and *Open designer* is withdrawn for a refusal rather than
  offered inert.
- Delete is a secondary action that re-checks references at commit, never removes requirements,
  and is blocked with a reason while usage is unknown. An empty library after a delete enters
  the empty state (AL08), which is distinct from *unreadable*.
- Creating an asset needs no project and no outline; zero is a deliberate price, not a stand-in
  for unknown.

**The designer** is one view per asset (ADR-0015), keyed by `assetId`, drawing the footprint,
clearance, anchor and facing on the same gesture surface and tool context the plan editor uses.
A dangling asset closes its leaf with an explanation rather than offering a retry that cannot
succeed.

---

# 100. Project Surface

The **Renovation project** view has two states (P00–P07), both drawn over the same queries
(§35) and the same state matrix (§66, §87).

**The list is a launcher**, not a portfolio: title and *New project*, immediate search that
doubles as the count line, an optional *Resume* group naming its target, active projects, and a
collapsed *Completed* disclosure. A row carries name, domain status, plan count and currency.
Nothing on it is a cross-project total, a progress percentage or a thumbnail; *last worked* is
not *last opened*. A truly empty vault gets one primary creation action; a vault whose projects
all refused to read does not say *No projects yet*.

**The detail state** answers *What would you like to do next?*: header (*All projects*, name,
status, currency, *Open project note*), then plans expanded with *New plan* secondary, then
project prices. The three guided entries — *Describe your renovation*, *Start with a plan*,
*Set project prices* — are a design proposal: neither a wizard nor a checklist, their order never
changes, opening one marks nothing complete, and hiding them is leaf-session UI state and never
a frontmatter field. Having no plan is not an error.

**Project prices** identify the project and its currency and explain catalogue price against
project price against the price in use. A project price never changes the catalogue; there are
no totals without quantities and no implicit currency conversion; write conflicts keep the draft
and show the current value (§101).

---

# 101. Write Outcomes and Drafts

Every surface that edits a value distinguishes four things, and never lets one impersonate
another:

```text
draft  →  saved value  →  value in use  →  displayed value
```

- A **draft** belongs to one entity id and one baseline version and is never written to a note
  or a global store on its own. Search, group expansion and layout changes preserve it and need
  no guard; another selection, creation, note or designer navigation, project navigation and a
  closing leaf DO, with *Keep editing* as the safe default, *Discard and continue* as the
  alternative, and Esc meaning *Keep editing*. The pending action runs exactly once after a
  discard.
- A **write** is one dispatch with an expected version; a busy control prevents a second commit;
  a rejection keeps the draft and its field errors; an unknown outcome is resolved before any
  non-idempotent retry.
- **Saved** is claimed for the write that was confirmed and for nothing downstream of it.
- A **conflict** (the value changed elsewhere since the baseline) shows the current value and
  asks; there is no silent last-write-wins.
- No autosave is introduced to paper over any of this, and a forced termination of Obsidian
  promises no recovery.

**One decision is open and recorded as an issue rather than taken here:** the shipped Inspector
and price rows commit a field on blur or Enter through one shared composable, and both the
project package and the library package ask for an explicit Apply/Save with a local draft. The
composable is shared with the plan editor, so this is one decision across three surfaces, not a
per-surface preference.

---

# 102. Localization

- Every user-visible string resolves through the pure `t(language, key)` lookup in
  `presentation/i18n/`; error codes through `trError`. English is the complete table and derives
  the key type; German is partial and falls back per string.
- The language is Obsidian's `getLanguage()`. There is no plugin language setting.
- Two lint rules hold the boundary where a gate can: `I18N_LITERAL_BAN` at six call sites and
  `NOTICE_TEXT_BAN` at the notice door; the remaining UI text (settings `name`/`desc`,
  `getDisplayText`) is compliant by convention, and `CLAUDE.md` names the blind spots as blind
  spots.
- Sentence case, plain, no exclamation — a marketplace rule linted on the English table. German
  noun capitalization sits outside it.
- Interpolated values are placeholders interpolated safely; a project or plan name is user
  content, never a translated string. Units and currency are the project's, not the reader's.
- Concept images in the packages carry German labels as localization references; the English
  prose defines behaviour.

---

# 103. Design Authority and Precedence

Where a question is decided, in order:

1. **An explicit user decision**, then a newer product decision over an older one.
2. **`PRODUCT.md` and the PRDs** for what the product IS: scope stages, personas, mobile
   read-only, WCAG 2.2 AA, the committed vocabulary.
3. **The design packages** for what the user SEES on each surface: editor (M00–M17, a locked
   visual direction), project (P00–P07, designed), asset library (AL00–AL11, selected direction;
   interaction contracts proposed). Each package states its own evidence boundary — generated
   images, not screenshots; no user validation — and proposes its own backlog, whose disposition
   is the adoption ledger's to record, not a package's to assert.
4. **This SDD** for how it is BUILT, and **the ADRs** for why each structural decision went the
   way it did. Where this document and `CLAUDE.md` disagree, this document is the authority and
   the guide is the bug.
5. **The business rules** in `docs/product/business-rules/` as the prose form of domain
   invariants the code and tests hold.
6. **The journey catalogue** for user goals across surfaces; it extracts, it does not add
   requirements.

What is proposed in a package and not adopted is not described here as architecture. What is
deferred is named with its trigger (§89), so the next reader finds the decision waiting rather
than an absence.
