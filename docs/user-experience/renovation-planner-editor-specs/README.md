# Renovation Planner — Editor Design Specification Set

**Status:** Locked visual direction, implementation-ready design documentation  
**Scope:** Desktop editor inside an Obsidian workspace leaf  
**Primary user:** Private homeowner with little or no CAD experience  
**Source:** Locked Product Design mockup suite created in September 2026

## Purpose

This specification set translates the locked editor mockups into implementable product-design contracts. It deliberately separates user-facing concepts from internal geometry concepts and keeps the spatial canvas and renovation project model aligned.

Each screen specification embeds its matching mockup from the adjacent `images/` directory. Keep the extracted folder structure intact so the relative Markdown image links continue to render in Obsidian, GitHub, and compatible Markdown viewers.

The editor is an Obsidian plugin view. It has no product logo, account menu, avatar, authentication surface, or standalone SaaS shell. It inherits Obsidian's theme, typography, density, workspace behavior, and semantic color variables.

## Core principles

1. Selection is the safe default state.
2. Pan and zoom are navigation gestures, not primary persistent tools.
3. Direct manipulation comes first; numeric precision is available on demand.
4. Room-first creation is the beginner path; wall drawing supports precise layouts.
5. Imported plans become visible, locked, calibrated reference layers.
6. Existing, Work, and Planned are distinct semantic concepts.
7. The canvas and project-management views project the same underlying entities.
8. User-facing language is Room, Wall, Area, Reference plan, and Work—not Zone, Polygon, Vertex, Scene, or Calibrate tool.
9. Complexity is progressively disclosed through selection and contextual Inspector drill-down.
10. Every essential entity and action must also be reachable without the canvas.

## Screen specifications

| ID | Screen | Primary purpose |
|---|---|---|
| M00 | [Kitchen selected overview](screens/M00-kitchen-selected-overview.md) | Establish the locked core editor and Inspector relationship |
| M01 | [Standard plan view](screens/M01-standard-plan-view.md) | Provide the safe no-selection home state |
| M02 | [Add menu](screens/M02-add-menu.md) | Offer one scalable entry point for creation |
| M03 | [Add room](screens/M03-add-room.md) | Support fast room-first creation |
| M04 | [Draw walls](screens/M04-draw-walls.md) | Support precise connected-wall creation |
| M05 | [New floor start](screens/M05-new-floor-start.md) | Help a homeowner start with incomplete information |
| M06 | [Reference plan setup](screens/M06-reference-plan-setup.md) | Prepare, scale, and lock an imported plan |
| M07 | [Wall selected](screens/M07-wall-selected.md) | Expose wall-specific renovation context |
| M08 | [Existing room details](screens/M08-existing-room-details.md) | Describe what is currently present |
| M09 | [Planned room details](screens/M09-planned-room-details.md) | Describe the intended outcome |
| M10 | [Room work](screens/M10-room-work.md) | Connect spatial changes to ordered work |
| M11 | [Multi-selection](screens/M11-multi-selection.md) | Apply shared actions to several entities safely |
| M12 | [Room materials](screens/M12-room-materials.md) | Derive and manage material requirements |
| M13 | [Room costs](screens/M13-room-costs.md) | Relate planned, committed, and actual costs to space/work |
| M14 | [Room evidence](screens/M14-room-evidence.md) | Keep documents, photos, and notes spatially contextual |
| M15 | [Stale-data warning](screens/M15-stale-data-warning.md) | Preserve valid content while explaining refresh failure |
| M16 | [Constrained workspace](screens/M16-constrained-workspace.md) | Degrade gracefully in a narrow Obsidian leaf |
| M17 | [Review perspective](screens/M17-review-perspective.md) | Review readiness and unresolved renovation information |

## Shared specifications

- [Component library](components/component-library.md)
- [Implementation plan](implementation/implementation-plan.md)

## Perspective model

| Perspective | User question | Editing level |
|---|---|---|
| Plan | What is the property and how is it arranged? | Geometry and reference-plan editing |
| Renovate | What exists, what should change, and what work follows? | Renovation information and contextual geometry changes |
| Review | Is the plan complete, coherent, and ready to act on? | Primarily read/review with navigation back to missing details |

## Theme contract

The mockups show both light and dark appearances, but they do not define a product color palette. Implementation must consume Obsidian semantic variables such as:

- `--background-primary`
- `--background-secondary`
- `--background-modifier-border`
- `--background-modifier-hover`
- `--text-normal`
- `--text-muted`
- `--interactive-accent`
- `--interactive-accent-hover`

Renovation states must additionally use line weight, dash patterns, markers, labels, and icons. Color alone is never sufficient.

## Specification usage

- Product and UX use the screen files as the interaction baseline.
- Engineering uses the component library as the shared UI decomposition.
- Requirements engineering can convert each use case and acceptance criterion into PBIs and tests.
- The implementation plan sequences delivery without requiring a complete domain expansion upfront.

## User journeys

The [standalone user journey catalogue](../user-journeys/README.md) extracts the editor flows with frontmatter, source references, and explicit concept status.
