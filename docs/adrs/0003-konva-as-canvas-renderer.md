# ADR-003: Konva as Canvas Renderer

## Status

Accepted

## Context

The Plan Editor needs a 2D canvas technology for rendering backgrounds, zones, construction sections, assets, and annotations, and for interactive selection, dragging, resizing, and rotation. This rendering layer must stay strictly an adapter: it renders and captures interaction, but the domain model (Zone, WorkPackage, Requirement, etc.) must never be represented as, or depend on, canvas-library objects.

## Decision

Konva, via its `vue-konva` bindings, is used as the 2D canvas rendering and interaction technology, organized as a layered stage (Background, Architecture, Zone, Construction, Asset, Annotation, Interaction layers).

## Consequences

- Konva provides mature primitives for shapes, layering, and an interactive Transformer for resize/rotate, plus a Vue-native binding.
- Konva nodes are rendering artifacts only: `Domain Spatial Object → Render Model → Vue Component → vue-konva → Konva Node`, and the inverse path for interaction (`Pointer Interaction → Editor Tool → Application Command → Domain Change`) always goes back through commands, never direct mutation.
- Konva objects must never be written directly to the Vault.
- The Transformer manipulates `scaleX`/`scaleY` rather than true width/height, so transform results must always be normalized into real domain geometry before being persisted (see ADR-009) — `scaleX`/`scaleY` are never persisted as a substitute for true dimensions.
- Because Konva is confined to the Presentation layer, it could in principle be replaced by a different canvas/rendering technology without touching Domain or Application code.
