---
adr: 9
title: World Coordinates in Millimeters
status: Accepted
date: 2026-08-22
area: geometry
---

# ADR-009: World Coordinates in Millimeters

## Context

Spatial objects are rendered on a canvas whose pixel coordinates depend on screen resolution, zoom level, canvas size, and export format. If domain geometry were stored in canvas pixels, measurements (area, length, calibration) would be meaningless outside the exact viewport that produced them.

## Decision

Domain geometry uses real-world coordinates rather than canvas pixels, with a recommended base unit of 1 world unit = 1 millimeter. Conversion to and from canvas pixels happens only at the viewport boundary, through centralized `worldToScreen()` / `screenToWorld()` transforms (accounting for translation, zoom, rotation, and device pixel ratio). A plan's calibration (two known points and a known real-world distance) is what establishes the mapping between its background image and world coordinates.

## Consequences

- Area, length, and perimeter calculations, along with calibration and cost/requirement derivations, stay correct independent of screen resolution, zoom, canvas size, or export format.
- Editor tools and rendering code must not perform ad-hoc pixel math; all coordinate conversion goes through the centralized viewport transform.
- Persisted geometry (in Markdown-linked JSON sidecars, see ADR-002) is stored in world units, never canvas pixels — and Konva transform output (`scaleX`/`scaleY`) must be normalized into world-unit geometry before being persisted (see ADR-003).

## Alternatives

- Storing geometry directly in canvas pixels — rejected: breaks the moment zoom, screen resolution, or export format changes.
- A unitless, normalized 0..1 coordinate space — rejected: loses the direct real-world meaning (a wall is genuinely 5400 mm long) needed for calibration, measurement, and requirement calculations.

## Revisit when

A requirement for a different canonical unit emerges (for example, inches for a specific locale) — the conversion boundary already isolates this decision from rendering code, so it would be a localized change.
