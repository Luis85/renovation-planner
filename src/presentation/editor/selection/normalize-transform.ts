/**
 * Konva Transformer result normalization (SDD §60).
 *
 * Transforms the scaleX/scaleY multipliers a Konva Transformer reports
 * into real world-millimetre geometry.
 *
 * ASSUMPTIONS (the slice's stated contract with callers):
 * - Dimensions scale by scaleX/scaleY multipliers, and the output box is
 *   **always ordered** — `min.x <= max.x` and `min.y <= max.y` on both axes,
 *   whatever sign the multipliers carry.
 * - A NEGATIVE scaleX/scaleY is an ordinary input, not a defensive arm:
 *   Konva's Transformer ships `flipEnabled: true`, so dragging a handle past
 *   the opposite edge reports a negative multiplier on that axis. Multiplied
 *   through naively that produces `max < min` — an inverted box, which
 *   `BoundingBox` has no invariant to refuse and `createPolygon` accepts as an
 *   inverted-winding polygon (winding normalization is explicitly future work),
 *   so slice 8 would persist a mirrored zone. This function absorbs the flip
 *   instead: the extents are taken absolutely and the corners ordered, so a
 *   flip of the same magnitude gives the same box the un-flipped drag would.
 * - `(transform.x, transform.y)` is therefore the box's anchor corner, not
 *   unconditionally its **min** corner: on a positive scale it is the min
 *   corner, and on a negative one the extent runs the other way and it becomes
 *   the max corner on that axis.
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
	// `Math.min`/`Math.max` rather than a sign test, so the ordering is one expression with
	// no arm that a negative scale reaches and a positive one does not — the flipped and
	// un-flipped cases run exactly the same code.
	const farX = transform.x + width;
	const farY = transform.y + height;
	return {
		min: { x: Math.min(transform.x, farX), y: Math.min(transform.y, farY) },
		max: { x: Math.max(transform.x, farX), y: Math.max(transform.y, farY) },
	};
}
