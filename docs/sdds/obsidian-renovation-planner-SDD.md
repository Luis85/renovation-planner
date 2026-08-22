# Software Design Document
## Renovation Planner

**Status:** Draft  
**Version:** 0.1  
**Product Type:** Obsidian Community Plugin  
**Primary Language:** TypeScript  
**UI Stack:** Vue 3 · Pinia  
**Build Tool:** Vite  
**Test Framework:** Vitest  
**Rendering:** Konva · vue-konva  
**Persistence:** Obsidian Vault · Markdown · YAML Properties · JSON Sidecars  
**Architecture Style:** Modular · Layered · Domain-Oriented · Local-First · Event-Aware

---

# 1. Purpose

This Software Design Document defines the technical foundation and target architecture of the Renovation Planner.

The system is an Obsidian plugin for spatially planning and managing renovation projects.

It combines:

- spatial planning
- floor and site plan visualization
- renovation zones
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

The MVP should remain simple:

```text
Plan
→ Calibration
→ Zones
→ Assets
→ Quantities
→ Costs
```

---

# 4. Technical Context

The plugin runs inside Obsidian.

Primary integration surfaces:

- plugin lifecycle
- workspace views
- commands
- Vault API
- FileManager
- metadata cache
- Bases views
- settings

---

# 5. Technology Stack

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
@vueuse/core
```

## Rendering

```text
Konva
vue-konva
```

## Validation

```text
zod
```

## Financial Calculations

```text
decimal.js
```

## Geometry

```text
custom geometry-core
clipper2-ts
rbush
```

## Date Handling

```text
dayjs
```

## Document Handling

```text
pdfjs-dist
pdf-lib
```

## Testing

```text
vitest
@vue/test-utils
jsdom
```

---

# 6. High-Level Architecture

```text
┌──────────────────────────────────────────────────────┐
│                       Obsidian                        │
│                                                      │
│   Workspace Views              Bases Views           │
│          │                          │                │
└──────────┼──────────────────────────┼────────────────┘
           │                          │
           └────────────┬─────────────┘
                        ▼
                 Presentation Layer
                        │
            ┌───────────┴────────────┐
            │                        │
          Vue 3                   Pinia
            │
            ▼
       Editor Adapter
            │
        vue-konva
            │
          Konva
            │
        Canvas / DOM

──────────────────────────────────────────────────────

                  Application Layer

                  Commands / Queries
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼
     Geometry          Cost          Scheduling
     Services        Services          Services
        │               │                │
        └───────────────┼────────────────┘
                        ▼
                     Domain

──────────────────────────────────────────────────────

                     Core Layer

              Geometry · Units · Money
              IDs · Results · Events

──────────────────────────────────────────────────────

                Infrastructure Layer

             Obsidian Repositories
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
      Markdown      JSON      Files
      Properties   Sidecars   Images/PDF
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
├── identity/
├── events/
├── errors/
└── result/
```

## 7.2 Domain Layer

Renovation-specific business rules.

```text
domain/
├── project/
├── site/
├── plan/
├── spatial-object/
├── zone/
├── construction-section/
├── asset/
├── requirement/
├── trade/
├── work-package/
├── task/
├── cost/
├── procurement/
├── supplier/
├── quote/
├── schedule/
├── document/
├── risk/
└── decision/
```

Each module may contain:

- entities
- value objects
- domain services
- domain events
- business rules
- schemas

## 7.3 Application Layer

Coordinates use cases.

Responsibilities:

- loading entities
- invoking domain logic
- validating operations
- calling repositories
- publishing events
- coordinating transactions
- returning results to UI

```text
application/
├── commands/
├── queries/
├── services/
├── ports/
└── event-handlers/
```

## 7.4 Infrastructure Layer

Concrete implementations for external concerns.

```text
infrastructure/
├── obsidian/
│   ├── repositories/
│   ├── vault/
│   ├── workspace/
│   ├── bases/
│   └── settings/
├── persistence/
├── import/
├── export/
└── logging/
```

## 7.5 Presentation Layer

Contains:

- Vue components
- Pinia stores
- Workspace views
- Bases views
- editor tools
- inspector panels
- dialogs
- toolbars

```text
presentation/
├── views/
├── components/
├── stores/
├── composables/
├── editor/
└── bases/
```

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

---

# 9. Plugin Bootstrap

The plugin entry point should remain small.

```text
RenovationPlannerPlugin

onload()
 ├── load settings
 ├── initialize dependency container
 ├── register workspace views
 ├── register Bases views
 ├── register commands
 ├── register vault listeners
 └── initialize project index

onunload()
 ├── flush pending writes
 ├── stop listeners
 └── dispose services
```

No domain logic belongs in the plugin entry point.

---

# 10. Dependency Composition

Dependencies are composed centrally.

```text
CompositionRoot

├── repositories
├── application services
├── event bus
├── query services
└── settings
```

---

# 11. Workspace Views

Primary surfaces:

- Renovation Project
- Plan Editor

Future:

- Budget
- Schedule
- Procurement
- Dashboard

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
      ├── Pinia
      └── ViewRoot.vue
```

Unmount when the Obsidian view closes.

---

# 13. Bases Integration

Potential custom Bases views:

- Renovation Plan
- Budget
- Assets
- Procurement
- Schedule
- Risk

No separate Bases-specific domain model.

---

# 14. State Management

Pinia manages application-facing and UI state.

Recommended stores:

```text
ProjectStore
EditorStore
SelectionStore
InspectorStore
WorkspaceStore
```

Pinia is not the persistent source of truth.

---

# 15. Persistent vs Ephemeral State

Persistent:

- project
- plan
- zone
- asset
- construction section
- work package
- cost data
- geometry

Ephemeral:

- hover
- context menu
- drag state
- temporary polygon
- selection marquee
- active tool

Settings:

- default units
- default folders
- editor preferences

---

# 16. Spatial Rendering Architecture

```text
Domain Spatial Object
        ↓
Render Model
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
```

Konva objects are never written directly to the Vault.

---

# 17. Konva Scene Structure

```text
Stage
│
├── BackgroundLayer
├── ArchitectureLayer
├── ZoneLayer
├── ConstructionLayer
├── AssetLayer
├── AnnotationLayer
└── InteractionLayer
```

---

# 18. Background Layer

Contains:

- imported plans
- images
- rendered PDF pages

This layer should redraw rarely.

---

# 19. Interaction Layer

Transient only:

- selection handles
- snap guides
- measure previews
- drawing previews
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

Recommended:

```text
1 world unit = 1 millimeter
```

Domain geometry uses real-world coordinates, never screen pixels.

---

# 24. Viewport Transform

Centralized functions:

```text
worldToScreen()
screenToWorld()
```

Transformation components:

- translation
- zoom
- rotation
- device pixel ratio

---

# 25. Calibration

A Plan calibration defines how background pixels map to world coordinates.

Minimum:

- Point A
- Point B
- known real-world distance

---

# 26. Geometry Validation

Validate before persistence:

- polygon has >= 3 vertices
- finite coordinates
- no NaN
- no Infinity
- valid unit
- valid transform

Future:

- self-intersection detection
- winding normalization
- polygon repair

---

# 27. Advanced Polygon Operations

Use an adapter around `clipper2-ts`.

Operations:

- union
- intersection
- difference
- offset

No Clipper-specific types escape Infrastructure/Core adapters.

---

# 28. Spatial Index

Use `rbush` when needed.

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

Examples:

- CreateProjectCommand
- CreatePlanCommand
- CalibratePlanCommand
- CreateZoneCommand
- MoveSpatialObjectCommand
- ResizeSpatialObjectCommand
- DeleteSpatialObjectCommand
- CreateAssetCommand
- AssignAssetCommand
- CreateRequirementCommand
- RecalculateRequirementCommand
- CreateWorkPackageCommand
- CompleteWorkPackageCommand

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

---

# 31. Transaction Boundary

One user intent equals one logical transaction.

```text
Drag Zone
  ↓
MoveZoneCommand
  ↓
ONE domain change
ONE history item
ONE persistence operation
```

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

---

# 33. Event Bus

Initial implementation: in-process synchronous or promise-aware bus.

No external event infrastructure.

---

# 34. Domain Events

Initial catalog:

- ProjectCreated
- PlanCreated
- PlanCalibrated
- ZoneCreated
- ZoneGeometryChanged
- ZoneDeleted
- AssetCreated
- AssetAssigned
- RequirementCreated
- RequirementRecalculated
- ConstructionSectionCreated
- WorkPackageCreated
- WorkPackageCompleted
- CostChanged
- BudgetChanged

---

# 35. Query Architecture

Queries are read-only.

Examples:

- GetProject
- GetPlan
- GetZone
- GetProjectBudget
- GetConstructionSectionSummary
- GetAssetsForZone
- GetRequirementsForWorkPackage

---

# 36. Repository Pattern

Example:

```ts
interface ZoneRepository {
  getById(id: ZoneId): Promise<Zone | null>;
  save(zone: Zone): Promise<void>;
  delete(id: ZoneId): Promise<void>;
  listByProject(projectId: ProjectId): Promise<Zone[]>;
}
```

Concrete implementation:

```text
ObsidianZoneRepository
```

---

# 37. Obsidian Repository Layer

Explicit mapping:

```text
Markdown / Frontmatter
        ↕
Persistence DTO
        ↕
Domain Entity
```

Raw frontmatter must not leak throughout the application.

---

# 38. Markdown Entity Model

Example:

```yaml
---
type: renovation-zone
schema-version: 1

id: zone-01HXYZ
project: project-01HABC
plan: plan-ground-floor

name: Bathroom
zone-type: room
status: planned
---
```

The note body remains free-form.

---

# 39. Sidecar Files

Recommended initial strategy:

> Store plan geometry per plan rather than one sidecar per spatial object.

Example:

```text
plans/
├── Ground Floor.md
└── Ground Floor.geometry.json
```

---

# 40. Plan Sidecar Schema

```json
{
  "schemaVersion": 1,
  "planId": "plan-ground-floor",
  "objects": [
    {
      "id": "zone-bathroom",
      "type": "polygon",
      "points": []
    }
  ]
}
```

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

---

# 42. Persistence Consistency

A spatial entity may span:

```text
Markdown metadata
+
Plan geometry sidecar
```

Updates affecting both are treated as one logical transaction.

Failure handling should preserve previous valid data where practical.

---

# 43. Schema Validation

Use Zod.

```text
raw data
  ↓
schema parse
  ↓
persistence DTO
  ↓
domain mapping
```

Invalid persisted data must not silently enter the domain.

---

# 44. Schema Versioning

Every persistent format carries a schema version.

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
Entity Resolver
      ↓
Validation
      ↓
Project Index Update
      ↓
Pinia/View Refresh
```

---

# 47. Project Index

Avoid repeated full-Vault scans.

Responsibilities:

```text
entity ID → file path
entity type → IDs
project ID → entity IDs
plan ID → spatial objects
```

The index is rebuildable from Vault data.

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

---

# 49. Money

Never use native floating-point arithmetic directly for financial calculations.

Use `decimal.js`.

Domain concept:

```text
Money
├── amount
└── currency
```

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
Waste
   ↓
Purchase Quantity
```

---

# 51. Cost Pipeline

```text
Requirement
   ↓
Quantity
   ↓
Unit Price
   ↓
Discount
   ↓
Shipping
   ↓
Tax
   ↓
Estimated Cost
```

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

The UI must distinguish calculated from overridden values.

---

# 53. Scheduling Architecture

Not an MVP core requirement, but domain boundaries should support:

- WorkPackage
- Task
- Milestone
- Dependency
- DateRange

A future Gantt renderer remains an adapter.

---

# 54. Document Import

Images:

- PNG
- JPEG

PDF:

```text
PDF
 ↓
PDF.js
 ↓
Rendered Page
 ↓
Plan Background
```

Original files remain in the Vault.

---

# 55. Asset Handling

Imported assets remain Vault files.

Plans reference Vault-relative paths.

No base64 embedding.

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

---

# 57. Initial Editor Tools

- SelectTool
- PanTool
- DrawPolygonTool
- PlaceAssetTool
- MeasureTool
- AnnotationTool

Future:

- WallTool
- OpeningTool
- PathTool
- BooleanTool

---

# 58. Editor Context

Tools receive controlled access to:

- viewport
- selection
- snap service
- command dispatcher
- render state
- active plan

Tools must not call repositories directly.

---

# 59. Inspector Architecture

```text
Selection
   ↓
Inspector Query
   ↓
Inspector DTO
   ↓
Vue UI
```

Edits become commands.

---

# 60. UI Layout

```text
┌────────────────────────────────────────────────────┐
│ Toolbar                                            │
├──────────────┬──────────────────────┬──────────────┤
│ Layers       │                      │ Inspector    │
│ Objects      │      Plan Canvas     │ Properties   │
│ Assets       │                      │ Relations    │
├──────────────┴──────────────────────┴──────────────┤
│ Status / Measurements / Save State                │
└────────────────────────────────────────────────────┘
```

---

# 61. Responsive Strategy

MVP optimized for Obsidian desktop.

Avoid unnecessary Electron/Node-specific dependencies where possible to preserve future mobile/read-only options.

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

Categories:

- DomainError
- ValidationError
- PersistenceError
- GeometryError
- ImportError
- MigrationError
- ReferenceError
- CalculationError

---

# 65. Result Pattern

Expected business failures should use typed `Result<T,E>` style handling.

Unexpected technical failures may throw and be translated at application boundaries.

---

# 66. Error Boundary

```text
Infrastructure Exception
        ↓
Application Error Mapping
        ↓
Typed Result
        ↓
Presentation
        ↓
User Message
```

---

# 67. Logging

Local logger levels:

- debug
- info
- warn
- error

Logs never leave the device automatically.

---

# 68. Diagnostics

May expose:

- plugin version
- Obsidian version
- schema version
- migration state
- entity validation issues

Do not include project content unless explicitly exported.

---

# 69. Testing Strategy

```text
                    E2E
                     ▲
                Integration
                     ▲
                 Component
                     ▲
                   Unit
```

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

Use in-memory repositories.

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

---

# 74. Canvas Tests

Focus on adapter behavior:

- polygon renders expected points
- transform completion emits correct command
- selection emits domain ID

Geometry correctness remains in unit tests.

---

# 75. Integration Test Vault

```text
tests/
└── vault/
    ├── valid-project/
    ├── broken-references/
    ├── legacy-schema/
    └── large-project/
```

---

# 76. Architecture Test Rules

Automated restrictions should ensure:

```text
domain/** may not import:
  vue
  pinia
  konva
  obsidian
```

Possible tooling:

- ESLint import restrictions
- dependency-cruiser

---

# 77. Proposed Repository Structure

```text
renovation-planner/
│
├── manifest.json
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
│
├── src/
│   ├── main.ts
│   ├── plugin/
│   │   ├── RenovationPlannerPlugin.ts
│   │   ├── composition-root.ts
│   │   └── settings/
│   │
│   ├── core/
│   │   ├── geometry/
│   │   ├── units/
│   │   ├── money/
│   │   ├── identity/
│   │   ├── events/
│   │   ├── errors/
│   │   └── result/
│   │
│   ├── domain/
│   │   ├── project/
│   │   ├── plan/
│   │   ├── spatial-object/
│   │   ├── zone/
│   │   ├── construction-section/
│   │   ├── asset/
│   │   ├── requirement/
│   │   ├── trade/
│   │   ├── work-package/
│   │   ├── task/
│   │   ├── cost/
│   │   ├── procurement/
│   │   ├── supplier/
│   │   ├── schedule/
│   │   ├── risk/
│   │   └── decision/
│   │
│   ├── application/
│   │   ├── commands/
│   │   ├── queries/
│   │   ├── services/
│   │   ├── ports/
│   │   └── events/
│   │
│   ├── infrastructure/
│   │   ├── obsidian/
│   │   │   ├── repositories/
│   │   │   ├── vault/
│   │   │   ├── workspace/
│   │   │   ├── bases/
│   │   │   └── settings/
│   │   ├── geometry/
│   │   ├── documents/
│   │   ├── import/
│   │   ├── export/
│   │   └── logging/
│   │
│   └── presentation/
│       ├── views/
│       ├── bases/
│       ├── components/
│       ├── stores/
│       ├── composables/
│       └── editor/
│           ├── canvas/
│           ├── layers/
│           ├── tools/
│           ├── snapping/
│           ├── selection/
│           └── inspector/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── contracts/
│   ├── fixtures/
│   └── vault/
│
└── docs/
    ├── PRD.md
    ├── SDD.md
    ├── domain-model.md
    ├── event-catalog.md
    └── ADR/
```

---

# 78. Internal Module Pattern

Example:

```text
domain/zone/

├── Zone.ts
├── ZoneId.ts
├── ZoneType.ts
├── ZoneStatus.ts
├── ZoneGeometry.ts
├── Zone.schema.ts
├── Zone.errors.ts
└── Zone.events.ts
```

Commands:

```text
application/commands/zone/

├── CreateZone.ts
├── UpdateZone.ts
├── DeleteZone.ts
└── MoveZone.ts
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

---

# 82. Entity IDs

Persistent entities use stable IDs independent from filenames.

Recommended:

- UUID
- or ULID

Example:

```text
zone-01JABC...
asset-01JDEF...
```

---

# 83. Entity References

References use stable IDs.

Markdown links may additionally be stored for navigation.

Filename alone is never identity.

---

# 84. CSS and Theme Integration

Use Obsidian CSS variables where practical.

Avoid hard-coded global palettes.

Support:

- light themes
- dark themes
- custom themes

---

# 85. Accessibility

Core requirements:

- keyboard-accessible controls
- visible focus
- semantic labels
- status not encoded only by color
- alternative data access via lists/Bases
- adequate hit targets

---

# 86. Security and Privacy

Default:

```text
no telemetry
no remote calls
no account
no cloud persistence
```

Future integrations are explicit and optional.

---

# 87. Data Safety

Rules:

1. never develop against production Vaults
2. validate before write
3. preserve unknown Markdown content
4. avoid full-note rewrites where targeted changes suffice
5. never cascade-delete silently
6. maintain migration tests
7. fail closed on unsupported schema versions

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

Primary workflows should require minimal editor knowledge.

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

## ADR-001 — Markdown as Canonical Metadata Storage

Human-readable project metadata is stored in Markdown and Properties.

## ADR-002 — JSON Sidecar for Plan Geometry

High-volume geometry is stored per plan in JSON sidecars.

## ADR-003 — Konva as Canvas Renderer

Konva handles 2D rendering and interaction.

## ADR-004 — Vue 3 for Plugin UI

Vue 3 is used for composition.

## ADR-005 — Pinia for Presentation State

Pinia manages UI/application state, not persistent truth.

## ADR-006 — Plain TypeScript Domain

Core/domain cannot depend on Vue, Konva, Pinia, or Obsidian.

## ADR-007 — Command-Based Mutations

User-visible mutations are routed through commands.

## ADR-008 — Event-Aware Architecture

Commands may emit domain/application events.

## ADR-009 — World Coordinates in Millimeters

Spatial geometry uses real-world units.

## ADR-010 — Decimal Money Arithmetic

Financial calculations use decimal arithmetic.

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
Markdown + Plan JSON
```

---

# 91. MVP Technical Increments

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
