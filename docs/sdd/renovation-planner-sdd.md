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

## 1. Purpose

This Software Design Document defines the technical foundation and target architecture of the Renovation Planner.

The system is an Obsidian plugin for spatially planning and managing renovation projects.

It combines:

* spatial planning,
* floor and site plan visualization,
* renovation zones,
* construction sections,
* assets and materials,
* quantity calculation,
* cost planning,
* trades,
* work packages,
* tasks,
* procurement,
* scheduling,
* project documentation.

The architecture must support the product vision while keeping the implementation maintainable, testable, portable, and independent from individual UI or rendering technologies.

---

## 2. Architectural Goal

The central architectural principle is:

> The Obsidian Vault is the persistent source of truth, while Vue, Pinia, and Konva are replaceable presentation and interaction technologies.

The system must therefore avoid coupling domain logic to:

* Obsidian API classes,
* Vue components,
* Pinia stores,
* Konva objects,
* browser DOM structures.

The intended dependency direction is:

```
UI
 ↓
Application
 ↓
Domain
 ↓
Core
```

Infrastructure implements interfaces defined by the inner layers.

```
Infrastructure
      ↓
Application Ports
      ↓
Domain
```

---

## 3. Design Principles

### 3.1 Local First

All project data is stored locally inside the user's Obsidian Vault.

Core functionality must not depend on:

* remote databases,
* SaaS APIs,
* cloud accounts,
* telemetry services.

---

### 3.2 Markdown Native

Human-readable project entities should be represented as Markdown files wherever practical.

Examples:

* Project
* Plan
* Zone
* Construction Section
* Asset
* Trade
* Work Package
* Requirement
* Supplier
* Quote
* Risk
* Decision

---

### 3.3 Domain First

The business model must exist independently from rendering and persistence.

A Zone is not a Konva polygon.

A WorkPackage is not a Markdown file.

A Requirement is not a Pinia object.

These technologies are representations of domain concepts.

---

### 3.4 Framework Independence

Core modules should use plain TypeScript.

The following dependencies are prohibited inside the Domain and Core layers:

```
vue
pinia
konva
vue-konva
obsidian
DOM APIs
```

---

### 3.5 Explicit State Changes

Business-changing operations should be represented through application commands.

Examples:

```
CreateZone
MoveSpatialObject
AssignAsset
CreateRequirement
RecordCost
CompleteWorkPackage
```

This provides a foundation for:

* undo/redo,
* validation,
* event generation,
* persistence,
* testing,
* auditability.

---

### 3.6 Derived Data over Duplicate Data

Values that can reliably be calculated should not be stored redundantly unless a manual override or historical snapshot requires persistence.

Example:

```
Polygon
   ↓
Area
   ↓
Material Requirement
   ↓
Estimated Cost
```

---

### 3.7 Progressive Complexity

The architecture must allow the initial product to remain simple.

MVP:

```
Plan
→ Calibration
→ Zones
→ Assets
→ Quantities
→ Costs
```

without requiring advanced functionality such as:

* BIM,
* CAD,
* 3D,
* scheduling engines,
* procurement workflows.

---

## 4. Technical Context

The plugin runs within the Obsidian application environment.

Obsidian plugins are implemented using TypeScript and can register custom workspace views and commands through the official plugin API. (Developer Documentation)

Obsidian also supports custom Bases views through `registerBasesView()`, allowing plugins to provide custom visualizations based on the same note/property data used by Bases. Obsidian invokes `onDataUpdated()` when relevant underlying data or configuration changes. (Developer Documentation)

This enables the Renovation Planner to expose both:

Dedicated Workspace Views

and:

Bases Views

over the same domain data.

---

## 5. Technology Stack

**Core Runtime**

```
TypeScript
```

**Host Platform**

```
Obsidian
```

**UI**

```
Vue 3
Pinia
@vueuse/core
```

**Rendering**

```
Konva
vue-konva
```

The current vue-konva package supports Vue 3, ships TypeScript declarations, exposes a core build, and itself uses Vite and Vitest in its development setup. (GitHub)

**Validation**

```
zod
```

**Financial Calculations**

```
decimal.js
```

**Geometry**

```
custom geometry-core
clipper2-ts
rbush
```

**Date Handling**

```
dayjs
```

**Document Handling**

```
pdfjs-dist
pdf-lib
```

**Testing**

```
vitest
@vue/test-utils
jsdom
```

---

## 6. High-Level Architecture

```
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

## 7. Architectural Layers

### 7.1 Core Layer

The Core layer contains generic technical concepts that do not depend on the renovation domain.

Examples:

```
Geometry primitives
Units
Money
Entity IDs
Result types
Domain errors
Date ranges
Event primitives
```

Example structure:

```
core/
├── geometry/
├── units/
├── money/
├── identity/
├── events/
├── errors/
└── result/
```

---

## 8. Domain Layer

The Domain layer implements renovation-specific concepts and business rules.

Suggested modules:

```
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

Each domain module may contain:

```
entities
value objects
domain services
domain events
business rules
schemas
```

---

## 9. Application Layer

The Application layer coordinates use cases.

It is responsible for:

* loading entities,
* invoking domain logic,
* validating operations,
* calling repositories,
* publishing events,
* coordinating transactions,
* returning results to the UI.

Example structure:

```
application/
├── commands/
├── queries/
├── services/
├── ports/
└── event-handlers/
```

---

## 10. Infrastructure Layer

Infrastructure provides concrete implementations for external concerns.

```
infrastructure/
├── obsidian/
│   ├── repositories/
│   ├── vault/
│   ├── workspace/
│   ├── bases/
│   └── settings/
│
├── persistence/
├── import/
├── export/
└── logging/
```

Infrastructure may depend on:

```
obsidian
pdfjs-dist
pdf-lib
```

but Domain must not depend on Infrastructure.

---

## 11. Presentation Layer

The Presentation layer contains:

```
Vue components
Pinia stores
Workspace views
Bases views
Editor tools
Inspector panels
Dialogs
Toolbars
```

Suggested structure:

```
presentation/
├── views/
├── components/
├── stores/
├── composables/
├── editor/
└── bases/
```

---

## 12. Dependency Rule

Dependencies may only point inward.

Valid:

```
Presentation
     ↓
Application
     ↓
Domain
     ↓
Core
```

Valid:

```
Infrastructure
     ↓
Application Ports
```

Invalid:

```
Domain
     ↓
Obsidian
```

Invalid:

```
Geometry Engine
     ↓
Konva
```

Invalid:

```
Cost Engine
     ↓
Pinia
```

---

## 13. Plugin Bootstrap

The Obsidian plugin entry point should remain intentionally small.

Example responsibility:

```
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

The plugin entry point must not contain domain logic.

---

## 14. Dependency Composition

Dependencies should be composed centrally.

Conceptually:

```
CompositionRoot
├── repositories
│
├── application services
│
├── event bus
│
├── query services
│
└── settings
```

Example:

```
ObsidianZoneRepository
          ↓
CreateZoneHandler
          ↓
ZoneService
```

This avoids ad-hoc construction of services inside Vue components.

---

## 15. Workspace Views

Primary application surfaces should initially be implemented as Obsidian workspace views.

Recommended initial views:

```
Renovation Project
Plan Editor
```

Future:

```
Budget
Schedule
Procurement
Dashboard
```

Views should be mounted only when visible where possible.

Obsidian supports deferred view loading, and its documentation recommends avoiding assumptions that custom views are always loaded; forcing deferred views to load should be done sparingly because it removes a performance optimization. (Developer Documentation)

---

## 16. Vue Mounting Strategy

Each Obsidian view receives an isolated Vue application.

Concept:

```
Obsidian ItemView
      │
      ▼
createApp()
      │
      ├── Pinia
      └── ViewRoot.vue
```

The Vue application must be unmounted when the Obsidian view is closed.

---

## 17. Bases Integration

Bases views are considered read-heavy secondary views.

Possible custom Bases views:

```
Renovation Plan
Budget
Assets
Procurement
Schedule
Risk
```

Bases should consume the same canonical note properties used elsewhere.

No separate Bases-specific domain model should exist.

Architecture:

```
Bases Data
    ↓
Bases Adapter
    ↓
Domain Mapping
    ↓
Custom Bases View
```

---

## 18. State Management

Pinia manages application-facing and UI state.

It is not the persistent source of truth.

Recommended stores:

```
ProjectStore
EditorStore
SelectionStore
InspectorStore
WorkspaceStore
```

---

## 19. Project Store

Responsibilities:

```
active project
loaded plans
loaded zones
loaded construction sections
assets
work packages
derived summaries
```

The store represents an in-memory working set.

---

## 20. Editor Store

Responsibilities:

```
active tool
viewport
zoom
pan
grid settings
snapping configuration
active layer
drawing state
```

---

## 21. Selection Store

Responsibilities:

```
selected object IDs
focused object
multi-selection
hover state
```

Selection must use domain IDs rather than Konva instances.

---

## 22. Persistent vs Ephemeral State

**Persistent**

Stored in Vault:

```
project
plan
zone
asset
construction section
work package
cost data
geometry
```

**Ephemeral**

Stored only in application memory:

```
hover
context menu state
drag state
temporary polygon
selection marquee
active tool
```

**User Settings**

Stored as plugin settings:

```
default units
default folders
editor preferences
```

---

## 23. Spatial Rendering Architecture

Konva acts exclusively as rendering and interaction technology.

```
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

The inverse direction:

```
Pointer Interaction
        ↓
Editor Tool
        ↓
Application Command
        ↓
Domain Change
```

Konva objects must never be written directly to the Vault.

---

## 24. Konva Scene Structure

Recommended stage structure:

```
Stage
│
├── BackgroundLayer
│
├── ArchitectureLayer
│
├── ZoneLayer
│
├── ConstructionLayer
│
├── AssetLayer
│
├── AnnotationLayer
│
└── InteractionLayer
```

---

## 25. Background Layer

Contains:

* imported plans,
* images,
* rendered PDF pages.

It should rarely redraw during normal editing.

---

## 26. Spatial Layers

Contain domain-controlled objects:

```
rooms
zones
construction sections
assets
physical elements
```

---

## 27. Interaction Layer

Contains transient rendering:

```
selection handles
snap guides
measure previews
drawing previews
transform controls
```

This layer must not represent domain state.

---

## 28. Selection and Transformation

Konva provides a Transformer abstraction for interactive resizing and rotation of shapes. The transformer internally modifies node scale values rather than directly changing width and height, so transformed values must be normalized before being written back to the domain model. (Konva.js)

Therefore:

```
Konva Transform
      ↓
Normalize Transform
      ↓
Domain Geometry
      ↓
Command
```

The domain must never persist:

```
scaleX
scaleY
```

as a substitute for true dimensions.

---

## 29. Snapping Architecture

Snapping should be implemented as an application/editor service rather than embedded inside components.

```
SnapService
snapPoint()
snapRotation()
snapResize()
snapToGrid()
snapToVertex()
snapToEdge()
```

Konva already supports transformer hooks and snapping concepts for resize and rotation, which can be used by the adapter layer while the actual snapping rules remain domain/editor logic. (Konva.js)

---

## 30. Geometry Core

Geometry must be implemented using plain TypeScript.

Initial primitives:

```
Point
Vector
LineSegment
BoundingBox
Polyline
Polygon
Transform
```

Initial operations:

```
distance
length
area
perimeter
centroid
bounding box
point-in-polygon
segment intersection
projection
translation
rotation
scale conversion
```

---

## 31. World Coordinate System

Domain geometry must use world coordinates rather than screen pixels.

Recommended canonical unit:

```
1 world unit = 1 millimeter
```

Example:

```
World:
5400 mm

Viewport:
100 px/m

Rendered:
540 px
```

---

## 32. Viewport Transform

Viewport conversion must be centralized.

```
worldToScreen()
screenToWorld()
```

Transformation components:

```
translation
zoom
rotation
device pixel ratio
```

UI tools must not perform ad-hoc coordinate conversion.

---

## 33. Calibration

A plan calibration defines how background pixels correspond to world coordinates.

Minimum calibration:

```
Point A
Point B
Known real-world distance
```

Result:

```
pixelsPerWorldUnit
```

Calibration belongs to the Plan domain.

---

## 34. Geometry Validation

Geometry must be validated before persistence.

Examples:

```
Polygon has >= 3 vertices
Coordinates are finite
No NaN
No Infinity
Valid unit
Valid transform
```

Advanced validation may include:

```
self-intersection detection
winding normalization
polygon repair
```

---

## 35. Advanced Polygon Operations

Complex operations should use a specialized geometry adapter such as clipper2-ts.

Use cases:

```
union
intersection
difference
offset
```

The adapter must expose domain-native types.

Example:

```
Domain Polygon
     ↓
Clipper Adapter
     ↓
Clipper2
     ↓
Domain Polygon
```

No Clipper-specific types should escape the adapter.

---

## 36. Spatial Index

For larger plans, spatial search should be implemented using rbush.

Use cases:

```
hit candidate lookup
objects in viewport
assets inside zone
collision candidates
selection marquee
```

Spatial indexing is an optimization.

Correctness must not depend on it.

---

## 37. Command Architecture

All meaningful changes should pass through commands.

Example interface:

```typescript
interface Command<TInput, TResult> {
  execute(input: TInput): Promise<TResult>;
}
```

Examples:

```
CreateProjectCommand
CreatePlanCommand
CalibratePlanCommand
CreateZoneCommand
MoveSpatialObjectCommand
ResizeSpatialObjectCommand
DeleteSpatialObjectCommand
CreateAssetCommand
AssignAssetCommand
CreateRequirementCommand
RecalculateRequirementCommand
CreateWorkPackageCommand
CompleteWorkPackageCommand
```

---

## 38. Undoable Editor Commands

Editor commands should additionally support reversal.

Concept:

```typescript
interface UndoableCommand {
  execute(): Promise<void>;
  undo(): Promise<void>;
}
```

History:

```
CommandHistory
undoStack
redoStack
```

---

## 39. Transaction Boundary

One user intent should represent one logical transaction.

Example:

```
Drag Zone
pointerdown
 ↓
movement
 ↓
movement
 ↓
pointerup
 ↓
MoveZoneCommand

ONE domain change
ONE history item
ONE persistence operation
```

---

## 40. Event Architecture

Commands may emit domain or application events after successful state changes.

Example:

```
ZoneGeometryChanged
     ↓
RequirementInvalidated
     ↓
RequirementRecalculated
     ↓
CostEstimateChanged
```

---

## 41. Event Bus

Initial implementation should use an in-process synchronous or promise-aware event bus.

No external event infrastructure is required.

Concept:

```typescript
interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe<T>(
    eventType: string,
    handler: EventHandler<T>
  ): Disposable;
}
```

---

## 42. Domain Events

Initial event catalog:

```
ProjectCreated
PlanCreated
PlanCalibrated
ZoneCreated
ZoneGeometryChanged
ZoneDeleted
AssetCreated
AssetAssigned
RequirementCreated
RequirementRecalculated
ConstructionSectionCreated
WorkPackageCreated
WorkPackageCompleted
CostChanged
BudgetChanged
```

---

## 43. Query Architecture

Reads should not require commands.

Queries:

```
GetProject
GetPlan
GetZone
GetProjectBudget
GetConstructionSectionSummary
GetAssetsForZone
GetRequirementsForWorkPackage
```

Application queries may return purpose-specific DTOs.

---

## 44. Repository Pattern

Domain persistence is abstracted through repository interfaces.

Example:

```typescript
interface ZoneRepository {
  getById(id: ZoneId): Promise<Zone | null>;
  save(zone: Zone): Promise<void>;
  delete(id: ZoneId): Promise<void>;
  listByProject(projectId: ProjectId): Promise<Zone[]>;
}
```

Concrete implementation:

```
ObsidianZoneRepository
```

---

## 45. Obsidian Repository Layer

Repositories map between:

```
Markdown / Frontmatter
        ↕
Persistence DTO
        ↕
Domain Entity
```

Mapping must be explicit.

Avoid sharing raw frontmatter objects throughout the application.

---

## 46. Markdown Entity Model

Example Zone note:

```markdown
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

Markdown body may contain free-form notes.

---

## 47. Sidecar Files

Geometry may be stored separately where appropriate.

Example:

```
Bathroom.md
Bathroom.plan.json
```

or centrally per plan:

```
plans/
├── Ground Floor.md
└── Ground Floor.geometry.json
```

The recommended initial strategy is:

> Store plan geometry per plan rather than one file per spatial object.

This reduces the number of small write operations during editing.

---

## 48. Plan Sidecar Schema

Conceptual structure:

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

Human-readable metadata remains in Markdown.

Geometry remains optimized for editor access.

---

## 49. Persistence Boundary

The UI must never directly call:

```
Vault.modify()
Vault.create()
processFrontMatter()
```

Instead:

```
Vue
 ↓
Application Command
 ↓
Repository
 ↓
Obsidian Adapter
```

---

## 50. Persistence Consistency

A spatial entity may exist across:

```
Markdown metadata
+
Plan geometry sidecar
```

Updates affecting both must be coordinated.

The application service should treat this as a logical transaction.

Failure must result in:

* rollback where practical,
* preservation of previous data,
* explicit error state.

---

## 51. Schema Validation

All persisted data must pass runtime validation.

Recommended:

```
Zod
```

Validation stages:

```
raw data
  ↓
schema parse
  ↓
persistence DTO
  ↓
domain mapping
```

Invalid data must not silently enter the domain.

---

## 52. Schema Versioning

Every persistent format must carry a schema version.

Examples:

```
Markdown:
schema-version: 1

Sidecar:
schemaVersion: 1
```

---

## 53. Migration Architecture

Migration structure:

```
migration/
├── project/
├── entities/
└── geometry/
```

Example:

```
v1 → v2
v2 → v3
```

Migrations must be:

* deterministic,
* idempotent where practical,
* separately unit tested.

---

## 54. Vault Change Detection

The system must react to external changes.

Examples:

```
file created
file modified
file renamed
file deleted
```

Processing pipeline:

```
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

## 55. Project Index

Scanning the entire vault repeatedly must be avoided.

Introduce an in-memory ProjectIndex.

Responsibilities:

```
entity ID → file path
entity type → IDs
project ID → entity IDs
plan ID → spatial objects
```

The index can initially be rebuilt from the vault on startup.

---

## 56. Index Integrity

Index entries are caches.

The Vault remains canonical.

Therefore:

```
Index corruption
≠
Project corruption
```

The index must always be rebuildable.

---

## 57. Cost Engine

Cost calculations must reside in an independent domain service.

```
CostEngine
```

Supports:

```
piece
length
area
volume
hour
day
fixed
```

---

## 58. Money

Never use native floating-point arithmetic directly for financial calculations.

Use:

```
decimal.js
```

Domain concept:

```typescript
Money {
  amount
  currency
}
```

---

## 59. Quantity Engine

Requirements are calculated separately from assets.

Pipeline:

```
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

## 60. Cost Pipeline

```
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

## 61. Manual Overrides

Derived values may expose manual overrides.

Pattern:

```typescript
DerivedValue<T> {
  calculated: T;
  override?: T;
}
```

Effective value:

```
override ?? calculated
```

The UI must visibly distinguish overridden values.

---

## 62. Scheduling Architecture

Scheduling is not part of the initial architecture core.

However, domain boundaries should already allow:

```
WorkPackage
Task
Milestone
Dependency
DateRange
```

A future Gantt renderer must remain an adapter.

---

## 63. Document Import

Images:

```
PNG
JPEG
```

can be used directly as background resources.

PDF:

```
PDF
 ↓
PDF.js
 ↓
Rendered Page
 ↓
Plan Background
```

The original PDF remains in the Vault.

---

## 64. Asset Handling

Imported background assets should remain Vault files.

Plan entities reference them through Vault-relative paths.

No base64 embedding into Markdown or sidecar data.

---

## 65. Editor Tool Architecture

Tools should implement a shared abstraction.

Example:

```typescript
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

## 66. Initial Editor Tools

```
SelectTool
PanTool
DrawPolygonTool
PlaceAssetTool
MeasureTool
AnnotationTool
```

Future:

```
WallTool
OpeningTool
PathTool
BooleanTool
```

---

## 67. Editor Context

Tools receive a controlled EditorContext.

It exposes:

```
viewport
selection
snap service
command dispatcher
render state
active plan
```

Tools must not directly call repositories.

---

## 68. Inspector Architecture

The Inspector should operate against selected domain IDs.

```
Selection
   ↓
Inspector Query
   ↓
Inspector DTO
   ↓
Vue UI
```

Edits become commands:

```
Inspector Input
    ↓
UpdateZonePropertiesCommand
```

---

## 69. UI Layout

Recommended desktop layout:

```
┌────────────────────────────────────────────────────┐
│ Toolbar                                            │
├──────────────┬──────────────────────┬──────────────┤
│              │                      │              │
│ Layers       │                      │ Inspector    │
│              │                      │              │
│ Objects      │      Plan Canvas     │ Properties   │
│              │                      │              │
│ Assets       │                      │ Relations    │
│              │                      │              │
├──────────────┴──────────────────────┴──────────────┤
│ Status / Measurements / Save State                │
└────────────────────────────────────────────────────┘
```

---

## 70. Responsive Strategy

The first version is optimized for Obsidian desktop.

The architecture must avoid unnecessary Node/Electron-only APIs unless required.

Obsidian manifests explicitly distinguish desktop-only plugins using `isDesktopOnly`; avoiding unnecessary desktop-only dependencies keeps future mobile support possible. (Developer Documentation)

MVP may nevertheless declare desktop-only if canvas/editor usability cannot initially be guaranteed on mobile.

---

## 71. Performance Architecture

Primary risks:

```
large plan
many shapes
high-resolution background
frequent pointer events
frequent persistence
reactivity overhead
```

---

## 72. Rendering Performance Rules

1. Avoid full layer redraws where possible.
2. Keep static and dynamic content on separate layers.
3. Do not persist during pointer movement.
4. Do not mirror every Konva property into reactive Vue state.
5. Keep transient interaction state outside persistent stores.
6. Use spatial indexing when project size demands it.
7. Render only visible or relevant content where feasible.

Obsidian's Bases documentation similarly warns that an unfiltered Base may contain thousands of entries and recommends DOM reuse and avoiding off-screen rendering, reinforcing the need for virtualization-aware views. (Developer Documentation)

---

## 73. Worker Strategy

Expensive future operations may run in Web Workers.

Candidates:

```
large polygon operations
bulk requirement recalculation
large imports
report calculations
```

comlink may be introduced later to simplify worker communication.

Do not introduce workers until profiling justifies them.

---

## 74. Error Model

Errors should use explicit application/domain categories.

Base categories:

```
DomainError
ValidationError
PersistenceError
GeometryError
ImportError
MigrationError
ReferenceError
CalculationError
```

---

## 75. Result Pattern

Expected business failures should not rely exclusively on thrown exceptions.

Recommended pattern:

```
Result<T, E>
```

Unexpected technical failures may still throw and be caught at application boundaries.

---

## 76. Error Boundary

Flow:

```
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

Technical errors should be logged locally with more detail than shown to users.

---

## 77. Logging

Implement a lightweight internal logger.

Levels:

```
debug
info
warn
error
```

Logs must not automatically leave the device.

---

## 78. Diagnostics

Diagnostic information may include:

```
plugin version
Obsidian version
schema version
migration state
entity validation issues
```

Do not include project content unless explicitly exported by the user.

---

## 79. Testing Strategy

Testing follows the architectural layers.

```
                    E2E
                     ▲
                Integration
                     ▲
                 Component
                     ▲
                   Unit
```

---

## 80. Unit Tests

Highest coverage should target framework-independent logic.

**Geometry**

```
distance
area
perimeter
centroid
transform
calibration
snapping
intersection
```

**Money**

```
addition
tax
discounts
rounding
currency safety
```

**Quantity**

```
length requirements
area requirements
waste
packaging
manual overrides
```

**Domain**

```
status transitions
relationship rules
validation
dependency rules
```

---

## 81. Application Tests

Test command handlers using in-memory repositories.

Example:

```
CreateZoneCommand
 ↓
InMemoryZoneRepository
 ↓
Assertions
```

This keeps most application tests independent from Obsidian.

---

## 82. Repository Contract Tests

Every repository implementation should pass a shared repository contract suite.

Example:

```
ZoneRepositoryContract
```

implementations:

```
InMemoryZoneRepository
ObsidianZoneRepository
```

---

## 83. Vue Component Tests

Use:

```
Vitest
@vue/test-utils
```

Test:

* Inspector behavior,
* toolbar state,
* selection behavior,
* dialogs,
* validation messages.

Do not attempt to prove geometry correctness through UI tests.

---

## 84. Canvas Tests

Canvas testing should focus on adapter behavior.

Examples:

```
domain polygon renders expected points
transform completion emits correct command
selection emits domain ID
```

Detailed geometry behavior remains unit tested outside Konva.

---

## 85. Integration Test Vault

Maintain a dedicated fixture Vault:

```
tests/
└── vault/
    ├── valid-project/
    ├── broken-references/
    ├── legacy-schema/
    └── large-project/
```

The Obsidian developer documentation explicitly recommends using a separate development vault because plugin mistakes can otherwise cause unintended changes to user data. (Developer Documentation)

---

## 86. Architecture Test Rules

Automated checks should ensure layer boundaries.

For example:

```
domain/** may not import:
  vue
  pinia
  konva
  obsidian
```

This can initially be enforced through:

* ESLint import restrictions,
* dependency-cruiser,
* or equivalent tooling.

---

## 87. Proposed Repository Structure

```
renovation-planner/
│
├── manifest.json
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
│
├── src/
│   │
│   ├── main.ts
│   │
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

## 88. Internal Module Pattern

A domain module should be self-contained.

Example:

```
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

Application behavior:

```
application/commands/zone/
├── CreateZone.ts
├── UpdateZone.ts
├── DeleteZone.ts
└── MoveZone.ts
```

---

## 89. Public Boundaries

Modules should expose explicit public APIs.

Avoid imports such as:

```
../../../../domain/zone/internal/helper
```

Prefer:

```typescript
import {
  Zone,
  ZoneId,
  ZoneRepository
} from "@/domain/zone";
```

---

## 90. Naming Conventions

**Domain**

Singular:

```
Zone
Asset
WorkPackage
```

**Commands**

Verb + object:

```
CreateZone
AssignAsset
DeleteWorkPackage
```

**Events**

Past tense:

```
ZoneCreated
AssetAssigned
WorkPackageCompleted
```

**Queries**

Get/List/Find:

```
GetZone
ListAssets
FindZonesByPlan
```

---

## 91. TypeScript Rules

Use:

```
strict: true
```

Avoid:

```
any
non-null assertions
unchecked casts
```

Prefer:

```
unknown
runtime validation
discriminated unions
readonly data where practical
```

---

## 92. Entity IDs

Persistent entities use stable IDs independent from filenames.

Recommended approach:

```
UUID
```

or sortable equivalent such as:

```
ULID
```

Example:

```
zone-01JABC...
asset-01JDEF...
```

---

## 93. Entity References

References should use stable IDs.

Markdown links may additionally be stored for navigation.

Never use filename alone as identity.

---

## 94. CSS and Obsidian Theme Integration

The plugin should reuse Obsidian CSS variables where practical.

Avoid hard-coded application-wide color palettes.

Status and semantic colors should remain compatible with:

```
light themes
dark themes
custom themes
```

Canvas overlays must also remain readable across themes.

---

## 95. Accessibility

Core requirements:

* keyboard-accessible controls,
* visible focus,
* semantic labels,
* status not encoded only through color,
* alternative data access through lists/Bases,
* sufficiently sized click targets.

The Canvas is an enhancement to the data model, not the only way to access project information.

---

## 96. Security and Privacy

The plugin is local-first.

Default behavior:

```
no telemetry
no remote calls
no account
no cloud persistence
```

Future integrations must be:

* explicit,
* configurable,
* optional.

---

## 97. Data Safety

The most important technical quality attribute is protection against Vault data loss.

Rules:

1. Never develop against the user's production Vault.
2. Validate before write.
3. Preserve unknown Markdown content.
4. Avoid rewriting full notes where targeted property changes suffice.
5. Never cascade-delete silently.
6. Maintain migration tests.
7. Fail closed on unsupported schema versions.

---

## 98. Non-Functional Requirements

The system should align with ISO/IEC 25010 quality characteristics.

**Functional Suitability**

Domain calculations must be deterministic and verifiable.

**Performance Efficiency**

Interactive editor operations should remain responsive.

Target:

```
pointer feedback < 16–32 ms where practical
```

Normal editing should remain usable with several hundred spatial objects.

**Compatibility**

The plugin should coexist with:

* standard Markdown,
* Obsidian Properties,
* Obsidian links,
* Bases,
* common community plugins.

**Usability**

Primary workflows should require minimal editor knowledge.

**Reliability**

Persistence errors must never silently discard project data.

**Security**

No unnecessary external communication or privileged API use.

**Maintainability**

Core domain logic remains framework independent.

**Portability**

Data remains human readable without the plugin.

---

## 99. Initial Architecture Decisions

**ADR-001 — Markdown as Canonical Metadata Storage**

Decision: Human-readable project metadata is stored in Markdown and Properties.

---

**ADR-002 — JSON Sidecar for Plan Geometry**

Decision: High-volume geometry is stored per plan in structured JSON sidecars.

---

**ADR-003 — Konva as Canvas Renderer**

Decision: Konva is used for 2D canvas rendering and interaction.

---

**ADR-004 — Vue 3 for Plugin UI**

Decision: Vue 3 is used for view composition.

---

**ADR-005 — Pinia for Presentation State**

Decision: Pinia manages UI/application state but is not persistent truth.

---

**ADR-006 — Plain TypeScript Domain**

Decision: Domain and core code cannot depend on Vue, Konva, Pinia, or Obsidian.

---

**ADR-007 — Command-Based Mutations**

Decision: User-visible mutations are routed through application commands.

---

**ADR-008 — Event-Aware Architecture**

Decision: Commands may emit domain/application events to decouple derived calculations.

---

**ADR-009 — World Coordinates in Millimeters**

Decision: Spatial geometry uses real-world coordinates rather than canvas pixels.

---

**ADR-010 — Decimal Money Arithmetic**

Decision: Financial calculations use arbitrary-precision decimal arithmetic.

---

## 100. MVP Architecture Slice

The first implementation should intentionally include only the architecture needed to prove the core system.

```
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

## 101. MVP Technical Increments

**Increment 1 — Plugin Foundation**

Deliver:

* Vite build
* Vue mounting
* Pinia
* Vitest
* plugin bootstrap
* settings
* workspace view
* architecture dependency rules

Success criterion:

> Empty Renovation Planner view opens reliably inside Obsidian.

---

**Increment 2 — Domain Foundation**

Deliver:

* identity
* units
* geometry primitives
* Result
* errors
* Project
* Plan
* Zone

Success criterion:

> Domain can be fully instantiated and tested without Obsidian.

---

**Increment 3 — Persistence**

Deliver:

* Project repository
* Plan repository
* Zone repository
* Zod validation
* Vault indexing
* geometry sidecar format

Success criterion:

> Project, Plan, and Zone survive full unload/reload.

---

**Increment 4 — Canvas**

Deliver:

* Konva Stage
* viewport
* pan
* zoom
* background layer
* spatial layer
* selection layer

Success criterion:

> Persisted domain geometry renders independently from Canvas coordinates.

---

**Increment 5 — Calibration**

Deliver:

* calibration tool
* world/screen transform
* distance calculation
* scale persistence

Success criterion:

> Imported plan can be converted into real-world measurements.

---

**Increment 6 — Zone Editing**

Deliver:

* polygon tool
* selection
* move
* edit vertices
* delete
* undo/redo

Success criterion:

> User can create and safely modify persistent spatial zones.

---

**Increment 7 — Assets & Requirements**

Deliver:

* Asset
* Requirement
* area-based requirement calculation
* unit price
* estimated cost

Success criterion:

```
Zone Geometry
→ Area
→ Requirement
→ Cost
```

works end to end.

---

## 102. Architecture Completion Criteria

The technical foundation is considered successful when:

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

## 103. Target Architectural Outcome

The final architectural shape should resemble:

```
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

The architecture deliberately separates:

> what the renovation project means

from:

> how Obsidian stores it

and from:

> how Konva renders it.

This separation is the primary technical foundation for allowing the Renovation Planner to grow from an initial spatial planning tool into a larger renovation project management system without requiring fundamental architectural rewrites.
