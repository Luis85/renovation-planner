/**
 * The world coordinate convention (SDD §23, ADR-009), held as one documented fact rather
 * than a convention every consumer independently remembers:
 *
 *     1 world unit = 1 millimeter.
 *
 * Every `Point`, every persisted `Polygon` in domain geometry is expressed in this unit,
 * never in canvas pixels. This module performs no conversion and holds no measurement
 * vocabulary: pixel↔mm mapping happens only at the viewport boundary (`worldToScreen`/
 * `screenToWorld`, §24 — design slice 5), and the units a cost figure is priced in
 * (`UnitKind`, `MeasurementUnit`, `Quantity`) arrive with the cost engine (slice 9).
 *
 * The convention is enforced by construction rather than by the type checker: nothing
 * under `core/` divides by a pixel ratio, so no `Millimeters`-branded number is needed to
 * protect it.
 */

/**
 * The single fact this directory exists to state, exported so a test can assert it and a
 * reader can grep for it.
 */
export const WORLD_UNIT = 'millimeter';
