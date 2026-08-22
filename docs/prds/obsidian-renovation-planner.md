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
