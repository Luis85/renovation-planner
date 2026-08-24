/**
 * Konva Transformer result normalization (SDD §60).
 *
 * Transforms the scaleX/scaleY multipliers a Konva Transformer reports
 * into real world-millimetre geometry.
 *
 * ASSUMPTIONS (the slice's stated contract with callers):
 * - Dimensions scale by scaleX/scaleY multipliers; the output box anchors
 *   its **min corner** at (transform.x, transform.y).
 * - The rotation field is present because Konva's Transformer always reports
 *   it, but a BoundingBox is axis-aligned by contract — oriented extents are
 *   design slice 8's resize concern, not this function's. The rotation is
 *   intentionally ignored here.
 * - Resetting the Konva node's scaleX/scaleY to 1 after reading them is the
 *   **caller's** job in the `transformend` handler, not this pure function's.
 */
import type { BoundingBox } from '../../../core/geometry/BoundingBox';

export interface TransformerTransform {
	readonly x: number;
	readonly y: number;
	readonly rotation: number;
	readonly scaleX: number;
	readonly scaleY: number;
}

export function normalizeTransformerResult(
	transform: TransformerTransform,
	baseGeometry: BoundingBox,
): BoundingBox {
	const width = (baseGeometry.max.x - baseGeometry.min.x) * transform.scaleX;
	const height = (baseGeometry.max.y - baseGeometry.min.y) * transform.scaleY;
	return {
		min: { x: transform.x, y: transform.y },
		max: { x: transform.x + width, y: transform.y + height },
	};
}
