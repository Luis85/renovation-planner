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

Domain geometry uses real-world coordinates rather than canvas pixels, with a mandatory canonical unit of 1 world unit = 1 millimeter — not merely a recommendation, since a per-project or per-plan choice of unit with no way to verify it would let a persisted file be silently misread. Every persisted geometry payload (each plan's JSON sidecar, per ADR-002/ADR-011) must include an explicit `"unit": "mm"` field alongside its coordinates, so a loader validates the assumption and fails closed — refusing to load, with a clear error — on any other value, rather than silently scaling lengths, areas, quantities, and costs as if they were millimeters. Conversion to and from canvas pixels happens only at the viewport boundary, through centralized `worldToScreen()` / `screenToWorld()` transforms (accounting for translation, zoom, rotation, and device pixel ratio). A plan's calibration (two known points and a known real-world distance) is what establishes the mapping between its background image and world coordinates.

## Consequences

- Area, length, and perimeter calculations, along with calibration and cost/requirement derivations, stay correct independent of screen resolution, zoom, canvas size, or export format.
- Editor tools and rendering code must not perform ad-hoc pixel math; all coordinate conversion goes through the centralized viewport transform.
- Persisted geometry (in the per-plan geometry sidecars of ADR-002 — JSON in content, `.rpgeo` on disk since [ADR-011](0011-configurable-geometry-sidecar-folder-and-file-extension.md) renamed the extension; this ADR's references to "JSON sidecars" mean the format, not the filename) is stored in world units, never canvas pixels — and Konva transform output (`scaleX`/`scaleY`) must be normalized into world-unit geometry before being persisted (see ADR-003).
- The received SDD's own Plan Sidecar Schema example (§40) has no unit field; this ADR refines that example by requiring one, the same way ADR-011 refines ADR-002's storage location — schema validation (see the SDD's Schema Validation, §43) must reject a sidecar missing or disagreeing with `"unit": "mm"` rather than accepting it.

## Alternatives

- Storing geometry directly in canvas pixels — rejected: breaks the moment zoom, screen resolution, or export format changes.
- A unitless, normalized 0..1 coordinate space — rejected: loses the direct real-world meaning (a wall is genuinely 5400 mm long) needed for calibration, measurement, and requirement calculations.

## Revisit when

A requirement for a different canonical unit emerges (for example, inches for a specific locale) — the conversion boundary already isolates this decision from rendering code, so it would be a localized change.
