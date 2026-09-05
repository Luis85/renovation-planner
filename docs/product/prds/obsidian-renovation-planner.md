# Product Requirements Document
## Obsidian Renovation Planner

**Status:** Draft  
**Version:** 0.3  
**Product Type:** Obsidian Plugin  
**Architecture:** Local-first, Markdown-native, spatially aware  
**Primary Stack:** TypeScript · Vue 3 · Pinia · Vite · Vitest · Konva

---

## Design amendments — 2026-09-05

This PRD is kept as received. Three design packages under
[`docs/user-experience/`](../../user-experience/) now specify the surfaces it asks for, and where
the body below and a package disagree, the package is the authority for what the user SEES and
this PRD stays the authority for what the product IS:

- **§39 User Experience Requirements → the
  [editor package](../../user-experience/renovation-planner-editor-specs/README.md) (M00–M17).**
  §39's shell, tool list and shortcuts predate the package's three perspectives — Plan /
  Renovate / Review — and its Existing / Work / Planned semantics. §39's tool list already
  carries no Calibrate tool, which agrees with M06 (a reference plan is *set up*, not
  calibrated with a tool); do not "fix" it the other way. §40's rule that spatial objects stay
  reachable without the canvas is the package's principle 10, now with screens behind it.
- **§17 Epic 6 Asset Library → the
  [asset library package](../../user-experience/asset-library-delivery/README.md) (AL00–AL11).**
  The library is a **vault-wide surface** of its own, reached by command or from the project
  overview — not the `Library` pane §39's shell drawing puts in the editor's left panel. §17's
  seven categories are the production vocabulary the package's decision D04 defends; its four
  demo categories are fixtures.
- **The user-facing vocabulary is *Room, Wall, Area, Reference plan, Work*; never *Zone,
  Polygon, Vertex, Scene* or a *Calibrate* step.** This PRD does not distinguish a domain term
  from a UI label, so read every occurrence by where it sits: §6's domain model, §8's `Zone`
  entity, §68's commands, §82's calibration model and §86's events are INTERNAL and keep
  their names — the persisted `type: renovation-zone` does not change. §3.5's *Import →
  Calibrate → Mark areas* flow, §5's *Calibrate Scale* step, §93's onboarding ending in *Create
  First Zone* and §101's `create zone` flow are USER-FACING and are read as *set up a reference
  plan* (M06) and *add a room* (M02–M03). The mapping is explicit and tested rather than a
  rename.
- **§105's open questions: two are answered.** Mobile is read-only (`PRODUCT.md`, and the
  project package's precedence rule 9). Walls are first-class: M04 draws them and M07 selects
  them, though as a proposed extension not yet built. The other six stay open.
- **Home, project details and Resume** are the
  [project package](../../user-experience/renovation-planner-project-specs/README.md)'s (P00–P07);
  the workspace PRD beside this one carries the amendments for those.

Each package proposes its own backlog; what was adopted from each is in
[`docs/reviews/2026-09-05-design-package-adoption.md`](../../reviews/2026-09-05-design-package-adoption.md),
and the packages' own open questions are listed in `PRODUCT.md` rather than repeated here.

---

# 1. Product Vision

The **Obsidian Renovation Planner** is a local-first planning tool for house, apartment, property, and garden renovation projects.

The plugin combines visual spatial planning with project, cost, procurement, scheduling, and documentation capabilities.

The central idea is:

> The plan of a house or property becomes the spatial index of the entire renovation project.

Users can import floor plans, site plans, or sketches, calibrate them, and mark rooms, areas, construction sections, and assets.

These spatial objects are not isolated drawings. They are connected to structured Obsidian data:

- construction sections
- trades
- work packages
- tasks
- assets and materials
- costs
- suppliers
- quotes
- procurement
- documents
- decisions
- photos
- risks
- milestones

The visualization is **not the database**.

Obsidian Markdown files and properties remain the persistent source of truth. The visual editor is a projection and interaction surface over that model.

---

# 2. Product Thesis

Renovation planning typically spreads information across different tools:

- floor plans and sketches
- spreadsheets
- task lists
- quotes
- invoices
- photos
- notes
- calendars
- project plans

The spatial relationship between this information is usually lost.

The Renovation Planner treats spatial objects as part of the project model.

```text
                    Renovation Project
                           │
         ┌─────────────────┼──────────────────┐
         │                 │                  │
         ▼                 ▼                  ▼
       Spatial           Project            Cost
        Model             Model             Model
         │                 │                  │
    House/Garden      Work Packages       Budget
    Areas/Zones       Trades              Estimates
    Assets            Tasks               Actuals
         │                 │                  │
         └─────────────────┼──────────────────┘
                           ▼
                     Obsidian Vault
                  Markdown + Properties
```

---

# 3. Product Principles

## 3.1 Local First

All project data lives locally in the Obsidian Vault.

No cloud infrastructure is required for core functionality.

## 3.2 Markdown as Source of Truth

Project information remains:

- human-readable
- versionable
- portable
- searchable
- editable outside the plugin

The plugin must not require a proprietary database.

## 3.3 Spatially Aware

Spatial relationships are first-class domain information.

The system understands:

- position
- length
- area
- polygons
- containment
- overlap
- construction sections
- rooms
- property areas

## 3.4 Geometry Drives Planning

Geometry can generate project information.

```text
Terrace
42.7 m²
   ×
Waste factor
1.08
   ×
34.95 €/m²
   ↓
Material quantity + Cost
```

## 3.5 Progressive Complexity

A user does not need to create a full digital floor plan.

The simplest workflow is:

```text
Import image
    ↓
Calibrate
    ↓
Mark areas
    ↓
Connect project information
```

## 3.6 Obsidian Native

Where useful, the plugin uses native Obsidian concepts:

- Markdown
- Properties
- Links
- Embeds
- Bases
- Commands
- Workspace Views
- Search
- Tags

---

# 4. Target Users

## Primary Persona — Private Renovator

Plans:

- house renovation
- apartment renovation
- garden redesign
- outdoor works
- extensions
- smaller building projects

### Jobs to Be Done

**When** I renovate my house or property,  
**I want to** visualize all planned measures spatially and connect them to costs and tasks,  
**so that** I always understand what must be done where, how much it costs, and how far the project has progressed.

## Secondary Persona — Advanced DIY Planner

Needs additional support for:

- material requirements
- measurements
- quantities
- shopping lists
- suppliers
- price comparisons
- dependencies

## Future Persona — Professional Planner

Potential future users:

- small contractors
- interior designers
- landscape planners
- owner-side consultants
- facility managers

These are not part of the initial MVP.

---

# 5. Core User Journey

```text
Create Project
      │
      ▼
Import Plan
      │
      ▼
Calibrate Scale
      │
      ▼
Define Areas
      │
      ▼
Define Construction Sections
      │
      ▼
Place Assets
      │
      ▼
Assign Trades
      │
      ▼
Create Work Packages
      │
      ▼
Estimate Quantities
      │
      ▼
Calculate Costs
      │
      ▼
Create Tasks
      │
      ▼
Schedule Work
      │
      ▼
Execute
      │
      ▼
Track Actual Costs + Progress
      │
      ▼
Document Result
```

---

# 6. Domain Model

The core model must be independent from Vue, Konva, and Obsidian.

```text
RenovationProject
│
├── Site
│   ├── Building
│   │   └── Floor
│   │       └── Space
│   └── OutdoorArea
│
├── Plan
│   ├── Layer
│   └── SpatialObject
│
├── Zone
├── ConstructionSection
├── Asset
├── Requirement
├── Trade
├── WorkPackage
│   └── Task
├── CostItem
├── ProcurementItem
├── Supplier
├── Quote
├── Order
├── Invoice
├── Document
├── Risk
├── Decision
└── Milestone
```

---

# 7. Spatial Domain

## 7.1 Geometry Types

Initial:

- Point
- Polyline
- Rectangle
- Polygon

Future:

- Circle
- Wall
- Opening
- Path
- Compound Polygon

## 7.2 World Coordinates

Canvas pixels must not be used as domain measurements.

Recommended base unit:

```text
1 World Unit = 1 mm
```

Transformation:

```text
World Coordinate
      ↓
Viewport Transform
      ↓
Canvas Coordinate
```

---

# 8. Core Entities

## Project

Represents the complete renovation project.

Properties:

- ID
- name
- description
- status
- start
- target completion
- budget
- contingency
- location description
- linked plans

## Plan

A spatial representation of part of the project.

Examples:

- property
- ground floor
- first floor
- basement
- garden
- garage

Properties:

- ID
- name
- background
- scale
- coordinate system
- layers

## Zone

A semantically meaningful area.

Examples:

- kitchen
- bathroom
- terrace
- front garden
- flower bed
- driveway
- roof

A Zone owns geometry and can expose derived length and area.

## Construction Section

Groups related measures.

Examples:

- BA-01 Roof
- BA-02 Bathroom
- BA-03 Terrace
- BA-04 Front Garden

Properties:

- status
- priority
- phase
- zones
- trades
- work packages
- budget
- actual costs
- planned dates

## Asset

A physical or cost-relevant item.

Examples:

- tile
- plant
- window
- light
- fence
- sink
- garden shed
- paint

## Trade

Examples:

- electrical
- plumbing
- painting
- tiling
- gardening
- groundworks
- roofing

## Work Package

A plannable unit of work.

Contains:

- construction section
- trade
- scope
- assets
- tasks
- dependencies
- estimate
- planned dates
- actual dates
- status

## Task

Concrete executable work.

Examples:

- order terrace tiles
- compact sub-base
- install drainage
- cut tiles

---

# 9. Cost Model

Supported quantity units:

```text
piece
m
m²
m³
hour
day
fixed
```

Examples:

```text
Fence
18.4 m × 89 €/m

Tiles
27.4 m² × 1.10 waste × 45 €/m²

Lights
8 pieces × 79 €

Electrician
12 h × 75 €/h
```

---

# 10. Cost Hierarchy

```text
Project
   │
   ├── Construction Section
   │       └── Work Package
   │               └── Cost Item
   └── Assets
```

Costs can be aggregated by:

- project
- construction section
- zone
- trade
- work package
- asset
- supplier

---

# 11. Cost Types

Support:

- Budget
- Estimated Cost
- Quoted Cost
- Committed Cost
- Actual Cost

Example:

```text
Budget             80,000 €
Estimate           73,500 €
Quoted             69,200 €
Committed          51,400 €
Actual             32,800 €
```

---

# 12. Epic 1 — Project Management

## Goal

Users can manage renovation projects as the central domain.

### Features

- Create Project
- Project Dashboard
- Project Navigation
- Status
- Budget
- Date range

---

# 13. Epic 2 — Plan Editor

## Goal

Users can visualize the project spatially.

### Features

- plan creation
- PNG/JPEG/PDF background import
- pan & zoom
- layers
- selection
- multi-selection
- undo/redo
- grid
- snapping

Initial layers:

- Background
- Areas
- Construction Sections
- Assets
- Work
- Annotation

---

# 14. Epic 3 — Calibration & Measurement

## Goal

Turn visual plans into measurable project models.

### Features

- scale calibration
- distance measurement
- area calculation
- perimeter
- measurement annotation

---

# 15. Epic 4 — Zones & Spatial Objects

## Goal

Mark semantically meaningful project areas.

### Features

- polygon tool
- zone types
- zone metadata
- Markdown links
- spatial queries

Zone examples:

- Room
- Garden
- Terrace
- Driveway
- Roof
- Construction Area
- Custom

---

# 16. Epic 5 — Construction Sections

## Goal

Group renovation measures spatially and organizationally.

### Features

- create construction section
- spatial assignment
- trade assignment
- budget
- lifecycle/status
- visual status

Lifecycle:

```text
idea
planned
ready
in-progress
blocked
completed
cancelled
```

---

# 17. Epic 6 — Asset Library

## Goal

Manage reusable materials and physical objects.

### Asset Categories

- Material
- Furniture
- Fixture
- Plant
- Equipment
- Building Element
- Custom

### Features

- asset definition
- asset placement
- quantity
- geometry-linked asset
- automatic quantity
- searchable asset catalog

---

# 18. Epic 7 — Cost & Budget Engine

## Goal

Derive project costs automatically from planning and quantities.

### Features

- cost items
- geometry-based costs
- labor cost
- fixed cost
- waste factor
- contingency
- aggregation
- planned vs actual

---

# 19. Epic 8 — Trades & Work Packages

## Goal

Turn spatial planning into executable project planning.

### Features

- trade catalog
- work package creation
- spatial scope
- assets
- tasks
- dependencies
- progress

---

# 20. Epic 9 — Task Management

## Goal

Manage concrete execution work.

### Features

- create task from zone/asset/work package/construction section
- task status
- due date
- dependencies
- Obsidian task integration

Task lifecycle:

```text
todo
in-progress
blocked
done
cancelled
```

---

# 21. Epic 10 — Schedule

## Goal

Plan renovation work over time.

### Features

- timeline
- start/end
- dependencies
- milestones
- trade timeline
- construction section timeline

---

# 22. Epic 11 — Suppliers & Quotes

## Goal

Connect cost planning to real supplier and trade offers.

### Features

- supplier records
- quote records
- quote items
- link quote items to assets/work packages
- compare quotes
- status and validity

---

# 23. Epic 12 — Documents, Photos & Evidence

## Goal

Connect all project documents to spatial and domain objects.

### Features

- document linking
- photo documentation
- spatial photo reference
- document types
- evidence timeline

Supported document categories include:

- quote
- invoice
- delivery note
- product data sheet
- installation manual
- permit
- warranty
- contract
- photo
- sketch
- other

---

# 24. Epic 13 — Procurement & Shopping

## Goal

Turn requirements and assets into concrete procurement.

### Features

- procurement requirement
- procurement lifecycle
- shopping lists
- package sizes
- minimum order quantities
- delivery dates
- procurement dependencies

Lifecycle:

```text
needed
researching
selected
ordered
partially-delivered
delivered
installed
cancelled
```

---

# 25. Epic 14 — Decisions & Change Management

## Goal

Document planning decisions and their impacts.

### Features

- decisions
- alternatives
- change requests
- impact analysis
- change history

Impacts may affect:

- budget
- schedule
- assets
- procurement
- work packages
- tasks

---

# 26. Epic 15 — Risks, Issues & Constraints

## Goal

Make risks and blockers transparent.

### Features

- risks
- issues
- constraints
- spatial issue markers

Risk properties:

- probability
- impact
- exposure
- mitigation
- owner
- affected area

---

# 27. Epic 16 — Progress & Site Documentation

## Goal

Support execution, not only planning.

### Features

- progress tracking
- planned vs actual
- progress photos
- site log
- completion evidence

---

# 28. Epic 17 — Reporting & Project Cockpit

## Goal

Provide a compact, actionable project overview.

### Features

- project health
- budget overview
- forecast
- upcoming work
- procurement overview
- project summary

Forecast:

```text
Actual Cost
+
Committed Cost
+
Remaining Estimate
=
Forecast
```

---

# 29. Epic 18 — Scenarios & Alternatives

## Goal

Compare alternative solutions before committing.

### Features

- scenario
- scenario costs
- scenario schedule
- scenario assets
- scenario comparison
- select scenario

Comparison dimensions:

- cost
- duration
- material
- effort
- risk

---

# 30. Epic 19 — Existing State, Planned Change & As-Built

## Goal

Represent renovation as transformation of an existing state.

```text
Existing State
      ↓
Planned Change
      ↓
Execution
      ↓
As-Built State
```

### Object states

- existing
- to-remove
- to-retain
- planned
- in-progress
- installed

### Features

- existing object
- retain
- remove
- modify
- new
- installed
- state visualization
- existing vs target view
- as-built documentation

---

# 31. Epic 20 — Plan Revisions

## Goal

Version plan changes explicitly.

### Features

- revision
- revision metadata
- lifecycle
- revision comparison
- immutable approved revision

Lifecycle:

```text
draft
proposed
approved
superseded
as-built
```

---

# 32. Quantity & Requirement Domain

Requirement, Asset, Procurement, and Cost must remain separate concepts.

```text
Asset
"Porcelain terrace tile"

Requirement
"46.2 m² required"

Procurement Item
"47.52 m² ordered"

Cost Item
"1,661.42 €"

Installed Quantity
"43.8 m² installed"
```

Requirement properties:

- required asset
- source geometry
- calculated quantity
- waste factor
- unit
- manual override
- required date

---

# 33. Financial Lifecycle

```text
Budget
  ↓
Estimate
  ↓
Quote
  ↓
Commitment
  ↓
Invoice
  ↓
Payment
```

Forecast:

```text
Actual
+
Committed but not invoiced
+
Remaining Estimate
=
Estimated Final Cost
```

---

# 34. Spatial Object Model

```text
SpatialObject
│
├── PhysicalElement
│   ├── Wall
│   ├── Door
│   ├── Window
│   ├── Tree
│   └── Structure
│
├── Area
│   ├── Room
│   ├── GardenArea
│   ├── Terrace
│   └── Driveway
│
├── PlanningZone
│   ├── ConstructionSection
│   └── WorkArea
│
└── Annotation
    ├── Measurement
    ├── Text
    ├── Marker
    └── PhotoReference
```

---

# 35. Renovation Lifecycle

```text
IDEA
  ↓
SURVEY
  ↓
DESIGN
  ↓
ESTIMATE
  ↓
PROCUREMENT
  ↓
READY
  ↓
EXECUTION
  ↓
INSPECTION
  ↓
COMPLETE
  ↓
AS-BUILT
```

---

# 36. Vault Data Model

Recommended structure:

Two locations, because two scopes. The **library folder** holds what every project shares and is
one plugin setting (§83); a **project folder** holds one renovation and is a project setting. The
drawing below shows them both at their defaults, and neither path is fixed.

```text
Renovation/Library/              ← the library folder, one per vault (§83)
├── Assets/
├── Suppliers/
└── Trades/

Renovation/Kitchen Refit/        ← a project folder, one per renovation
├── Project.md
├── Plans/
├── Zones/
├── Construction Sections/
├── Work Packages/
├── Tasks/
├── Requirements/
├── Quotes/
├── Orders/
├── Invoices/
├── Costs/
├── Decisions/
├── Risks/
├── Documents/
└── Photos/
```

> **Amended 2026-08-26, by the product owner**, with §59 and §83. `Assets/`, `Suppliers/` and
> `Trades/` were drawn inside the project folder; they are the three shared catalogues and live in
> the library folder now. They are drawn as two separate roots rather than as siblings under one
> parent **on purpose**: §83 lets every project choose its own folder, so a library nested beside
> *a* project folder could not be found from the others. Each path resolves from its own setting.
> The project folder still moves, backs up and deletes as one unit, which is the property the
> single-folder layout was drawn for.

Paths must be configurable.

---

# 37. Persistence Strategy

## Note-Based Entities

Persist as Markdown notes:

- Project
- Plan
- Zone
- Construction Section
- Work Package
- Asset
- Requirement
- Trade
- Supplier
- Quote
- Order
- Invoice
- Decision
- Risk

## Sidecar Data

Suitable for:

- geometry
- layer state
- large editor-specific datasets

Example:

```text
plan-name.plan.json
```

## Ephemeral State

UI only:

- selection
- hover
- context menu
- temporary drawing state

---

# 38. Geometry Persistence

Geometry must not be stored in canvas pixels.

Example:

```json
{
  "type": "polygon",
  "unit": "mm",
  "points": [
    [0, 0],
    [5400, 0],
    [5400, 4200],
    [0, 4200]
  ]
}
```

---

# 39. User Experience Requirements

Recommended layout:

```text
┌──────────────────────────────────────────────────────┐
│ Toolbar                                              │
├────────────┬────────────────────────────┬────────────┤
│ Layers     │                            │ Inspector  │
│ Objects    │           Plan             │ Properties │
│ Library    │                            │ Relations  │
├────────────┴────────────────────────────┴────────────┤
│ Status / Selection / Measurements                   │
└──────────────────────────────────────────────────────┘
```

Primary tools:

- Select
- Pan
- Draw Area
- Place Asset
- Measure
- Annotate

Inspector actions:

- Edit
- Duplicate
- Delete
- Link Note
- Create Work Package
- Add Cost
- Add Task

Keyboard shortcuts should include:

- Undo
- Redo
- Delete
- Copy
- Paste
- Duplicate
- Escape
- Fit to Screen

Objects can be:

- hidden
- visible
- locked

---

# 40. Search & Navigation

Spatial objects must remain accessible without the canvas.

Users can search for a domain object and navigate from:

- notes
- Bases rows
- lists
- dashboards

to the corresponding object in the plan.

---

# 41. Bases Integration

Potential custom Bases views:

- Renovation Plan
- Budget
- Assets
- Procurement
- Work Packages
- Schedule
- Risks

These views use the same Vault data.

---

# 42. Import Requirements

Initial:

- PNG
- JPEG
- PDF

Future:

- SVG
- CSV
- XLSX
- GeoJSON
- selected floorplan formats where feasible

---

# 43. Export Requirements

Initial:

- PNG snapshot
- JSON geometry
- Markdown

Future:

- PDF project report
- SVG
- CSV
- XLSX
- procurement list
- cost report

---

# 44. Non-Functional Requirements

## Performance

- several hundred spatial objects per plan
- smooth pan/zoom
- no Vault writes during pointer movement
- persistence after completed commands or debounced property changes

## Reliability

- validated writes
- tolerant loading
- recovery for invalid frontmatter
- undo/redo
- clear errors

## Maintainability

Business logic must remain independent of Vue, Pinia, Konva, and Obsidian.

## Testability

Geometry, units, costs, requirements, scheduling, validation, and persistence mapping must be unit-testable.

## Interoperability

Prefer open formats:

- Markdown
- YAML
- JSON
- PNG
- JPEG
- PDF
- CSV

## Portability

Vault data remains readable without the plugin.

## Accessibility

- keyboard support
- visible focus
- sufficient contrast
- no color-only status encoding
- alternative list/table access

## Error Handling

Typed error categories:

- validation error
- persistence error
- import error
- geometry error
- calculation error
- unsupported format

---

# 45. Technical Constraints

Required stack:

```text
Obsidian
TypeScript
Vue 3
Pinia
Vite
Vitest
```

Recommended libraries:

```text
konva
vue-konva
@vueuse/core
zod
decimal.js
clipper2-ts
rbush
pdfjs-dist
pdf-lib
dayjs
```

Optional later:

```text
frappe-gantt
vue-ganttastic
papaparse
xlsx
comlink
```

---

# 46. Architecture Constraints

Source of truth:

```text
Obsidian Vault
```

Pinia:

- UI state
- application cache
- active project working state

Konva:

- rendering
- interaction adapter

Geometry core:

- framework-free TypeScript

---

# 47. Proposed Architecture

```text
┌─────────────────────────────────────────────┐
│                  Obsidian                    │
│                                             │
│ Workspace Views             Bases Views     │
└───────────────┬───────────────────┬─────────┘
                │                   │
                └─────────┬─────────┘
                          ▼
                       Vue UI
                          │
                  ┌───────┴────────┐
                  ▼                ▼
                Pinia          vue-konva
                                   │
                                  Konva
                                   │
                              Canvas Renderer

──────────────── Application ────────────────

                       Commands
                          │
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
      Geometry          Costs          Scheduling
       Engine           Engine            Engine
          │               │                │
          └───────────────┼────────────────┘
                          ▼
                        Domain

──────────────── Infrastructure ─────────────

                      Repositories
                          │
                    Obsidian Adapter
                          │
                 Markdown / JSON / Files
```

---

# 48. MVP Scope

## MVP — Spatial Renovation Planning

The MVP answers:

> What should change where, and what quantities and costs result from it?

Included:

- Project
- Plan
- image/PDF background
- calibration
- pan/zoom
- polygon zones
- construction sections
- basic assets
- measurements
- geometry calculations
- basic requirement calculation
- €/piece
- €/m
- €/m²
- basic budget aggregation
- Markdown persistence
- Obsidian links
- undo/redo
- Vitest coverage

Explicitly out of scope:

- 3D
- CAD replacement
- BIM
- automated architectural design
- professional quantity surveying
- advanced scheduling
- invoices/payments
- collaboration backend

---

# 49. V1 Scope — Renovation Management

V1 adds:

- Trades
- Work Packages
- Tasks
- Schedule
- Suppliers
- Quotes
- Procurement
- Planned vs Actual Costs
- Documents
- Photos
- Progress
- Project Dashboard

---

# 50. V2 Scope — Advanced Planning

V2 adds:

- scenarios
- alternatives
- change management
- risks/issues
- plan revisions
- existing vs target state
- as-built state
- advanced geometry
- spatial queries
- forecast
- reporting
- extended import/export

---

# 51. Success Metrics

## Planning Coverage

Share of renovation measures linked to a spatial area.

## Cost Coverage

Share of work packages with cost estimates.

## Procurement Coverage

Share of required materials with defined procurement information.

## Execution Coverage

Share of work packages with current status.

## Documentation Coverage

Share of completed construction sections with documented outcomes.

---

# 52. Product Success Criteria

A first version is successful when a user can:

1. create a renovation project
2. import a floor or garden plan
3. calibrate the scale
4. mark a construction section spatially
5. calculate area automatically
6. assign material
7. calculate required quantity
8. calculate material cost
9. assign trade and work package
10. create tasks
11. aggregate project budget
12. retain all information as understandable Vault data

---

# 53. Core Product Loop

```text
Observe
   ↓
Plan
   ↓
Measure
   ↓
Estimate
   ↓
Decide
   ↓
Procure
   ↓
Execute
   ↓
Document
   ↓
Update Plan
```

---

# 54. Long-Term Product Direction

The Renovation Planner should evolve into a **spatially-aware project system**.

It should not attempt to replace professional CAD, BIM, or construction management systems.

Positioning:

> A lightweight, local-first, Markdown-native combination of spatial planning, project management, cost planning, procurement, and project documentation.

The visual plan is the spatial entry point into the complete project knowledge base.

---

# 55. Problem Statement

Private renovation and garden projects are usually fragmented across drawings, spreadsheets, task apps, quotes, invoices, photos, notes, calendars, and project plans.

This makes it difficult to understand:

- what should change
- where the change occurs
- what work is necessary
- which trades are involved
- which materials are required
- which quantities are needed
- which costs result
- which dependencies exist
- what has already been executed
- what the final as-built state is

The Renovation Planner solves this by connecting spatial planning, project planning, costs, procurement, execution, and documentation in one local-first model.

---

# 56. Product Goals

- Spatial Project Planning
- Geometry-Driven Planning
- Integrated Project Planning
- Cost Transparency
- Execution Support
- Long-Term Documentation
- Data Ownership

---

# 57. Non-Goals

The product is not intended to replace:

- CAD
- BIM
- structural engineering software
- architectural design
- permitting software
- professional AVA/estimating suites
- accounting
- construction ERP
- professional site management
- multi-user cloud collaboration platforms

---

# 58. Canonical Relationship Model

```text
Project
│
├── Site
│   ├── Building
│   │   └── Floor
│   │       └── Space
│   └── OutdoorArea
│
├── Plan
│   └── SpatialObject
│       ├── PhysicalElement
│       ├── Area
│       ├── PlanningZone
│       └── Annotation
│
├── ConstructionSection
│   ├── Zones
│   ├── WorkPackages
│   └── Budget
│
├── WorkPackage
│   ├── Trade
│   ├── Requirements
│   ├── Tasks
│   ├── Dependencies
│   └── Costs
│
├── Requirement
│   └── Asset
│
├── ProcurementItem
│   ├── Supplier
│   └── Order
│
├── Documents
├── Decisions
├── Risks
└── Financial
    ├── Budget
    ├── Estimate
    ├── Quote
    ├── Commitment
    ├── Invoice
    └── Payment
```

---

# 59. Entity Relationship Rules

> **Amended 2026-08-26, by the product owner.** The Asset, Supplier and Trade catalogues were
> owned by a Project in the version of this document as received. They are shared across Projects
> now, so that a renovator who has defined a tile, a builders' merchant or an electrician does not
> define it again for their next renovation. §36's folder tree is amended in the same pass. This
> block exists because everything under `docs/` derives from this document and cites it by section:
> an edit made silently here would leave every citation pointing at text that had changed under it.

A Project owns 0..n Plans, Construction Sections, Work Packages, and Documents.

The Asset, Supplier and Trade catalogues are **shared across Projects**. They are defined once, in a
library beside the Project folders rather than inside any one of them, and any Project may reference
them. A catalogue entry therefore has no owning Project.

A Plan belongs to exactly one Project.

A Spatial Object belongs to one Plan and may link to a domain note.

A Construction Section belongs to one Project and may span multiple Zones and Work Packages.

A Work Package belongs to one Project, optionally one Construction Section, and at least one domain scope.

A Requirement describes a need and must have an origin such as a Zone, Work Package, or Asset.

A Procurement Item is based on a Requirement or manual need and must remain distinct from the Requirement itself.

---

# 60. Identity Model

Every persistent domain entity has a stable ID independent of:

- filename
- note title
- folder path

Example:

```yaml
id: zone-01JABC123
```

---

# 61. Schema Versioning

Persistent objects carry a schema version.

```yaml
schema-version: 1
```

---

# 62. Migration Requirements

Schema migrations must be:

- deterministic
- testable
- traceable
- reversible where practical

Large migrations must not silently overwrite existing data.

---

# 63. Reference Integrity

The system must detect:

- missing references
- deleted objects
- invalid IDs
- duplicate IDs

---

# 64. Deletion Semantics

Deletion must check references first.

Example:

```text
Delete Zone?

Referenced by:
3 Work Packages
7 Tasks
4 Cost Items
2 Documents
```

Possible actions:

- Cancel
- Remove References
- Reassign
- Delete Anyway

Silent cascading delete should be avoided.

---

# 65. External Modification Handling

Because Markdown is canonical, the plugin must respond to:

- frontmatter edits
- note rename
- note move
- note deletion
- new notes

Manual edits must not be overwritten silently.

---

# 66. Save Strategy

Pointer movement is transient.

Persistence occurs only after completed domain-level actions.

```text
Pointer Down
  ↓
Drag
  ↓
Pointer Up
  ↓
MoveObjectCommand
  ↓
Domain Update
  ↓
Persist
```

---

# 67. Autosave

Default autosave after:

- completed commands
- debounced property edits

Visible states:

- Saved
- Saving
- Unsaved Changes
- Save Error

---

# 68. Undo / Redo Architecture

Editor changes should use command history.

Examples:

- CreateZoneCommand
- MoveObjectCommand
- ResizeObjectCommand
- DeleteObjectCommand
- AssignAssetCommand
- ChangePropertyCommand

---

# 69. Backup & Recovery

Recovery scenarios include:

- damaged sidecar
- invalid frontmatter
- missing background
- invalid geometry
- interrupted migration

The plugin must preserve recoverable source data.

---

# 70. Unit System

Dimensions:

- Length
- Area
- Volume
- Quantity
- Duration

Recommended normalized internal units:

```text
Length → mm
Area   → mm²
Volume → mm³
```

---

# 71. Measurement Precision

Internal precision and display precision are separate.

Example:

```text
Internal: 42718432 mm²
Display: 42.72 m²
```

---

# 72. Currency Model

Projects define a standard currency.

```yaml
currency: EUR
```

---

# 73. Tax Model

Optional support for:

- net amount
- tax rate
- tax amount
- gross amount

This is planning support, not accounting or tax advice.

---

# 74. Price Components

Cost items may include:

- discount
- shipping
- deposit
- surcharge
- tax
- contingency

---

# 75. Quantity Semantics

```text
Calculated Requirement
        ↓
Waste Adjustment
        ↓
Required Quantity
        ↓
Purchase Quantity
        ↓
Delivered Quantity
        ↓
Consumed Quantity
        ↓
Remaining Quantity
```

---

# 76. Inventory & Remaining Materials

Remaining material can become reusable inventory.

---

# 77. Dependency Model

Dependencies may exist between:

- Work Package → Work Package
- Task → Task
- Procurement → Work Package
- Decision → Work Package
- Milestone → Work Package

---

# 78. Dependency Types

Initial:

- Finish-to-Start
- Blocking
- Informational

---

# 79. Multi-Plan Model

A project may contain:

- site plan
- basement
- ground floor
- upper floors
- garden
- garage

---

# 80. Cross-Plan Relationships

A Construction Section may span multiple Plans.

---

# 81. Coordinate Transformations

Support:

- translation
- scale
- rotation

Background image and world coordinates remain separate.

---

# 82. Plan Calibration Model

Minimum:

- Point A
- Point B
- known distance

Future: multiple control points.

---

# 83. Configuration Model

## Plugin Settings

- default units
- default currency
- default folders
- **library folder** — where the shared Asset, Supplier and Trade catalogues live (§59)
- editor preferences

> **Amended 2026-08-26, by the product owner**, with §59 and §36. The library folder is a *plugin*
> setting rather than a project one, and that is the whole reason it is named here: a project
> setting is answered once per project, and the three catalogues belong to no project. One vault
> has one library, wherever its owner puts it.

**The library folder and a project folder may neither be equal nor contain one another.** Two
independently configurable paths can otherwise overlap, and the consequence is not cosmetic:
deleting a project is deleting its folder — the model has no delete operation of its own — so a
project folder holding the library would take the shared Asset, Supplier and Trade catalogues of
*every* project with it. The check therefore belongs at all three places a path is set — creating a
project, changing a project's folder, and moving the library — and refuses in every direction,
since either path can be the one that moves.

## Project Settings

- project currency
- units
- tax defaults
- contingency
- lifecycle configuration
- project folder

---

# 84. Custom Types

Support configurable:

- Zone Types
- Asset Types
- Trade Types
- Document Types
- Cost Types

---

# 85. Command Model

Examples:

- CreateProject
- CreatePlan
- CalibratePlan
- CreateZone
- MoveSpatialObject
- CreateConstructionSection
- AssignZone
- AssignAsset
- CreateRequirement
- CreateWorkPackage
- CompleteWorkPackage
- CreateOrder
- RecordActualCost

---

# 86. Domain Event Model

Examples:

- ProjectCreated
- PlanCalibrated
- ZoneCreated
- ZoneGeometryChanged
- ConstructionSectionCreated
- AssetAssigned
- RequirementCalculated
- WorkPackageCreated
- WorkPackageCompleted
- ProcurementOrdered
- MaterialDelivered
- ActualCostRecorded

---

# 87. Event Use Cases

Events can trigger:

- recalculation
- cache updates
- UI refresh
- audit trail
- future automation
- future extension hooks

---

# 88. Derived Data

Prefer calculation over redundant persistence.

```text
Polygon
  ↓
Area
  ↓
Requirement
  ↓
Estimated Cost
```

---

# 89. Manual Overrides

Calculated values must support visible manual overrides.

---

# 90. Validation

Validation levels:

- schema validation
- reference validation
- business rule validation
- geometry validation

---

# 91. Vault Health Check

Potential checks:

- invalid schemas
- broken references
- duplicate IDs
- missing assets
- invalid geometry
- orphan sidecars
- missing backgrounds

---

# 92. Diagnostics

Expose locally:

- plugin version
- schema version
- project version
- validation errors
- migration status

No automatic upload of project data.

---

# 93. Installation & Onboarding

```text
Install Plugin
   ↓
Create Renovation Project
   ↓
Choose Project Folder
   ↓
Import First Plan
   ↓
Calibrate
   ↓
Create First Zone
```

---

# 94. Empty States

Every central view should provide actionable empty states.

---

# 95. Example Project

Optionally include a demo project showing:

- a plan
- a zone
- a construction section
- an asset
- a work package
- a cost calculation

---

# 96. Plugin Lifecycle

```text
Install
↓
Initialize
↓
Use
↓
Upgrade
↓
Migrate
↓
Disable
↓
Uninstall
```

Disabling/removing the plugin must not make project data unusable.

---

# 97. Testing Strategy

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

# 98. Unit Tests

High coverage for:

## Geometry

- distance
- area
- perimeter
- centroid
- scale
- transforms
- snapping
- intersection

## Cost Engine

- unit costs
- waste
- tax
- discounts
- rounding
- aggregation

## Requirement Engine

- area-based quantity
- length-based quantity
- waste
- package size
- manual override

## Persistence

- frontmatter mapping
- sidecar mapping
- validation
- migrations
- broken references

---

# 99. Integration Tests

Include:

- Obsidian repository adapters
- plan loading
- Vault change detection
- persistence round-trips
- migration fixtures

---

# 100. Component Tests

Use Vitest + Vue Test Utils for:

- inspector
- toolbar
- selection state
- dialogs
- validation feedback

---

# 101. E2E Tests

Critical flows:

- create project
- import plan
- calibrate
- create zone
- persist/reload
- assign asset
- calculate requirement
- calculate cost

---

# 102. Performance Budgets

Initial measurable targets should be established for:

- plan load time
- pointer interaction latency
- pan/zoom responsiveness
- save latency
- project indexing time

---

# 103. Security & Privacy

Default:

- no telemetry
- no remote calls
- no cloud account
- no external persistence

Future integrations must be explicit and optional.

---

# 104. Extensibility

The architecture should support later:

- custom asset types
- custom zone types
- custom lifecycle/status models
- custom cost rules
- custom import/export adapters
- custom Bases views
- external integrations

---

# 105. Open Questions

The following should remain explicit decisions until resolved:

- one geometry sidecar per plan vs per spatial object
- desktop-only MVP vs mobile-read support
- Vue Ganttastic vs Frappe Gantt
- UUID vs ULID
- exact Markdown link + stable ID reference strategy
- quote/invoice modeling depth
- whether walls become first-class MVP entities
- whether project folder structure is mandatory or template-driven
