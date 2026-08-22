# Product Requirements Document

## Obsidian Renovation Planner

**Status:** Draft
**Version:** 0.1
**Product Type:** Obsidian Plugin
**Architecture:** Local-first, Markdown-native, spatially aware
**Primary Stack:** TypeScript · Vue 3 · Pinia · Vite · Vitest · Konva

---

## 1. Product Vision

The Obsidian Renovation Planner is a local-first planning tool for house, apartment, property, and garden projects.

The plugin connects visual, spatial planning with classic project, cost, and documentation planning.

The central idea is:

> The plan of a house or property becomes the spatial index of the entire renovation project.

Users can import, calibrate, and mark up floor plans, site plans, or their own sketches with rooms, areas, construction sections, and assets.

These spatial objects are not isolated drawings. They are connected to structured Obsidian data:

* Construction sections
* Trades
* Work packages
* Tasks
* Assets and materials
* Costs
* Suppliers
* Quotes
* Documents
* Decisions
* Photos
* Appointments

This creates a spatially navigable project model.

---

## 2. Product Thesis

Classic renovation planning typically spreads information across different tools:

* Floor plans and sketches
* Spreadsheets
* Task lists
* Quotes
* Invoices
* Photos
* Notes
* Calendars
* Project plans

The spatial relationship between this information gets lost in the process.

The Renovation Planner, in contrast, treats spatial objects as part of the project model.

```
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

The visualization itself is not the database.

Obsidian Markdown files form the persistent source of truth. The visual editor is a projection and interaction surface on top of this data model.

---

## 3. Product Principles

### 3.1 Local First

All project data lives locally in the Obsidian vault.

No cloud infrastructure is required for core functionality.

---

### 3.2 Markdown as Source of Truth

Project information remains:

* human-readable
* version-controllable
* portable
* searchable
* editable outside the plugin

The plugin must not require a proprietary database.

---

### 3.3 Spatially Aware

Spatial relationships are first-class domain information.

The system understands, among other things:

* Position
* Length
* Area
* Polygon
* Spatial membership
* Overlap
* Construction section
* Room
* Property area

---

### 3.4 Geometry Drives Planning

Geometry can generate project information.

Example:

```
Terrace
42.7 m²
        ×
Material demand
1.08 waste factor
        ×
34.95 €/m²
        ↓
Material quantity + cost
```

---

### 3.5 Progressive Complexity

A user does not need to create a complete digital floor plan.

The simplest workflow is:

```
Import image
      ↓
Calibrate
      ↓
Mark areas
      ↓
Assign project information
```

More advanced modeling can be added later.

---

### 3.6 Obsidian Native

Existing Obsidian concepts should be used wherever it makes sense:

* Markdown
* Properties
* Links
* Embeds
* Bases
* Commands
* Workspace views
* Search
* Tags

The plugin should extend Obsidian rather than creating a second, isolated application inside Obsidian.

---

## 4. Target Users

### Primary Persona — Private Renovator

A person independently planning:

* House renovation
* Apartment renovation
* Garden remodeling
* Outdoor facilities
* Extensions
* Smaller construction projects

and who wants to manage planning, costs, and documentation themselves.

**Jobs to be Done**

> When I want to renovate my house or property,
> I want to visualize all planned measures spatially and connect them with costs and tasks,
> so that I always understand what needs to be done where, what it costs, and how far the project has progressed.

---

### Secondary Persona — Advanced DIY Planner

Plans to do a lot of the work themselves and additionally needs:

* Material requirements
* Measurements
* Quantities
* Shopping lists
* Suppliers
* Cost comparison
* Dependencies

---

### Future Persona — Professional Planner

Potential future target groups:

* Small trade businesses
* Interior designers
* Landscape planners
* Building consultants
* Facility managers

These target groups are not part of the initial MVP.

---

## 5. Core User Journey

```
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

## 6. Domain Model

The core model should be implemented independently of Vue, Konva, and Obsidian.

```
RenovationProject
│
├── Site
│   │
│   ├── Building
│   │   └── Floor
│   │       └── Space
│   │
│   └── OutdoorArea
│
├── Plan
│   ├── Layer
│   └── SpatialObject
│
├── Zone
│
├── ConstructionSection
│
├── Asset
│
├── Trade
│
├── WorkPackage
│   └── Task
│
├── CostItem
│
├── Supplier
│
├── Quote
│
├── Document
│
└── Milestone
```

---

## 7. Spatial Domain

### 7.1 Geometry Types

Initial:

* Point
* Polyline
* Rectangle
* Polygon

Future:

* Circle
* Wall
* Opening
* Path
* Compound Polygon

---

### 7.2 World Coordinates

Canvas pixels must not be stored as domain measurements.

Internally, a world coordinate system is used.

Recommended base unit:

```
1 World Unit = 1 mm
```

Transformation:

```
World Coordinate
        ↓
Viewport Transform
        ↓
Canvas Coordinate
```

This keeps geometries independent of:

* Screen resolution
* Zoom
* Canvas size
* Export format

---

## 8. Core Entities

### Project

Represents the entire renovation project.

Properties:

* ID
* Name
* Description
* Status
* Start
* Target Completion
* Budget
* Contingency
* Location description
* Linked plans

---

### Plan

A spatial representation of a project area.

Examples:

* Property
* Ground floor
* Upper floor
* Basement
* Garden
* Garage

Properties:

* ID
* Name
* Background
* Scale
* Coordinate system
* Layers

---

### Zone

A functionally relevant area.

Examples:

* Kitchen
* Bathroom
* Terrace
* Front garden
* Flower bed
* Driveway
* Roof

A zone has geometry and can automatically provide length or area.

---

### Construction Section

A construction section groups related measures.

Examples:

* CS-01 Roof
* CS-02 Bathroom
* CS-03 Terrace
* CS-04 Front Garden

Properties:

* status
* priority
* phase
* zones
* trades
* work packages
* budget
* actual costs
* planned dates

---

### Asset

A physical or calculable element.

Examples:

* Tile
* Plant
* Window
* Light fixture
* Fence
* Sink
* Garden shed
* Paint

---

### Trade

A trade/craft discipline.

Examples:

* Electrical
* Plumbing
* Painting
* Tiling
* Landscaping
* Civil engineering
* Roofing

---

### Work Package

A plannable unit of work.

Example:

```
WP-TERRACE-03
Lay terrace slabs
```

Contains:

* Construction section
* Trade
* Scope
* Assets
* Tasks
* Dependencies
* Estimate
* Planned dates
* Actual dates
* Status

---

### Task

Concrete, executable work.

```
Order terrace slabs
Compact the substrate
Install drainage
Cut slabs to size
```

Tasks can reference regular Obsidian task notes or Markdown tasks.

---

## 9. Cost Model

The cost model is a central product feature.

Supported quantity units:

```
piece
m
m²
m³
hour
day
fixed
```

Examples:

```
Fence
18.4 m × 89 €/m

Tiles
27.4 m² × 1.10 waste factor × 45 €/m²

Light fixtures
8 pieces × 79 €

Electrician
12 h × 75 €/h
```

---

## 10. Cost Hierarchy

```
Project
   │
   ├── Construction Section
   │       │
   │       └── Work Package
   │               │
   │               └── Cost Item
   │
   └── Assets
```

Costs should be aggregatable by:

* Project
* Construction section
* Zone
* Trade
* Work package
* Asset
* Supplier

---

## 11. Cost Types

Supported:

* Estimated Cost
* Quoted Cost
* Committed Cost
* Actual Cost

This later enables a view such as:

```
Budget             80,000 €
Estimate           73,500 €
Quoted             69,200 €
Committed          51,400 €
Actual             32,800 €
```

---

## 12. Epic 1 — Project Management

### Goal

Users can manage renovation projects as a central domain.

### Features

**F1.1 Create Project**

Create a project with:

* Name
* Description
* Budget
* Timeframe
* Status

**F1.2 Project Dashboard**

Display of:

* Total budget
* Costs
* Progress
* Construction sections
* Open tasks
* Upcoming work

**F1.3 Project Navigation**

Direct access to:

* Plans
* Zones
* Assets
* Work packages
* Budget
* Schedule

---

## 13. Epic 2 — Plan Editor

### Goal

Users can visualize their project spatially.

**F2.1 Plan Creation**

Create plans for different areas.

**F2.2 Background Import**

Support for:

* PNG
* JPEG
* PDF

**F2.3 Pan & Zoom**

Navigation within large plans.

**F2.4 Layers**

Show/hide layers.

Initial:

* Background
* Areas
* Construction Sections
* Assets
* Work
* Annotation

**F2.5 Selection**

Select objects and edit properties.

**F2.6 Multi Selection**

Select multiple objects together.

**F2.7 Undo / Redo**

Editor command history.

**F2.8 Grid**

Optional grid.

**F2.9 Snapping**

Snapping to:

* Grid
* Points
* Lines
* Other objects

---

## 14. Epic 3 — Calibration & Measurement

### Goal

Visual plans become measurable project models.

**F3.1 Scale Calibration**

Users mark two points.

```
A ●──────────────● B
Distance: 5.40 m
```

The plugin derives the scale from this.

**F3.2 Distance Measurement**

Measure distances.

**F3.3 Area Calculation**

Automatically calculate polygon area.

**F3.4 Perimeter**

Calculate perimeter.

**F3.5 Measurement Annotation**

Permanently display measurements on the plan.

---

## 15. Epic 4 — Zones & Spatial Objects

### Goal

Project areas can be marked semantically.

**F4.1 Polygon Tool**

Draw freeform areas.

**F4.2 Zone Types**

Examples:

* Room
* Garden
* Terrace
* Driveway
* Roof
* Construction Area
* Custom

**F4.3 Zone Metadata**

Zones receive:

* Name
* Type
* Status
* Notes
* Tags

**F4.4 Markdown Link**

Every zone can be linked to an Obsidian note.

**F4.5 Spatial Queries**

Later:

* Assets in zone
* Work packages in zone
* Construction sections intersecting a zone

---

## 16. Epic 5 — Construction Sections

### Goal

Group renovation measures spatially and organizationally.

**F5.1 Create Construction Section**

Create a construction section.

**F5.2 Spatial Assignment**

Assign one or more zones.

**F5.3 Trade Assignment**

Assign trades.

**F5.4 Budget**

Set a budget.

**F5.5 Status**

Lifecycle:

```
idea
planned
ready
in-progress
blocked
completed
cancelled
```

**F5.6 Visual Status**

Construction sections are displayed distinctly on the plan depending on their status.

---

## 17. Epic 6 — Asset Library

### Goal

Manage reusable materials and physical objects.

**Asset Categories**

* Material
* Furniture
* Fixture
* Plant
* Equipment
* Building Element
* Custom

**F6.1 Asset Definition**

Properties:

* name
* category
* supplier
* SKU
* unit
* unit cost
* waste factor
* notes

**F6.2 Asset Placement**

Place assets on the plan.

**F6.3 Asset Quantity**

Define quantity or amount.

**F6.4 Geometry-linked Asset**

Link an asset to a zone.

Example:

```
Terrace slabs
applies-to: [[Terrace]]
```

**F6.5 Automatic Quantity**

Derive quantity from geometry.

```
Zone area
× waste
=
required material
```

**F6.6 Asset Catalog**

Searchable library of all assets.

---

## 18. Epic 7 — Cost & Budget Engine

### Goal

Automatically derive project costs from planning and quantities.

**F7.1 Cost Items**

Create cost items.

**F7.2 Geometry-based Cost**

Calculate cost based on:

* Length
* Area
* Volume
* Quantity

**F7.3 Labor Cost**

```
hours × hourly rate
```

**F7.4 Fixed Cost**

Flat-rate costs.

**F7.5 Waste Factor**

Account for material waste.

**F7.6 Contingency**

Project or construction section reserve.

**F7.7 Budget Aggregation**

Aggregation by:

* Project
* Construction section
* Trade
* Work package
* Asset
* Supplier

**F7.8 Planned vs Actual**

Compare planned and actual costs.

---

## 19. Epic 8 — Trades & Work Packages

### Goal

Turn spatial planning into executable project planning.

**F8.1 Trade Catalog**

Manage trades.

**F8.2 Work Package Creation**

Create work packages.

**F8.3 Spatial Scope**

Link a work package with:

* Plan
* Zone
* Construction section

**F8.4 Assets**

Assign required assets.

**F8.5 Tasks**

Assign tasks.

**F8.6 Dependencies**

Define dependencies.

Example:

```
Demolition
     ↓
Electrical
     ↓
Plumbing
     ↓
Tiling
     ↓
Painting
```

**F8.7 Progress**

Determine progress.

---

## 20. Epic 9 — Task Management

### Goal

Drive concrete work directly from planning.

**F9.1 Create Task**

Create a task directly from:

* Zone
* Asset
* Work package
* Construction section

**F9.2 Task Status**

```
todo
in-progress
blocked
done
cancelled
```

**F9.3 Due Date**

Set a due date.

**F9.4 Dependencies**

Task dependencies.

**F9.5 Obsidian Integration**

Existing Obsidian tasks should be reused wherever possible.

---

## 21. Epic 10 — Schedule

### Goal

Schedule renovation measures over time.

**F10.1 Timeline**

Display work packages on a timeline.

**F10.2 Start / End**

Define timeframes.

**F10.3 Dependencies**

Predecessor/successor relationships.

**F10.4 Milestones**

Examples:

* Demolition complete
* Bathroom usable
* Exterior complete

**F10.5 Trade Timeline**

Display planning by trade.

**F10.6 Construction Section Timeline**

Display planning by construction section.

---

## 22. Epic 11 — Suppliers & Quotes

### Goal

Connect cost planning with real quotes.

**F11.1 Supplier**

Manage suppliers.

**F11.2 Quote**

Document quotes.

**F11.3 Quote Items**

Capture quote line items.

**F11.4 Link Assets**

Link quote line items to assets.

---

## 23. Epic 12 — Documents, Photos & Evidence

### Goal

All project-relevant documents should be linkable to spatial and domain objects.

**F12.1 Document Linking**

Documents can be linked to:

* Project
* Plan
* Zone
* Construction Section
* Asset
* Work Package
* Supplier
* Quote
* Order
* Invoice

**F12.2 Photo Documentation**

Photos can be used as project documentation.

Use cases:

* Before photo
* Construction progress
* Defect
* Detail shot
* After photo

**F12.3 Spatial Photo Reference**

A photo can additionally be linked to a point or area on the plan.

**F12.4 Document Types**

Supported document types:

* Quote
* Invoice
* Delivery note
* Product data sheet
* Assembly instructions
* Permit
* Warranty
* Contract
* Photo
* Sketch
* Other

**F12.5 Evidence Timeline**

Documents and photos can be displayed chronologically.

---

## 24. Epic 13 — Procurement & Shopping

### Goal

Concrete procurement planning should emerge from planning, assets, and quantities.

**F13.1 Procurement Requirement**

A procurement requirement can be generated from a material requirement.

Example:

```
Terrace
Calculated Requirement
46.2 m² Terrace slabs
Package Size
1.44 m²
Required Packages
33
Ordered Quantity
47.52 m²
```

**F13.2 Procurement Status**

Lifecycle:

```
needed
researching
selected
ordered
partially-delivered
delivered
installed
cancelled
```

**F13.3 Shopping List**

Procurement items can be grouped by:

* Supplier
* Construction section
* Trade
* Work package
* Priority

**F13.4 Package Size**

Materials can have packaging or sales units.

Examples:

* Tiles per box
* Paint per bucket
* Screws per pack
* Gravel per big bag

**F13.5 Minimum Order Quantity**

Minimum order quantities can be taken into account.

**F13.6 Delivery Date**

Planned and actual delivery date.

**F13.7 Procurement Dependencies**

A work package can only become ready once the required materials are available.

---

## 25. Epic 14 — Decisions & Change Management

### Goal

Planning decisions and changes must be traceably documented.

**F14.1 Decision**

Decisions can be managed as their own domain objects.

Properties:

* question
* alternatives
* decision
* rationale
* decision date
* affected objects

**F14.2 Change Request**

A planned change can be documented.

Examples:

* Material change
* Scope expansion
* Rescheduling of a construction section
* Additional work
* Removal of a work item

**F14.3 Impact Analysis**

Changes can have effects on:

* Budget
* Schedule
* Assets
* Procurement
* Work packages
* Tasks

**F14.4 Change History**

Changes remain traceable.

---

## 26. Epic 15 — Risks, Issues & Constraints

### Goal

Transparently manage the project's risks, issues, and constraints.

**F15.1 Risk**

Properties:

* probability
* impact
* exposure
* mitigation
* owner
* affected area

**F15.2 Issue**

Active issues can be documented.

Examples:

* Moisture discovered
* Material unavailable
* Tradesperson unavailable
* Unclear routing of pipes/cables

**F15.3 Constraint**

Constraints can be recorded.

Examples:

* Budget ceiling
* Permit
* Delivery deadline
* Weather
* Access to the property

**F15.4 Spatial Issue**

Risks and issues can be marked spatially on the plan.

---

## 27. Epic 16 — Progress & Site Documentation

### Goal

The plugin should support not only planning but also execution.

**F16.1 Progress Tracking**

Progress can be tracked for:

* Construction section
* Work package
* Task

**F16.2 Planned vs Actual**

Display of:

* Planned start
* Actual start
* Planned end
* Actual end

**F16.3 Progress Photos**

Progress photos can be linked to work items.

**F16.4 Site Log**

Optional construction diary.

Entries can include:

* Date
* Work performed
* Trades involved
* Issues
* Decisions
* Photos

**F16.5 Completion Evidence**

Completed work packages can include evidence.

---

## 28. Epic 17 — Reporting & Project Cockpit

### Goal

The user gets a compact overview of project status at any time.

**F17.1 Project Health**

Display of:

* Budget status
* Schedule status
* Progress
* Risks
* Open decisions
* Open procurement

**F17.2 Budget Overview**

Breakdown by:

* Construction section
* Trade
* Work package
* Asset
* Supplier

**F17.3 Forecast**

Calculation of an expected final value.

```
Actual Cost
+
Committed Cost
+
Remaining Estimate
=
Forecast
```

**F17.4 Upcoming Work**

Display of the next planned work items.

**F17.5 Procurement Overview**

Display of:

* Still to order
* Ordered
* Delayed
* Delivered

**F17.6 Project Summary**

Summary project view as a dashboard.

---

## 29. Epic 18 — Scenarios & Alternatives

### Goal

Alternative solutions can be compared before being committed to.

**F18.1 Scenario**

A scenario describes a possible variant of a subproject.

Example:

```
Terrace Renovation
Scenario A
Wood decking
Scenario B
Porcelain tiles
Scenario C
Concrete slabs
```

**F18.2 Scenario Costs**

Each scenario can have its own calculation.

**F18.3 Scenario Schedule**

Scenarios can have different time requirements.

**F18.4 Scenario Assets**

Alternative assets or materials.

**F18.5 Scenario Comparison**

Comparison by:

* Cost
* Duration
* Material
* Effort
* Risks

**F18.6 Select Scenario**

A scenario can be selected as the planned solution.

---

## 30. Epic 19 — Existing State, Planned Change & As-Built

### Goal

Renovation projects must distinguish between existing state, planned change, and actual outcome.

**State Model**

```
Existing State
      ↓
Planned Change
      ↓
Execution
      ↓
As-Built State
```

**F19.1 Existing Object**

Existing objects can be marked as existing state.

**F19.2 Retain**

Objects remain unchanged.

**F19.3 Remove**

Objects are removed.

**F19.4 Modify**

Existing objects are changed.

**F19.5 New**

New objects are added.

**F19.6 Installed**

New objects have actually been implemented.

**F19.7 State Visualization**

Plans can visualize different states:

```
existing
to-remove
to-retain
planned
in-progress
installed
```

**F19.8 Existing vs Target View**

Users can switch between existing state and target state.

**F19.9 As-Built Documentation**

After project completion, the plan reflects the actual final state.

---

## 31. Epic 20 — Plan Revisions

### Goal

Plan changes should be formally versioned.

**F20.1 Revision**

Every plan has a revision.

**F20.2 Revision Metadata**

Properties:

* revision number
* created
* author
* status
* description

**F20.3 Revision Lifecycle**

```
draft
proposed
approved
superseded
as-built
```

**F20.4 Revision Comparison**

Later, changes between revisions can be displayed.

**F20.5 Immutable Approved Revision**

Approved revisions should not be unintentionally modified.

---

## 32. Quantity & Requirement Domain

### Purpose

Requirement, product, procurement, and cost must not be the same entity.

**Asset**

Defines a product or material.

```
Fine stoneware terrace slab
```

**Requirement**

Defines a needed quantity.

```
46.2 m² terrace slab
```

**Procurement Item**

Defines the actual procurement.

```
33 boxes / 47.52 m² ordered
```

**Cost Item**

Defines the financial valuation.

```
€1,661.42
```

**Installed Quantity**

Defines the actual consumption.

```
43.8 m² installed
```

**Requirement Properties**

* required asset
* source geometry
* calculated quantity
* waste factor
* unit
* manual override
* required date

---

## 33. Financial Lifecycle

### Goal

Budget planning and actual cash flow are cleanly separated.

```
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

**Budget**

Approved financial framework.

**Estimate**

Currently expected costs.

**Quote**

Price offer from a supplier or trade.

**Commitment**

Bindingly ordered or contracted costs.

**Invoice**

Actually invoiced costs.

**Payment**

Actual payment.

**Forecast**

```
Actual
+
Committed but not invoiced
+
Remaining Estimate
=
Estimated Final Cost
```

---

## 34. Spatial Object Model

Spatial objects should be differentiated by domain.

```
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

A domain zone must therefore not automatically be equated with a physical object.

---

## 35. Renovation Lifecycle

A shared lifecycle serves as the domain orientation for the overall project.

```
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

Individual object types can use their own sub-lifecycles.

---

## 36. Vault Data Model

### Goal

The project remains fully usable as a traceable vault structure.

Recommended structure:

```
Renovation/
│
├── Project.md
│
├── Plans/
│
├── Zones/
│
├── Construction Sections/
│
├── Work Packages/
│
├── Tasks/
│
├── Assets/
│
├── Requirements/
│
├── Trades/
│
├── Suppliers/
│
├── Quotes/
│
├── Orders/
│
├── Invoices/
│
├── Costs/
│
├── Decisions/
│
├── Risks/
│
├── Documents/
│
└── Photos/
```

The paths must be configurable.

---

## 37. Persistence Strategy

**Note-Based Entities**

The following objects should generally be persisted as Markdown notes:

* Project
* Plan
* Zone
* Construction Section
* Work Package
* Asset
* Requirement
* Trade
* Supplier
* Quote
* Order
* Invoice
* Decision
* Risk

**Embedded Data**

Suitable for embedded data:

* simple geometry
* smaller configuration objects
* references

**Sidecar Data**

Large or editor-specific data may be stored as sidecar files.

Example:

```
plan-name.plan.json
```

Suitable for:

* geometry
* layer states
* large object collections

**Ephemeral State**

UI state only:

* current selection
* hover state
* open context menu
* temporary drawing state

---

## 38. Geometry Persistence

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

The rendering layer applies the viewport transformation.

---

## 39. User Experience Requirements

**Editor Layout**

Recommended:

```
┌──────────────────────────────────────────────────────┐
│ Toolbar                                              │
├────────────┬────────────────────────────┬────────────┤
│ Layers     │                            │ Inspector  │
│            │                            │            │
│ Objects    │           Plan             │ Properties │
│            │                            │            │
│ Library    │                            │ Relations  │
├────────────┴────────────────────────────┴────────────┤
│ Status / Selection / Measurements                   │
└──────────────────────────────────────────────────────┘
```

**Primary Tools**

The initial editor should deliberately have few tools:

* Select
* Pan
* Draw Area
* Place Asset
* Measure
* Annotate

**Inspector**

Selected objects show context-dependent properties.

**Context Actions**

Should be supported:

* Edit
* Duplicate
* Delete
* Link Note
* Create Work Package
* Add Cost
* Add Task

**Keyboard Shortcuts**

At minimum:

* Undo
* Redo
* Delete
* Copy
* Paste
* Duplicate
* Escape
* Fit to Screen

**Object Visibility**

Objects can be:

* hidden
* visible
* locked

**Accessibility**

Important information must not be communicated exclusively through color.

---

## 40. Search & Navigation

### Goal

Spatial objects must remain reachable even without the canvas.

Users should, for example, be able to search for:

```
Terrace
```

and get back:

* Zone
* Construction section
* Work packages
* Assets
* Documents

**Focus in Plan**

From a note or a Bases row, users can navigate to the corresponding object on the plan.

---

## 41. Bases Integration

Going forward, the plugin should provide several Obsidian Bases views.

Planned views:

* Renovation Plan
* Budget
* Assets
* Procurement
* Work Packages
* Schedule
* Risks

The views use the same vault data as the plan editor.

---

## 42. Import Requirements

**Initial**

* PNG
* JPEG
* PDF

**Future**

* SVG
* CSV
* XLSX
* GeoJSON
* common floorplan formats where feasible

Import must never unintentionally overwrite existing vault data.

---

## 43. Export Requirements

**Initial**

* PNG snapshot
* JSON geometry
* Markdown

**Future**

* PDF project report
* SVG
* CSV
* XLSX
* procurement list
* cost report

---

## 44. Non-Functional Requirements

### 44.1 Performance

The editor should remain usable even with larger projects.

Goals:

* several hundred spatial objects per plan
* smooth pan and zoom
* no vault writes during pointer movement
* persistent writes only on completed commands or via debounce

---

### 44.2 Reliability

The plugin must not corrupt existing vault data.

Requirements:

* validated writes
* recovery from invalid frontmatter
* fault-tolerant loading
* undo/redo
* traceable error messages

---

### 44.3 Maintainability

Business logic must be implemented independently of the UI framework and Obsidian.

```
Core
↓
Domain
↓
Application
↓
Adapters
↓
UI
```

Vue, Pinia, Konva, and Obsidian dependencies must not leak into the domain core.

---

### 44.4 Testability

At minimum, the following areas must be fully unit-testable:

* Geometry Engine
* Unit Conversion
* Cost Engine
* Requirement Engine
* Scheduling Logic
* Validation
* Persistence Mapping

Vitest is the primary test framework.

---

### 44.5 Interoperability

Persisted data must be based on open formats wherever possible:

* Markdown
* YAML
* JSON
* PNG
* JPEG
* PDF
* CSV

---

### 44.6 Portability

Vault data remains readable even without the plugin installed.

---

### 44.7 Accessibility

The editor must support at least:

* keyboard-based core actions
* visible focus
* sufficient contrast
* status shown not exclusively through color
* alternative tabular display of important data

---

### 44.8 Error Handling

Error classes should be distinguished by domain:

* validation error
* persistence error
* import error
* geometry error
* calculation error
* unsupported format

Errors must not cause silent data loss.

---

## 45. Technical Constraints

Given stack:

```
Obsidian
TypeScript
Vue 3
Pinia
Vite
Vitest
```

Recommended libraries:

```
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

Optional future libraries:

```
frappe-gantt
vue-ganttastic
papaparse
xlsx
comlink
```

---

## 46. Architecture Constraints

**Source of Truth**

```
Obsidian Vault
```

not:

```
Pinia
Konva
Browser Storage
```

**Pinia**

Pinia serves as:

* UI state
* application cache
* active project state

**Konva**

Konva is exclusively:

```
Rendering + Interaction Adapter
```

and never the domain model.

**Geometry Core**

Framework-free TypeScript.

---

## 47. Proposed Architecture

```
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

## 48. MVP Scope

**MVP — Spatial Renovation Planning**

The MVP answers:

> What should be changed where, and what quantities and costs result from it?

**Included**

* Project
* Plan
* image/PDF background
* calibration
* pan/zoom
* polygon zones
* construction sections
* basic assets
* measurements
* geometry calculations
* basic requirement calculation
* €/piece
* €/m
* €/m²
* basic budget aggregation
* Markdown persistence
* Obsidian links
* undo/redo
* Vitest coverage

**Explicitly Out of Scope**

* 3D
* CAD replacement
* BIM
* automated architectural design
* professional quantity surveying
* advanced scheduling
* invoices/payments
* collaboration backend

---

## 49. V1 Scope — Renovation Management

V1 adds:

* Trades
* Work Packages
* Tasks
* Schedule
* Suppliers
* Quotes
* Procurement
* Planned vs Actual Costs
* Documents
* Photos
* Progress
* Project Dashboard

---

## 50. V2 Scope — Advanced Planning

V2 adds:

* scenarios
* alternatives
* change management
* risks/issues
* plan revisions
* existing vs target state
* as-built state
* advanced geometry
* spatial queries
* forecast
* reporting
* extended imports/exports

---

## 51. Success Metrics

Success should not be measured solely by frequency of use.

**Planning Coverage**

Share of planned renovation measures that are linked to a spatial area.

**Cost Coverage**

Share of work packages with a cost estimate.

**Procurement Coverage**

Share of required materials with defined procurement information.

**Execution Coverage**

Share of work packages with a current status.

**Documentation Coverage**

Share of completed construction sections with a documented outcome.

---

## 52. Product Success Criteria

An initial version is successful if a user can fully carry out the following:

1. Create a renovation project
2. Import a floor plan or garden plan
3. Calibrate the scale
4. Mark a construction section spatially
5. Automatically determine the area
6. Assign material
7. Calculate the required quantity
8. Calculate material costs
9. Assign a trade and work package
10. Create tasks
11. Aggregate the project budget
12. Keep all information as traceable vault data

---

## 53. Core Product Loop

```
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

This loop forms the domain core of the product.

---

## 54. Long-Term Product Direction

In the long term, the Renovation Planner should evolve into a spatially-aware project system.

It should not attempt to fully replace professional CAD, BIM, or construction project management systems.

The positioning remains:

> A lightweight, local-first, and Markdown-native connection between spatial planning, project management, cost planning, and project documentation.

The visual plan serves as the spatial entry point into the entire body of project knowledge.
