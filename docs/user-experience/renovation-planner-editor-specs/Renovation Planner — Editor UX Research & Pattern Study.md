# Renovation Planner — Editor UX Research & Pattern Study

**Status:** Initial research baseline  
**Research date:** 1 September 2026  
**Scope:** Spatial editor, plan acquisition, room/wall editing, contextual information, renovation-specific interaction patterns

---

## 1. Executive Summary

The Renovation Planner editor should not evolve into a simplified CAD application.

Its primary purpose should be:

> **Create a spatial representation of the property that homeowners can use to understand, design, scope, document and manage a renovation.**

The competitive research reveals two distinct product families.

### Home-design / floor-planning products

Examples:

- Floorplanner
- RoomSketcher
- Planner 5D
- Homestyler

Their dominant workflow is:

**Create structure → add openings → decorate → visualize**

They provide very mature interaction patterns for:

- drawing rooms,
- drawing walls,
- editing dimensions,
- importing plans,
- snapping doors/windows,
- direct manipulation,
- 2D/3D switching,
- object libraries.

### Survey / renovation / field products

The most relevant example is:

- magicplan

Its model is closer to:

**Capture property → attach information → determine work → calculate scope/cost → document**

magicplan allows information such as measurements, photos and notes to be attached directly to projects, floors, rooms, walls and objects. It also derives material and labor estimates from the spatial model.

This distinction is strategically important.

Renovation Planner should take:

- **geometry interaction patterns** from Floorplanner / RoomSketcher / Planner 5D,
- **project-information patterns** from magicplan,
- and combine these with its own renovation lifecycle.

---

# 2. Current Renovation Planner Baseline

The existing implementation already contains a surprisingly solid editor architecture.

The editor currently has dedicated areas for:

- toolbar,
- layers,
- canvas,
- inspector,
- status information.

The codebase also has separate editor modules for tools, viewport management, snapping, scene management, selection, inspector behavior, layers and save-state handling. 

The primary editor shell already conditionally mounts the canvas and places Layers and Inspector beside it. 

The current toolbar exposes:

- Pan
- Select
- Draw Zone
- Calibrate
- Undo
- Redo

and the underlying architecture distinguishes camera navigation from editing commands. 

The current inspector already reacts to selection and exposes:

- name,
- area,
- requirements,
- asset assignment,
- deletion.



Therefore this research does **not** recommend replacing the underlying editor architecture.

The key opportunity is redesigning the **user-facing interaction and conceptual model**.

---

# 3. Competitive UX Analysis

## 3.1 Floorplanner

### Strongest patterns

Floorplanner supports both:

1. **Room-first creation**
2. **Wall-by-wall creation**

Its own manual explicitly states that drawing room-by-room is faster. A room can be dragged onto the canvas and automatically receives dimensions. Those dimensions can then be edited numerically.

Wall-by-wall drawing remains available for irregular or precise layouts. Enclosed walls automatically create a room.

### UX lesson

This is an excellent example of **progressive precision**:

```text
Fast:
create room
     ↓
drag approximate dimensions

Precise:
click dimension
     ↓
enter exact value
```

The user doesn't have to choose between usability and accuracy.

### Renovation Planner implication

Support both:

**Add Room**

and:

**Draw Wall**

but make **Add Room** the beginner default.

---

# 3.2 RoomSketcher

RoomSketcher strongly reinforces the same direct-manipulation model.

Users can:

- draw walls,
- drag walls to reshape rooms,
- see measurements,
- type exact wall lengths,
- drag doors/windows onto walls,
- rely on snapping.



This combination is especially important:

> **Drag for exploration; type for precision.**

### Blueprint workflow

RoomSketcher also has a mature import-and-trace workflow:

```text
Upload blueprint
        ↓
Rotate
        ↓
Crop
        ↓
Set scale using one known measurement
        ↓
Trace walls
        ↓
Add doors/windows
        ↓
Hide blueprint
```



RoomSketcher now also supports AI conversion of uploaded plans into editable geometry.

### Renovation Planner implication

Your existing `Calibrate` capability should probably stop being presented primarily as an editor tool.

Calibration belongs naturally inside:

> **Set up reference plan**

rather than beside Select and Draw.

---

# 3.3 Planner 5D

Planner 5D is particularly strong in providing **multiple ways to begin**.

A room can be created using:

- predefined shapes,
- free-form drawing.



It also offers a Smart Wizard that guides users through:

- room type,
- room shape,
- room dimensions,
- style.



### Direct manipulation

Rooms can be resized either:

- by dragging walls,
- or by entering exact dimensions.



### Background workflow

Planner 5D lets users add a reference image and scale it by positioning a ruler over a known measurement.

Its current plan-upload workflow also recognizes many file formats and can convert uploaded plans into editable projects.

### UX lesson

Planner 5D recognizes an important reality:

> Users arrive with very different levels of spatial knowledge.

Some know:

> “My kitchen is 4.2 × 3.7 m.”

Others know:

> “I have this PDF from when we bought the house.”

Others just want:

> “Something roughly shaped like this.”

The editor should accommodate all three.

---

# 3.4 Homestyler

Homestyler shows an increasingly mature acquisition strategy.

Its current Import Floor Plan workflow offers:

- image,
- PDF,
- DWG/DXF,
- multi-floor plans,
- RoomScan,
- manual tracing,
- automatic generation.



After automatic generation, users can keep the base drawing visible to compare the generated geometry with the source.

That is an important UX detail.

Import is not merely:

> source → conversion → source disappears.

Instead:

> source ↔ interpreted model

remain comparable.

### Renovation Planner implication

Imported plans should remain a manageable layer:

```text
Reference plan

Visibility     On
Opacity        45%
Locked         Yes
Scale          1:50

[ Recalibrate ]
[ Replace ]
[ Remove ]
```

This is much more useful than treating the uploaded image as a temporary setup artifact.

---

# 3.5 magicplan

magicplan is the most strategically relevant competitor in this study.

It supports many plan creation methods:

- room scanning,
- square rooms,
- free-form rooms,
- imported plans,
- filler rooms.



On supported iOS devices, its scanning workflow can detect spatial geometry using AR/LiDAR.

But scanning is not the most important lesson.

## The important lesson: spatial objects become information containers

magicplan lets users attach information to:

- project,
- floor,
- room,
- wall,
- object.

This information includes:

- dimensions,
- photos,
- notes,
- forms,
- other details.



Photos and notes can specifically belong to individual walls or rooms rather than just the overall project.

This creates a much richer object model:

```text
Room
 ├ Geometry
 ├ Measurements
 ├ Photos
 ├ Notes
 ├ Objects
 ├ Forms
 └ Statistics
```

magicplan then goes further and uses the spatial model for estimating labor and materials.

It even supports mapping outdoor property areas through its Land Survey mode.

### Renovation Planner implication

This is very close to the direction we need, but Renovation Planner can extend it with stronger homeowner project-planning concepts:

```text
Room
 ├ Existing state
 ├ Desired state
 ├ Work
 ├ Requirements
 ├ Materials
 ├ Trades
 ├ Budget
 ├ Quotes
 ├ Documents
 ├ Photos
 ├ Notes
 └ Decisions
```

That could become a significant product differentiator.

---

# 3.6 Figma and general graphical editors

Figma offers a useful reference for basic canvas behavior.

Its Move tool is active by default. The Hand tool exists, but users can temporarily activate it by holding Space.

This reinforces a widespread graphical-editor convention:

> **Navigation should usually not require changing persistent editing mode.**

### Renovation Planner implication

The current distinction:

```text
Pan
Select
```

should probably disappear from the visible primary interaction model.

Instead:

```text
Selection = normal state

Space + drag    → pan
Middle drag     → pan
Trackpad        → pan
Wheel / pinch   → zoom
```

The internal camera mode can remain.

The user shouldn't have to think about it.

---

# 4. Pattern Matrix

| Capability | Floorplanner | RoomSketcher | Planner 5D | Homestyler | magicplan | RP direction |
|---|---|---|---|---|---|---|
| Room-first creation | Strong | Yes | Strong | Yes | Strong | **Required** |
| Wall-first creation | Strong | Strong | Yes | Strong | Yes | **Required** |
| Exact dimensions | Strong | Strong | Strong | Strong | Strong | **Required** |
| Direct manipulation | Strong | Strong | Strong | Strong | Strong | **Required** |
| Blueprint tracing | Yes | Strong | Yes | Strong | Yes | **Required** |
| Automatic plan conversion | Emerging | Yes | Yes | Yes | Scan based | Later |
| Mobile scanning | Limited | — | — | LiDAR | Strong | Later |
| Object snapping | Yes | Strong | Yes | Yes | Yes | Required |
| Object details | Basic | Basic | Basic | Design oriented | **Strong** | **Very strong** |
| Photos linked spatially | Weak | Weak | Weak | Weak | **Strong** | **Core** |
| Notes linked spatially | Weak | Weak | Weak | Weak | **Strong** | **Core** |
| Work scope | Weak | Weak | Weak | Weak | Strong | **Core** |
| Cost estimation | Weak | Weak | Weak | Interior cost | **Strong** | **Core** |
| Renovation states | Weak | Weak | Weak | Weak | Partial | **Differentiator** |
| Garden/property | Limited | Limited | Some | Some | Strong | **Required eventually** |

---

# 5. The Critical Mental Model

The editor should be built around:

> **Property → Space → State → Change → Work**

rather than:

> geometry → decoration.

A homeowner thinks:

```text
House
 └ Ground Floor
    └ Kitchen
       ├ what exists
       ├ what I dislike
       ├ what I want
       ├ what needs changing
       └ what it will cost
```

not:

```text
Polygon 87
 ├ vertices
 ├ material
 └ asset references
```

The domain model can remain technical.

The UX must not.

---

# 6. Recommended Editor Object Vocabulary

## Property-level objects

```text
Property
Building
Garden
Terrace
Driveway
Boundary
```

## Building hierarchy

```text
Building
 └ Floor
    └ Room / Area
```

## Structural objects

```text
Wall
Door
Window
Opening
Stair
Column
```

## Planning objects

```text
Area
Object
Fixture
Furniture
Equipment
```

## Renovation objects

```text
Change
Work Item
Material
Requirement
Decision
Issue
```

A critical design recommendation follows from this:

### Stop exposing `Zone` as the main UX concept.

Internally:

```text
Zone
```

may remain perfectly valid.

Externally it should become context-specific:

```text
Room
Area
Garden Area
Terrace
Work Area
```

depending on use.

---

# 7. Target Editor Interaction Model

## Default state

The editor opens in **Select**.

Users should be able to:

- click an object to select it,
- click empty space to clear selection,
- drag selected objects where applicable,
- drag handles to resize,
- scroll/pinch to zoom,
- Space+drag to pan,
- press Esc to cancel the current action,
- press Delete to remove a selected object,
- use keyboard undo/redo.

Explicit Pan mode can remain available for accessibility/touch cases but should not be primary.

---

# 8. Proposed Add Model

Instead of:

```text
Pan
Select
Draw Zone
Calibrate
```

use:

```text
Select

+ Add
```

Opening Add might show:

```text
STRUCTURE

Room
Wall
Door
Window
Opening
Stairs

SITE

Area
Path
Fence
Structure

PLANNING

Object
Annotation
Measurement
```

Later this could become searchable.

This is scalable to dozens of object types without turning the toolbar into a cockpit.

---

# 9. Room Creation Strategy

Room creation should have two primary methods.

## Quick Room

```text
Add Room

┌────────┐ ┌──────────────┐ ┌────────────┐
│ Square │ │ Rectangle    │ │ Free shape │
└────────┘ └──────────────┘ └────────────┘
```

After placement:

```text
Room type?

Kitchen
Living Room
Bathroom
Bedroom
Hall
Office
Other
```

The type can always be changed later.

## Draw Walls

For more advanced layouts:

```text
Add → Wall
```

Click:

```text
A ───── B ───── C
              │
              D
```

As soon as a closed perimeter exists, offer:

> Room detected — create room?

Potentially automatically later.

---

# 10. Dimension Editing

Dimensions should be visible when useful rather than permanently overwhelming the canvas.

During creation:

```text
            4.20 m
      ┌───────────────┐
      │               │
3.85m │    Kitchen    │
      │               │
      └───────────────┘
```

Selecting the `4.20 m` label should allow direct typing.

This pattern appears repeatedly across Floorplanner, RoomSketcher, Planner 5D and Homestyler.

Recommended principle:

> **Manipulate visually first; enter numbers when precision matters.**

---

# 11. Plan Acquisition Should Become a First-Class Workflow

A new floor should not simply present an empty editor.

Instead:

```text
Create Ground Floor

How would you like to start?

┌────────────────────┐
│ Draw rooms         │
│ Fastest manually   │
└────────────────────┘

┌────────────────────┐
│ Upload floor plan  │
│ PDF / image        │
└────────────────────┘

┌────────────────────┐
│ Start empty        │
│ Advanced           │
└────────────────────┘
```

Future:

```text
Scan rooms
Import CAD
Auto-detect plan
```

---

# 12. Blueprint Workflow

Recommended flow:

```text
Upload
  ↓
Crop
  ↓
Rotate
  ↓
Choose known distance
  ↓
Enter real measurement
  ↓
Preview scale
  ↓
Confirm
  ↓
Trace
```

Afterwards the source becomes:

**Reference Layer**

rather than disappearing.

Recommended layer controls:

```text
Reference plan

Visible       ✓
Locked        ✓
Opacity       40%

[ Recalibrate ]
[ Replace ]
[ Remove ]
```

This closely follows successful patterns in RoomSketcher, Planner 5D and Homestyler.

---

# 13. The Renovation Model: Existing vs Planned

This should become one of Renovation Planner's defining concepts.

Most planning tools model a single world:

> What the room looks like.

Renovation requires at least two:

```text
EXISTING
────────
what is there now

PLANNED
───────
what should exist afterwards
```

And logically a third:

```text
WORK
────
what transforms one into the other
```

Example:

```text
Kitchen

EXISTING

Floor
Ceramic tile

Walls
Wallpaper

Heating
Radiator


PLANNED

Floor
Oak flooring

Walls
Painted plaster

Heating
Underfloor heating


WORK

Remove tile
Remove radiator
Prepare subfloor
Install heating
Install flooring
Repair walls
Paint walls
```

This creates a highly natural renovation model:

```text
Existing
     ↓
Changes
     ↓
Work
     ↓
Planned
```

---

# 14. Proposed Visual States

Geometry should visually communicate renovation intent.

For example:

```text
Existing wall
──────────────

Wall being removed
- - - - - - - -

New wall
━━━━━━━━━━━━━━━
```

Similarly:

```text
Existing object     normal
Remove object       faded / demolition
New object          planned
```

The exact visual language requires prototype testing.

The conceptual model should be established first.

---

# 15. Inspector Redesign

The existing Inspector architecture should be preserved and significantly expanded.

Current capabilities already demonstrate the correct pattern: selection drives an information panel. 

For a selected room:

```text
KITCHEN
17.8 m²

Overview
Renovation
Materials
Work
Costs
Documents
Photos
Notes
```

## Overview

```text
Name          Kitchen
Type          Kitchen
Floor         Ground Floor
Area          17.8 m²
Ceiling       2.52 m
```

## Renovation

```text
Current state

Floor         Tile
Walls         Wallpaper
Ceiling       Painted
Heating       Radiator


Planned state

Floor         Oak
Walls         Plaster + Paint
Heating       Underfloor
```

## Work

```text
8 work items

□ Remove tiles
□ Remove radiator
□ Electrical rough-in
□ Level floor
□ Install heating
□ Install flooring
□ Repair walls
□ Paint
```

## Costs

```text
Estimated       €9,800
Quoted           €8,650
Committed        €3,200
Actual           €1,400
```

## Documents

```text
Electrical quote.pdf
Kitchen layout.pdf
Heating proposal.pdf
```

## Photos

Spatially attached photography is one of magicplan's strongest renovation-relevant patterns and should become important here.

---

# 16. Canvas-to-Project Connection

The most important strategic principle is:

> **The canvas is not a separate drawing feature. It is another navigation mechanism through the renovation project.**

Clicking a room should be equivalent to opening that room in other project views.

Example:

```text
                         KITCHEN

                           │
              ┌────────────┼────────────┐
              ↓            ↓            ↓
          Canvas       Project tree     Search
              │            │            │
              └────────────┼────────────┘
                           ↓
                       Room entity
                           │
          ┌─────────┬──────┼──────┬─────────┐
          ↓         ↓      ↓      ↓         ↓
         Work     Costs  Files  Quotes    Notes
```

This avoids creating two products:

> visual planner

and

> renovation manager.

There should be one domain model with multiple views.

---

# 17. Progressive Disclosure

The beginner experience should intentionally hide most complexity.

## Initial editor

```text
Select

+ Add
   Room
   Wall
   Door
   Window

Undo
Redo
```

## After selecting a wall

Relevant controls appear:

```text
Wall

Length          4.20 m
Thickness       24 cm
State           Existing

Add
+ Door
+ Window

Renovation
Mark for removal
```

## After selecting a room

Completely different contextual actions appear.

This follows the principle:

> **Complexity should follow the user's object and task, not occupy the entire interface permanently.**

---

# 18. Layers

The existing Layers region should evolve beyond technical rendering layers.

Potential structure:

```text
GROUND FLOOR

Structure
☑ Rooms
☑ Walls
☑ Doors & Windows

Renovation
☑ Existing
☑ Demolition
☑ Planned

Information
☑ Measurements
☑ Work
☑ Notes
☑ Costs

Reference
☑ Blueprint
```

This allows the same model to answer different questions.

Examples:

### Planning

```text
Existing ✓
Planned  ✓
Work     off
Costs    off
```

### Contractor discussion

```text
Existing ✓
Demolition ✓
Planned ✓
Measurements ✓
```

### Budget review

```text
Work ✓
Costs ✓
Geometry simplified
```

---

# 19. Floors and Site Navigation

The left-hand navigation should eventually distinguish:

```text
PROPERTY

Site
Garden
Terrace

HOUSE

Ground Floor
First Floor
Basement
Roof
```

magicplan's Land Survey capability shows that exterior planning and property context belong naturally beside the building model.

This is particularly important for Renovation Planner because its scope includes more than interiors.

---

# 20. Recommended Editor Modes

Avoid creating tool modes such as:

```text
Pan
Select
Polygon
Calibrate
Measure
Asset
Requirement
```

Instead use **workflow perspectives**.

A candidate model:

```text
PLAN        RENOVATE        REVIEW
```

## Plan

Physical representation.

```text
Rooms
Walls
Doors
Windows
Dimensions
Reference plan
```

## Renovate

Transformation.

```text
Existing
Demolition
Planned
Materials
Requirements
Work
```

## Review

Project consequences.

```text
Scope
Costs
Quotes
Trades
Documents
Issues
```

This hypothesis needs prototyping, but conceptually it is much more scalable than a continuously growing toolbar.

---

# 21. Mobile Implications

The research also reinforces the importance of mobile capture.

magicplan demonstrates the value of capturing:

- geometry,
- photographs,
- notes,
- objects

while physically standing in the room.

Renovation Planner does not need LiDAR scanning initially.

A much smaller mobile capability already creates significant value:

```text
Open Kitchen
     ↓
Take photo
     ↓
Attach to wall
     ↓
Add note
     ↓
"Moisture damage here"
```

That information becomes spatially available on desktop later.

This is more strategically important than 3D rendering in an early product stage.

---

# 22. Competitive Gap

The consumer planning market is already mature at:

> “Design what my home should look like.”

The strongest opportunity for Renovation Planner is:

> **“Help me understand the property, decide what should change, and manage everything required to make that change happen.”**

That makes the editor something different.

Not:

**Floorplanner + project management**

but:

**a spatial renovation operating model.**

---

# 23. UX Principles

The following principles should become explicit editor design rules.

### RP-UX-01 — Homeowner vocabulary

Use:

> Room, Wall, Window, Work

not:

> Polygon, Geometry Node, Zone Entity.

---

### RP-UX-02 — Selection is home

The editor returns to selection after creation tasks.

---

### RP-UX-03 — Navigation is implicit

Pan and zoom should not usually require mode switching.

---

### RP-UX-04 — Direct manipulation first

Drag and resize visually.

---

### RP-UX-05 — Precision on demand

Every important geometric value can be entered numerically.

---

### RP-UX-06 — Multiple creation paths

Users can create a property:

- approximately,
- precisely,
- from a source drawing,
- eventually from scanning.

---

### RP-UX-07 — Context follows selection

The editor should reveal actions relevant to the selected entity.

---

### RP-UX-08 — Progressive disclosure

Do not expose advanced controls before they are useful.

---

### RP-UX-09 — Existing and planned are separate

Renovation inherently describes change over time.

---

### RP-UX-10 — Spatial entities own information

Rooms, walls and objects can own:

- photos,
- notes,
- requirements,
- work,
- costs,
- files.

---

### RP-UX-11 — Spatial model and project model are one model

The editor must never become an isolated drawing document.

---

### RP-UX-12 — Undo must be trustworthy

Every meaningful spatial operation should be reversible.

Your current editor already has a common undo/redo architecture, so this principle aligns well with the implementation. 

---

# 24. Recommended Target Shell

```text
┌──────────────────────────────────────────────────────────────────────┐
│ My House   › Ground Floor             Plan | Renovate | Review      │
│                                                   Undo  Redo   ⋯     │
├────────────────┬───────────────────────────────────┬─────────────────┤
│                │                                   │                 │
│ + ADD          │                                   │ KITCHEN         │
│                │                                   │ 17.8 m²         │
│ Room           │                                   │                 │
│ Wall           │                                   │ Overview        │
│ Door           │                                   │ Renovation      │
│ Window         │             CANVAS                │ Work            │
│ Object         │                                   │ Materials       │
│                │                                   │ Costs           │
│─────────────── │                                   │ Documents       │
│ PROPERTY       │                                   │ Photos          │
│                │                                   │ Notes           │
│ Garden         │                                   │                 │
│ Ground Floor   │                                   │                 │
│ First Floor    │                                   │                 │
│                │                                   │                 │
│─────────────── │                                   │                 │
│ LAYERS         │                                   │                 │
│ ✓ Existing     │                                   │                 │
│ ✓ Planned      │                                   │                 │
│ ✓ Blueprint    │                                   │                 │
│                │                                   │                 │
├────────────────┴───────────────────────────────────┴─────────────────┤
│ 100%        Grid ✓       Snap ✓       1:50                 Saved    │
└──────────────────────────────────────────────────────────────────────┘
```

Importantly, this is evolution rather than architectural replacement.

The existing editor already has nearly the same physical region structure. 

---

# 25. Recommended First-Version Scope

Do **not** attempt to implement the entire vision immediately.

## Editor UX V1

### Navigation

- Select default
- pan via temporary gesture
- zoom
- fit plan
- undo/redo

### Property structure

- floor navigation
- room
- wall
- door
- window

### Geometry

- room-first creation
- free-form room creation
- wall drawing
- dimension display
- numeric dimension editing
- snapping

### Reference plan

- upload
- scale
- lock
- opacity
- hide/show

### Inspector

- room properties
- wall properties
- contextual actions

### Renovation

- Existing / Planned status
- simple renovation description
- photos
- notes
- work items

This creates enough of the core mental model to test the product hypothesis.

---

# 26. Features Explicitly Deferred

Avoid pulling these into the first redesign:

- photorealistic rendering,
- large furniture catalog,
- full 3D modeling,
- LiDAR scanning,
- automatic floor-plan recognition,
- CAD import,
- complex constraint solving,
- BIM interoperability,
- contractor collaboration,
- automatic estimating.

These may become valuable later.

They are not required to establish the editor's unique value.

---

# 27. Highest-Priority UX Hypotheses to Validate

The next prototype should test these questions.

## H1

Can an inexperienced homeowner create their first room without instructions?

Success:

> Room created and approximately dimensioned within 60 seconds.

---

## H2

Does **Add Room** feel more natural than **Draw Zone**?

Expected result:

Strongly yes.

---

## H3

Can users understand that the plan describes both:

> current house

and:

> intended renovation?

This is more important than testing button placement.

---

## H4

Can users move naturally between:

```text
room
→ renovation
→ work
→ cost
```

without perceiving these as unrelated modules?

---

## H5

Does an imported floor plan feel like a useful reference layer rather than an image-editing feature?

---

## H6

Do users understand that selecting something on the canvas opens its project information?

---

# 28. Recommended Core User Flows

These should drive the next design phase.

### Flow 1 — Create first property representation

```text
Project
→ Add floor
→ choose starting method
→ create rooms
→ verify dimensions
→ name rooms
```

### Flow 2 — Import existing floor plan

```text
Add floor
→ Upload plan
→ Crop
→ Calibrate
→ Trace
→ Verify
```

### Flow 3 — Describe existing room

```text
Select Kitchen
→ Existing
→ add details
→ take/upload photos
→ add notes
```

### Flow 4 — Describe renovation intent

```text
Select Kitchen
→ Planned
→ describe desired changes
```

### Flow 5 — Turn intent into scope

```text
Kitchen
→ Renovation
→ Create work
→ assign trade
→ add material
→ estimate cost
```

### Flow 6 — Review renovation spatially

```text
Renovate mode
→ show demolition
→ show planned
→ inspect work/cost by room
```

---

# 29. Product Positioning Consequence

This research slightly changes how I would describe the editor itself.

I would avoid:

> **Floor Plan Editor**

as the strategic concept.

A better internal term is:

> **Spatial Renovation Planner**

or:

> **Renovation Workspace**

The floor plan is the substrate.

The product value is what connects to it.

---

# 30. Recommended Next Design Deliverables

The research is strong enough to move out of broad exploration.

The next sequence should be:

```text
01 Editor Mental Model
        ↓
02 Object Model
        ↓
03 Interaction Model
        ↓
04 Core User Flows
        ↓
05 Information Architecture
        ↓
06 Low-Fi Wireframes
        ↓
07 Clickable Prototype
        ↓
08 Usability Test
        ↓
09 Editor PRD
        ↓
10 Implementation Plan
```

The next document should therefore **not** be another broad research report.

It should be the:

# Renovation Editor Interaction & Mental Model Specification

That document should formally define:

- editor vocabulary,
- property hierarchy,
- spatial entities,
- existing/planned/work state model,
- selection model,
- creation model,
- navigation model,
- inspector behavior,
- layers,
- contextual actions,
- keyboard/mouse/touch interactions,
- empty states,
- onboarding,
- error prevention,
- undo semantics.

Once that model is settled, low-fidelity wireframes become much more valuable because we will be drawing a coherent interaction system rather than rearranging the existing toolbar.