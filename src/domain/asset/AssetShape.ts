import type { Point } from '../../core/geometry/Point';
import type { Polygon } from '../../core/geometry/Polygon';
import { createPolygon } from '../../core/geometry/Polygon';
import { boundingBoxOf } from '../../core/geometry/operations';
import type { GeometryError, ValidationError } from '../../core/errors/AppError';
import { err, isErr, ok, type Result } from '../../core/result/Result';
import { assetError } from './Asset.errors';

const TAU = Math.PI * 2;

export type FootprintOrigin = 'typed' | 'traced';

export interface AssetShape {
	readonly footprint: Polygon;
	readonly footprintOrigin: FootprintOrigin;
	/**
	 * One flag per coordinate group that can be captured on its own, each set at THAT
	 * attribute's capture on an uncalibrated surface and cleared by the calibration that
	 * converts it. Typed geometry is never pending, which is why no rule has to name it.
	 */
	readonly footprintPending: boolean;
	readonly clearancePending: boolean;
	readonly anchorPending: boolean;
	readonly clearance: Polygon | null;
	readonly anchor: Point;
	/** Radians, measured anticlockwise from +x, normalised to [0, 2π). */
	readonly facing: number;
}

export interface Dimensions {
	readonly width: number;
	readonly depth: number;
}

/**
 * A typed width and depth become a rectangle CENTRED ON THE ORIGIN, which is what makes
 * the default anchor `{ x: 0, y: 0 }` mean the middle of the object rather than a corner
 * nobody chose. Millimetres (ADR-009), like every world coordinate here.
 *
 * The finiteness half of the guard is not redundant with `createPolygon`'s own: it runs
 * BEFORE the polygon is built, so a NaN dimension is refused as a dimension rather than
 * reported as four bad vertices. That ordering is what leaves `createPolygon` unable to
 * fail here at all — every point below is finite by the time it is handed over — so its
 * `Result` is unwrapped with an explicit refusal rather than trusted silently, and the
 * refusal is a `Result` this function cannot demonstrate reaching.
 */
export function footprintFromDimensions(
	width: number,
	depth: number,
): Result<Polygon, ValidationError> {
	for (const value of [width, depth]) {
		if (!Number.isFinite(value) || value <= 0) {
			return err(
				assetError(
					'non-positive-dimension',
					`A dimension must be a positive, finite number of millimetres; got ${String(value)}.`,
				),
			);
		}
	}
	const halfWidth = width / 2;
	const halfDepth = depth / 2;
	const polygon = createPolygon([
		{ x: -halfWidth, y: -halfDepth },
		{ x: halfWidth, y: -halfDepth },
		{ x: halfWidth, y: halfDepth },
		{ x: -halfWidth, y: halfDepth },
	]);
	if (isErr(polygon)) {
		return err(assetError('invalid-footprint', polygon.error.message));
	}
	return ok(polygon.value);
}

/**
 * Dimensions are DERIVED (§88) — the bounding box of the footprint, never a stored pair.
 * A traced outline and a typed rectangle answer through one function for that reason.
 */
export function dimensionsOf(footprint: Polygon): Result<Dimensions, GeometryError> {
	const box = boundingBoxOf(footprint);
	if (isErr(box)) return box;
	return ok({
		width: box.value.max.x - box.value.min.x,
		depth: box.value.max.y - box.value.min.y,
	});
}

/** One spelling per direction: `[0, 2π)`, so a stored 2π and a stored 0 cannot differ. */
export function normaliseFacing(radians: number): number {
	if (!Number.isFinite(radians)) return 0;
	const folded = radians % TAU;
	return folded < 0 ? folded + TAU : folded;
}

/**
 * The shape's own smart constructor: both polygons must be valid, the anchor's
 * coordinates finite, and the facing finite — and it NORMALISES the facing on the way
 * through, so a shape that has been through this function has one spelling per direction
 * and no caller has to remember to fold it.
 *
 * It also refuses the two states the per-attribute pending model makes incoherent: a
 * typed footprint marked pending, and a pending flag on an absent clearance. Both are
 * REFUSALS rather than repairs, for the same reason a two-vertex polygon is refused — no
 * command can produce either, so one in a sidecar is a hand edit, and quietly clearing
 * the flag would suppress the unscaled warning over placeholder-space geometry.
 */
export function validateAssetShape(shape: AssetShape): Result<AssetShape, ValidationError> {
	const footprint = createPolygon(shape.footprint.points);
	if (isErr(footprint)) return err(assetError('invalid-footprint', footprint.error.message));
	if (shape.clearance !== null) {
		const clearance = createPolygon(shape.clearance.points);
		if (isErr(clearance)) return err(assetError('invalid-clearance', clearance.error.message));
	}
	if (!Number.isFinite(shape.anchor.x) || !Number.isFinite(shape.anchor.y)) {
		return err(assetError('invalid-anchor', 'An anchor must have finite coordinates.'));
	}
	if (!Number.isFinite(shape.facing)) {
		return err(assetError('invalid-facing', 'A facing must be a finite angle in radians.'));
	}
	if (shape.footprintOrigin === 'typed' && shape.footprintPending) {
		return err(
			assetError(
				'typed-footprint-cannot-be-pending',
				'A typed footprint is authored in millimetres and never awaits a scale.',
			),
		);
	}
	if (shape.clearance === null && shape.clearancePending) {
		return err(
			assetError(
				'absent-clearance-cannot-be-pending',
				'A shape with no clearance has no clearance coordinates awaiting a scale.',
			),
		);
	}
	return ok({ ...shape, facing: normaliseFacing(shape.facing) });
}

/** Every shape starts here: the rectangle, centred, facing +x, with no clearance. */
export function shapeFromDimensions(width: number, depth: number): Result<AssetShape, ValidationError> {
	const footprint = footprintFromDimensions(width, depth);
	if (isErr(footprint)) return footprint;
	return ok({
		footprint: footprint.value,
		footprintOrigin: 'typed',
		footprintPending: false,
		clearancePending: false,
		anchorPending: false,
		clearance: null,
		anchor: { x: 0, y: 0 },
		facing: 0,
	});
}
