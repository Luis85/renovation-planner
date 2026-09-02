# Renovation Planner — Editor Interaction & Mental Model Specification

**Status:** Draft v1  
**Purpose:** Define the conceptual and interaction foundation of the Renovation Planner editor before wireframing and implementation.  
**Scope:** Desktop-first editor with mobile implications.  
**Primary user:** Private homeowner planning and managing a renovation without professional CAD expertise.

---

# 1. Product Intent

The Renovation Planner editor is not a CAD application and should not be designed as one.

Its purpose is to help a homeowner:

> **Understand their property, describe its current state, define intended changes, and connect those changes to work, cost, materials, documents, decisions and execution.**

The spatial model is therefore not an isolated drawing.

It is a navigational and planning surface over the renovation project.

The fundamental model is:

```text
PROPERTY
   ↓
SPACE
   ↓
CURRENT STATE
   ↓
CHANGE
   ↓
WORK
   ↓
PLANNED STATE
```

---

# 2. Core Mental Model

The editor should reflect how homeowners naturally reason about renovations.

A homeowner thinks:

```text
My House
 └ Ground Floor
    └ Kitchen
       ├ What is here now?
       ├ What do I want to change?
       ├ What needs to be done?
       ├ What do I need?
       ├ Who needs to do it?
       ├ What will it cost?
       └ What documents/photos belong here?
```

The editor should therefore reinforce four connected mental layers.

## 2.1 Property

The physical place being renovated.

Examples:

- property,
- house,
- garage,
- garden,
- terrace.

## 2.2 Space

A spatially identifiable part of the property.

Examples:

- floor,
- room,
- wall,
- terrace area,
- garden area.

## 2.3 State

What exists at a point in the renovation lifecycle.

Primary states:

- Existing
- Planned

## 2.4 Change

The transformation between Existing and Planned.

Change produces:

- work,
- material requirements,
- contractor needs,
- costs,
- decisions,
- documentation.

---

# 3. Primary UX Principle

> **The editor should expose homeowner concepts while hiding geometric implementation concepts.**

Internal domain objects may remain technical.

For example:

```text
Zone
Polygon
Vertex
Layer
Scene
```

should not necessarily appear in the UI.

User-facing concepts should be:

```text
Room
Area
Wall
Door
Window
Floor
Garden
Work Area
```

---

# 4. Property Hierarchy

The recommended conceptual hierarchy is:

```text
Project
└ Property
   ├ Site
   │  ├ Garden
   │  ├ Terrace
   │  ├ Driveway
   │  └ Other Areas
   │
   └ Building
      ├ Basement
      ├ Ground Floor
      ├ First Floor
      ├ Attic
      └ Roof
```

A project may eventually contain multiple buildings.

Example:

```text
Property
├ Main House
├ Garage
└ Garden Shed
```

This should be supported by the domain model eventually even if V1 only supports one building.

---

# 5. Spatial Entity Model

## 5.1 Room

Primary spatial unit inside a building.

Properties may include:

- name,
- room type,
- area,
- ceiling height,
- floor,
- geometry,
- photos,
- notes,
- requirements,
- renovation scope.

Examples:

- Kitchen
- Living Room
- Bathroom
- Bedroom
- Hall
- Utility Room

---

## 5.2 Wall

Structural boundary.

Properties may include:

- length,
- thickness,
- height,
- structural type,
- state,
- finish,
- openings,
- notes,
- photos.

A wall may belong to one or more rooms.

---

## 5.3 Door

Opening hosted by a wall.

Properties:

- width,
- height,
- opening direction,
- type,
- current/planned state.

---

## 5.4 Window

Opening hosted by a wall.

Properties:

- width,
- height,
- sill height,
- type,
- current/planned state.

---

## 5.5 Area

Flexible planar region.

Used where "Room" would be unnatural.

Examples:

- terrace,
- lawn,
- driveway,
- roof area,
- demolition area,
- tile area.

---

## 5.6 Object

Generic placeable entity.

Examples:

- radiator,
- bathtub,
- sink,
- boiler,
- cabinet,
- tree,
- electrical outlet.

Objects may later specialize into richer types.

---

# 6. Renovation State Model

The editor should distinguish three concepts.

## Existing

Represents the current property.

Example:

```text
Kitchen floor:
Ceramic tiles
```

## Planned

Represents the intended result.

Example:

```text
Kitchen floor:
Oak flooring
```

## Work

Represents the transformation.

Example:

```text
Remove tiles
Prepare subfloor
Install underfloor heating
Install oak flooring
```

This produces the core relationship:

```text
EXISTING
    ↓
CHANGE
    ↓
WORK
    ↓
PLANNED
```

---

# 7. State Is Not a Layer Only

Existing and Planned must not be implemented purely as visibility layers.

They represent different semantic states of the same property.

Example:

```text
Wall A

Existing:
brick wall

Planned:
removed
```

Another wall:

```text
Wall B

Existing:
does not exist

Planned:
new partition wall
```

The system must therefore support:

- unchanged,
- removed,
- modified,
- added.

Recommended conceptual change states:

```text
UNCHANGED
REMOVE
MODIFY
ADD
```

---

# 8. Visual Change Language

The canvas should communicate these states without requiring the inspector.

Candidate visual semantics:

```text
Existing / unchanged
────────────

Removed
- - - - - -

New
━━━━━━━━━━━━

Modified
────────────
with change indicator
```

The exact visual styling should be tested later.

The principle is:

> The renovation intent must be readable spatially.

---

# 9. Default Editor State

The editor should always have a safe "home" state.

That state is:

# Select

The user should not normally need to explicitly enter navigation mode.

Default interactions:

```text
Click object
→ select

Click empty canvas
→ deselect

Drag selected object
→ move

Drag handle
→ resize

Mouse wheel / pinch
→ zoom

Space + drag
→ pan

Middle mouse drag
→ pan

Esc
→ cancel current action / return to Select

Delete / Backspace
→ delete selected editable object

Ctrl/Cmd + Z
→ undo

Ctrl/Cmd + Shift + Z
→ redo
```

---

# 10. Tool Lifecycle

Creation tools should be temporary.

Example:

```text
Select
  ↓
Add Room
  ↓
Create room
  ↓
Select
```

The editor should return to Select after a single creation by default.

For repeated creation:

```text
double-click Add Room
or
explicit "Keep tool active"
```

could be considered later.

This minimizes accidental editing.

---

# 11. Navigation Model

Navigation should feel like modern graphical software.

## Desktop

Primary:

- wheel zoom,
- trackpad zoom/pan,
- Space + drag,
- middle mouse drag.

Optional visible controls:

```text
−   100%   +
Fit
```

Explicit Pan may remain accessible but should not occupy primary toolbar space.

---

# 12. Zoom Behavior

Zoom should be cursor-centered where possible.

If the user points to the kitchen and zooms:

```text
cursor location
       ↓

      kitchen
```

the kitchen should remain under the pointer.

Recommended commands:

```text
Fit Project
Fit Floor
Fit Selection
100%
Zoom In
Zoom Out
```

---

# 13. Selection Model

Selection is the central interaction primitive.

## No selection

Inspector shows useful contextual information or onboarding.

Example:

```text
Ground Floor

5 rooms
83.4 m²

Select something to view details.
```

## Single selection

Inspector shows the selected object's details.

## Multi-selection

Inspector shows shared actions and aggregated information.

Example:

```text
3 walls selected

Total length: 11.4 m

[ Mark for removal ]
[ Change state ]
[ Delete ]
```

---

# 14. Selection Priority

When spatial entities overlap, the editor should apply predictable priority.

Candidate priority:

```text
handle
↓
object
↓
opening
↓
wall
↓
room
↓
background
```

Repeated clicking may cycle through overlapping objects.

Alternative:

```text
Alt + click
```

cycles candidates.

This needs prototype testing.

---

# 15. Hover Feedback

Hover should preview what will be selected.

Example:

```text
hover room
→ subtle room highlight

hover wall
→ wall highlight

hover handle
→ resize cursor
```

This reduces selection uncertainty.

---

# 16. Add Model

The editor should use a single high-level entry point:

# + Add

rather than permanently exposing every tool.

Candidate menu:

```text
+ Add

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
Measurement
Note
```

Search may be added when the catalog grows.

---

# 17. Room Creation

Room creation should prioritize ease.

## Method 1 — Rectangular Room

Flow:

```text
Add
→ Room
→ Rectangle
→ drag
→ room created
→ set type/name
```

During drag:

```text
     4.20 m
┌─────────────┐
│             │
│             │ 3.80 m
│             │
└─────────────┘
```

---

## Method 2 — Free Shape

Flow:

```text
Add
→ Room
→ Free shape
→ click corners
→ close
```

Closing should occur by:

- clicking start point,
- double-clicking final point,
- Enter where appropriate.

Escape cancels.

---

# 18. Wall Creation

Advanced users should be able to draw walls directly.

Flow:

```text
Add Wall
→ click start
→ move pointer
→ dimension preview
→ click next point
→ continue
→ Enter/Esc
```

Candidate behavior:

```text
closed wall loop detected
→ offer room creation
```

Eventually automatic room detection may replace explicit confirmation.

---

# 19. Dimension Interaction

Dimensions should appear contextually.

### While drawing

Always show relevant length.

### While selected

Show dimensions for the selected spatial object.

### At rest

Avoid excessive measurement clutter.

---

# 20. Numeric Precision

Any important dimension should support direct numeric editing.

Example:

```text
4.23 m
```

Click label:

```text
[ 4.23 ] m
```

Enter:

```text
4.50
```

Geometry updates immediately after commit.

This supports:

> rough first, precise later.

---

# 21. Units

Units must be consistent at project level.

Potential options:

```text
Metric
Imperial
```

Metric display could support:

```text
mm
cm
m
m²
```

The editor should avoid mixing units without reason.

---

# 22. Snapping

Snapping should be automatic but visible.

Potential snap targets:

- grid,
- wall endpoints,
- wall midpoint,
- room corners,
- alignment with existing geometry,
- perpendicular,
- parallel.

Visual feedback:

```text
● endpoint
┄ alignment guide
90°
```

Users need to understand *why* the pointer snapped.

---

# 23. Snap Controls

Status bar:

```text
Grid ✓
Snap ✓
```

Advanced settings may expose:

```text
Snap to grid
Snap to geometry
Snap to angle
Snap distance
```

but should not clutter the main interface.

---

# 24. Doors and Windows

Doors and windows should be inserted into walls rather than positioned as independent free-floating objects.

Flow:

```text
Add Door
→ hover wall
→ preview opening
→ click
```

Then:

```text
drag along wall
→ reposition
```

Inspector:

```text
Door

Width        90 cm
Height       201 cm
Direction    Left inward
State        Existing
```

---

# 25. Reference Plan Mental Model

An uploaded floor plan should be understood as:

> **Reference material**

not as editable project geometry.

It should live in a dedicated reference layer.

---

# 26. Reference Plan Setup

Flow:

```text
Add reference plan
        ↓
Upload
        ↓
Crop
        ↓
Rotate
        ↓
Calibrate
        ↓
Confirm
```

Calibration:

```text
1. click first known point
2. click second known point
3. enter real distance
4. system derives scale
```

---

# 27. Reference Plan Controls

Inspector/layer controls:

```text
Reference Plan

Visible       ✓
Locked        ✓
Opacity       45%
Scale         calibrated

[ Recalibrate ]
[ Replace ]
[ Remove ]
```

The reference should default to locked after calibration.

---

# 28. Main Editor Perspectives

Instead of increasing tool count indefinitely, the editor should eventually expose workflow perspectives.

Recommended candidate:

```text
PLAN | RENOVATE | REVIEW
```

---

# 29. Plan Perspective

Question answered:

> What does the property look like?

Primary information:

- rooms,
- walls,
- openings,
- areas,
- dimensions,
- reference plans.

Primary actions:

```text
Add room
Add wall
Add door
Add window
Measure
```

---

# 30. Renovate Perspective

Question answered:

> What changes?

Primary information:

- existing,
- demolition,
- modifications,
- new elements,
- requirements,
- materials,
- work.

Primary actions:

```text
Mark for removal
Define planned state
Create work
Add material
Add requirement
```

---

# 31. Review Perspective

Question answered:

> What does the renovation imply?

Potential overlays:

- estimated cost,
- work items,
- trade,
- phase,
- status,
- risks.

Example:

```text
Kitchen       €9,800
Bathroom      €7,200
Living Room   €4,500
```

Review should be largely read-oriented rather than geometry-editing-oriented.

---

# 32. Mode Persistence

Perspective and tool state are different.

Example:

```text
Perspective: Renovate
Tool: Select
```

or:

```text
Perspective: Plan
Tool: Add Wall
```

Changing perspective should return to Select.

This avoids a hidden creation tool remaining active after a major context switch.

---

# 33. Inspector Model

The Inspector is the bridge between spatial geometry and project information.

It should be:

- selection-driven,
- context-sensitive,
- progressively disclosed.

---

# 34. Room Inspector

Candidate structure:

```text
Kitchen
17.8 m²

Overview
Existing
Planned
Work
Materials
Costs
Documents
Photos
Notes
```

This can be tabs or collapsible sections depending on available width.

---

# 35. Room Overview

```text
Name
Kitchen

Type
Kitchen

Floor
Ground Floor

Area
17.8 m²

Ceiling height
2.52 m
```

Derived values should be visually distinguished from editable ones.

Example:

```text
Area
17.8 m²
Calculated
```

---

# 36. Existing State Inspector

Example:

```text
Existing

Floor
Ceramic tile

Walls
Wallpaper

Ceiling
Paint

Heating
Radiator

Windows
2

Condition
Needs renovation
```

Photos should be easily attachable here.

---

# 37. Planned State Inspector

```text
Planned

Floor
Oak flooring

Walls
Painted plaster

Heating
Underfloor heating
```

Where possible, the system should identify differences from Existing.

---

# 38. Change Summary

From the comparison:

```text
Changes

Floor
Tile → Oak

Walls
Wallpaper → Painted plaster

Heating
Radiator → Underfloor heating
```

This derived representation could become extremely valuable.

---

# 39. Work Inspector

```text
Work

8 items

□ Remove tiles
□ Remove radiator
□ Electrical rough-in
□ Level floor
□ Install heating
□ Install flooring
□ Repair walls
□ Paint walls
```

Work may later be grouped by:

- phase,
- trade,
- contractor,
- status.

---

# 40. Materials Inspector

```text
Materials

Oak flooring
19.6 m²

Floor underlay
19.6 m²

Wall paint
42 m²
```

Quantities may be:

- calculated,
- overridden,
- manually entered.

The source should be visible.

Example:

```text
19.6 m²
Calculated from room area + 10% waste
```

---

# 41. Cost Inspector

```text
Costs

Estimate        €9,800
Quotes          €8,650
Committed       €3,200
Actual          €1,400
```

Cost belongs to spatial scope but should remain linked to the central budget model.

---

# 42. Documents

Documents should be attachable to spatial entities.

Example:

```text
Documents

Kitchen offer.pdf
Electrical layout.pdf
Flooring quote.pdf
```

The document is not duplicated.

It is linked.

---

# 43. Photos

Photos should support:

```text
Room photo
Wall photo
Object photo
Issue photo
```

On mobile:

```text
Take Photo
```

should be a primary action.

---

# 44. Notes

Quick notes should be cheap to create.

Example:

```text
+ Note

"Check whether this wall is load-bearing."
```

No complex form should be required.

---

# 45. Contextual Canvas Actions

Common actions may appear close to selected objects.

Example for wall:

```text
[ + Door ] [ + Window ] [ Remove ]
```

Example for room:

```text
[ Renovate ] [ Add note ]
```

These should supplement—not replace—the inspector.

---

# 46. Empty Canvas State

An empty plan should teach rather than merely state that no data exists.

Candidate:

```text
Create your floor plan

Start by adding your first room,
or use an existing floor plan as reference.

[ Add Room ]

Upload floor plan
```

This is much better than requiring users to discover the toolbar.

---

# 47. First-Use Onboarding

Avoid a long tutorial.

Use contextual onboarding.

Example after opening first empty plan:

```text
Step 1
Add your first room.
```

After creation:

```text
Great. Now set the room's real dimensions.
```

Then:

```text
Name the room.
```

The user should build something useful while learning.

---

# 48. Tool Guidance

When a temporary tool is active, show one short instruction.

Example:

```text
Draw room
Click to add corners • Click start point to finish • Esc to cancel
```

Avoid modal tutorials.

---

# 49. Undo Semantics

Undo must be global and predictable.

Each user-intent operation should normally create one history entry.

Example:

```text
Resize room from 4.2 m to 4.5 m
```

should undo in one step.

Not:

```text
move vertex 1
move vertex 2
update dimension
update area
```

Those are implementation details.

---

# 50. Transactional Editing

Continuous interaction should commit when interaction ends.

Example:

```text
pointer down
drag
drag
drag
pointer up
```

= one user action.

Undo returns to the state before the drag.

---

# 51. Destructive Actions

Deleting high-value objects should behave according to consequence.

Deleting an unused chair:

```text
Delete immediately
Undo available
```

Deleting a room containing:

- work,
- photos,
- documents,
- costs,

should require confirmation.

Example:

```text
Delete Kitchen?

This room contains:
8 work items
4 photos
2 documents

[ Cancel ]
[ Delete Room ]
```

---

# 52. Error Prevention

Prefer prevention over validation.

Examples:

A door cannot be placed without a valid host wall.

A room cannot be completed with invalid self-intersecting geometry.

A zero-length wall cannot be created.

An invalid operation should show immediate spatial feedback.

---

# 53. Status Feedback

The editor should quietly communicate state.

Candidate status bar:

```text
100%  Grid ✓  Snap ✓  1:50             Saved
```

Other states:

```text
Saving…
Offline
Unsaved changes
Reference unavailable
Some items could not be loaded
```

The existing editor already contains a foundation for persistent status/failure feedback, which should be retained.

---

# 54. Layers Mental Model

Layers should be user-meaningful.

Recommended grouping:

```text
STRUCTURE
✓ Rooms
✓ Walls
✓ Doors & Windows

RENOVATION
✓ Existing
✓ Demolition
✓ Planned

INFORMATION
✓ Measurements
✓ Work
✓ Notes
✓ Costs

REFERENCE
✓ Floor plan
```

---

# 55. Layers Are Visibility, Not Ownership

Turning off:

```text
Work
```

must not remove work items.

It only hides their visualization.

This distinction must remain clear.

---

# 56. Locking

Users should be able to lock:

- reference layer,
- finished geometry,
- selected object groups.

Locked elements:

- remain visible,
- cannot be accidentally manipulated.

---

# 57. Property Navigation

The left side of the editor should eventually combine property hierarchy and layer controls.

Candidate:

```text
PROPERTY

Site
Garden

HOUSE

Ground Floor
First Floor
Basement

────────────

LAYERS

Structure
Renovation
Information
Reference
```

---

# 58. Changing Floors

Selecting a floor:

```text
Ground Floor
→ First Floor
```

should preserve useful viewport state per floor where practical.

The selected object should clear unless it exists in the target context.

---

# 59. Cross-Floor Context

Eventually the user may need:

```text
show floor below
```

for alignment.

Example:

```text
First Floor

Reference
✓ Ground Floor outline
```

This is valuable for wall alignment and vertical systems.

Deferred from V1.

---

# 60. Garden and Exterior Areas

The editor should not hard-code indoor assumptions.

The same interaction philosophy can apply to:

```text
Garden

Lawn
Terrace
Path
Fence
Tree
Shed
Pond
```

This is why a generalized internal Zone concept remains useful even if the user-facing terminology becomes specific.

---

# 61. Mobile Interaction Model

Mobile should not attempt to duplicate the full desktop editor.

Primary mobile jobs should be:

```text
View room
Take photo
Add note
Capture measurement
Add issue
Check work
Update status
```

Full geometry editing can remain desktop/tablet focused initially.

---

# 62. Touch Interaction

For tablet support:

```text
tap
→ select

drag
→ move selected element

two-finger drag
→ pan

pinch
→ zoom

long press
→ context menu
```

Handles must have touch-sized hit targets.

---

# 63. Keyboard Accessibility

Every toolbar command should have a keyboard-accessible equivalent.

Focus state must remain visible.

Toolbar tools should communicate:

- current state,
- shortcut,
- disabled state.

Example tooltip:

```text
Add Wall
W
```

Shortcuts should not override important Obsidian commands without care.

---

# 64. Recommended Shortcut Model

Candidate, subject to host conflicts:

```text
V     Select
R     Room
W     Wall
D     Door
Esc   Cancel / Select

Delete
Delete selection

Ctrl/Cmd+Z
Undo

Ctrl/Cmd+Shift+Z
Redo

Space
Temporary pan
```

Shortcuts are secondary affordances, not required knowledge.

---

# 65. Context Menus

Right-click should offer object-specific commands.

Example Room:

```text
Rename
Duplicate
Add Note
Create Work
Mark Renovated
Hide
Delete
```

Example Wall:

```text
Add Door
Add Window
Mark for Removal
Duplicate
Delete
```

Do not duplicate every inspector capability here.

---

# 66. Search / Command Access

Later, advanced users may benefit from command search.

Example:

```text
⌘K

Add room
Show costs
Fit floor
Upload reference plan
Create work item
```

This should be deferred until command breadth justifies it.

---

# 67. Save Model

The user should not manually think about saving.

Preferred model:

> autosave

Status communicates:

```text
Saving…
Saved
Save failed
```

Closing the editor should not silently lose committed work.

---

# 68. Draft Geometry

Incomplete drawing is temporary UI state.

Example:

```text
Room with 3 unfinished points
```

should not be persisted as a valid domain room unless deliberately supported.

Escape cancels the draft.

---

# 69. Naming

New rooms may initially receive automatic names:

```text
Room 1
Room 2
```

but the UI should encourage semantic naming/type selection.

Example:

```text
What room is this?

Kitchen
Living Room
Bedroom
Bathroom
Other
```

Selecting a type can populate a sensible name.

---

# 70. Derived Information

Where possible, the editor should calculate values rather than ask users to enter them.

Examples:

```text
Area
Perimeter
Wall surface
Floor surface
```

Users may override values where real-world conditions differ.

Overrides must be explicit.

Example:

```text
Floor area
17.8 m² calculated

Material quantity
19.5 m² overridden
```

---

# 71. Spatial Attachments

Information can be attached at different granularities.

```text
Project
Floor
Room
Wall
Object
Point
```

Examples:

```text
Project
building permit

Room
kitchen quote

Wall
moisture photo

Object
boiler manual
```

This should be a long-term architectural capability.

---

# 72. Pins / Markers

For point-specific information, use markers.

Example:

```text
Kitchen wall

      ⚠
─────────────
```

Click marker:

```text
Moisture damage

Photo
Note
Created 12 Aug
```

This is particularly useful during renovation execution.

---

# 73. Work Visualization

Work should be visualizable without overwhelming the plan.

Candidate overlay:

```text
Kitchen
8 work items
€9.8k
```

or badges:

```text
Kitchen   8
```

Click opens work details.

---

# 74. Cost Visualization

Review mode could support spatial heatmapping later.

Example:

```text
Kitchen       €9.8k
Bathroom      €12.4k
Hall          €2.1k
```

This should remain secondary to clear textual numbers.

---

# 75. Trade Visualization

Possible future overlay:

```text
Electrical
Plumbing
Painting
Flooring
```

Selecting:

```text
Electrical
```

highlights affected spaces.

This could become extremely useful for contractor discussions.

---

# 76. Phase Visualization

Similarly:

```text
Demolition
Rough-in
Construction
Finish
```

The canvas becomes a project communication view.

---

# 77. Editor Information Architecture

Recommended desktop structure:

```text
┌──────────────────────────────────────────────────────────────┐
│ Project › Building › Ground Floor    Plan Renovate Review   │
│                                            Undo Redo ⋯      │
├──────────────┬─────────────────────────────┬─────────────────┤
│ PROPERTY     │                             │ INSPECTOR       │
│              │                             │                 │
│ Site         │                             │ Selected object │
│ Ground Floor │          CANVAS             │ details         │
│ First Floor  │                             │                 │
│              │                             │                 │
│ LAYERS       │                             │                 │
│              │                             │                 │
├──────────────┴─────────────────────────────┴─────────────────┤
│ + Add            100%   Grid ✓ Snap ✓             Saved    │
└──────────────────────────────────────────────────────────────┘
```

The exact toolbar location can change during wireframing.

The conceptual regions are more important than pixel placement.

---

# 78. Primary Action Hierarchy

Tier 1 actions:

```text
Select
Add
Undo
Redo
```

Tier 2:

```text
Zoom
Fit
Layers
Inspector
```

Tier 3 contextual actions:

```text
Resize
Change type
Mark for removal
Add work
Attach photo
```

Tier 4 advanced:

```text
Snap configuration
Grid settings
Calibration
Bulk editing
```

This hierarchy should drive visual emphasis.

---

# 79. What Should Leave the Primary Toolbar

From the current implementation, the following should probably no longer appear as equal primary tools:

```text
Pan
Calibrate
Draw Polygon
```

They map better to:

```text
Pan
→ gesture/navigation behavior

Calibrate
→ reference-plan workflow

Draw Polygon
→ Room / Area creation behavior
```

The underlying technical capabilities can remain unchanged.

---

# 80. What Should Become More Prominent

The primary editor should emphasize:

```text
+ Add
Current floor
Plan / Renovate / Review
Selected entity
Undo / Redo
```

These represent user intent rather than implementation mechanism.

---

# 81. Design Invariants

The following should be treated as non-negotiable design rules.

### INV-01

The user always knows what is selected.

### INV-02

The user always knows whether a creation tool is active.

### INV-03

Esc always leads toward a safe state.

### INV-04

Every meaningful edit is undoable where technically possible.

### INV-05

Geometry manipulation provides immediate visual feedback.

### INV-06

Destructive actions communicate consequences.

### INV-07

The editor never exposes persisted technical terminology unnecessarily.

### INV-08

Existing and Planned never become ambiguous.

### INV-09

Project information attached spatially remains accessible outside the editor.

### INV-10

The editor does not become a second independent project-data system.

---

# 82. V1 Interaction Scope

The first coherent redesign should implement:

## Editor shell

- property/floor navigation,
- canvas,
- contextual inspector,
- layer controls,
- status bar.

## Navigation

- Select default,
- pan gestures,
- zoom,
- fit floor,
- undo/redo.

## Creation

- rectangular room,
- free-form room,
- wall,
- door,
- window.

## Editing

- select,
- move,
- resize,
- numeric dimension editing,
- delete,
- snapping.

## Reference

- upload plan,
- calibration,
- opacity,
- lock,
- hide/show.

## Renovation

- Existing/Planned distinction,
- mark removed/new,
- simple work items,
- notes,
- photos.

---

# 83. Deferred Interaction Scope

Explicitly defer:

- full 3D editing,
- photorealistic visualization,
- BIM-level wall modeling,
- parametric constraint systems,
- CAD import,
- LiDAR scanning,
- automatic floor-plan recognition,
- multiplayer editing,
- contractor permissions,
- complex work scheduling on canvas,
- automated estimating.

---

# 84. Core Prototype Scenarios

The first clickable prototype should support six tasks.

## Scenario 1 — First room

> Create a rectangular kitchen approximately 4 × 5 metres and correct one dimension precisely.

Tests:

- Add discoverability
- room creation
- dimensional editing
- naming

---

## Scenario 2 — Blueprint tracing

> Upload an existing floor plan, calibrate it using a known 4 m wall and create a room over it.

Tests:

- reference mental model
- calibration
- layer locking
- tracing

---

## Scenario 3 — Select and inspect

> Find the kitchen, see its size, and change its name.

Tests:

- selection
- inspector
- object identity

---

## Scenario 4 — Renovation intent

> Mark an existing wall for removal and add a planned replacement wall.

Tests:

- Existing/Planned comprehension
- change-state semantics

---

## Scenario 5 — Work

> Add “remove old tiles” to the kitchen renovation.

Tests:

- spatial/project connection
- inspector hierarchy

---

## Scenario 6 — Documentation

> Attach a photograph showing wall damage to the kitchen.

Tests:

- spatial attachment model
- discoverability

---

# 85. Usability Success Criteria

Suggested initial targets.

### First room

At least 80% of test users complete it without instruction.

### Precision editing

At least 80% discover or understand direct dimension editing.

### Selection

Users identify the selected object state immediately.

### Existing vs Planned

At least 80% correctly explain the distinction after using it once.

### Blueprint workflow

Users understand that the source plan is a reference and not the project geometry.

### Work linkage

Users correctly understand that room-specific work remains part of the overall project.

---

# 86. Key Open Design Questions

These need prototype evidence.

1. Should the left panel combine property navigation and layers or use separate views?
2. Should Plan / Renovate / Review be tabs, segmented controls or navigation modes?
3. Should Room creation start with rectangle immediately or open a shape chooser?
4. Should enclosed walls automatically create rooms?
5. Should the Inspector use tabs or vertically stacked sections?
6. How visible should dimensions remain when nothing is selected?
7. Should Existing/Planned be a property of entities, a project state comparison, or both?
8. How should modified geometry visually differ from new geometry?
9. How much renovation information belongs directly inside the editor before it feels overloaded?
10. What parts of the editor remain usable inside Obsidian's narrower panes?

---

# 87. Architecture Consequences

The UX direction implies several architectural expectations.

The domain should increasingly separate:

```text
geometry
```

from:

```text
semantic spatial entity
```

and:

```text
renovation state
```

For example:

```text
Room
├ geometry
├ currentState
├ plannedState
├ workReferences
├ documentReferences
├ photoReferences
└ noteReferences
```

This does not mean all fields belong in one aggregate.

It means the application should expose this conceptual relation coherently.

---

# 88. Current Implementation Mapping

The current editor structure provides a useful foundation.

Existing concepts such as:

- tool runtime,
- selection state,
- snapping,
- viewport management,
- layers,
- inspector wiring,
- scene representation,
- undo/redo,

can largely remain underneath the new UX.

The main refactoring direction should be:

```text
CURRENT

tool-driven UI
     ↓

TARGET

intent-driven UI
```

Example:

```text
draw-polygon
```

does not need to disappear internally.

It becomes the implementation behind:

```text
Add Room
```

or:

```text
Add Area
```

depending on context.

---

# 89. Proposed UX Architecture

```text
USER INTENT
    │
    ├ Add Room
    ├ Remove Wall
    ├ Describe Planned State
    ├ Add Work
    └ Attach Photo
    │
    ▼
INTERACTION MODEL
    │
    ├ selection
    ├ tools
    ├ inspector
    ├ contextual commands
    └ workflow perspective
    │
    ▼
APPLICATION COMMANDS
    │
    ▼
DOMAIN MODEL
    │
    ▼
PERSISTENCE
```

The UX should not directly expose lower layers unless useful.

---

# 90. Recommended Next Step

This specification is detailed enough to move into visual design.

The next deliverable should be:

# Editor Low-Fidelity Wireframe Specification

It should define the actual screens and states for:

1. Empty Editor
2. Standard Plan View
3. Add Room
4. Room Selected
5. Wall Selected
6. Blueprint Setup
7. Renovate View
8. Work Inspector
9. Multi-selection
10. Error / invalid geometry states
11. Narrow Obsidian pane
12. Tablet layout

The wireframes should deliberately remain low-fidelity.

The goal is to validate:

> **interaction structure and information hierarchy**

before spending effort on visual styling.