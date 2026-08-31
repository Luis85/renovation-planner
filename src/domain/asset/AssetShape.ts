import type { Point } from '../../core/geometry/Point';
import type { Polygon } from '../../core/geometry/Polygon';
import { createPolygon } from '../../core/geometry/Polygon';
import { boundingBoxOf, enclosesArea } from '../../core/geometry/operations';
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
 * ONE GATE PER QUESTION, both arms reachable. This guard asks only about SIGN, because
 * that is the question `createPolygon` cannot answer: it validates vertex count and
 * finiteness and accepts a zero-area rectangle happily, so a width of 0 has to be refused
 * here or not at all. Finiteness is the opposite case and is left to `createPolygon`,
 * which already refuses it — a NaN or Infinity fails `value <= 0` (NaN comparisons are
 * always false), reaches the polygon, and is refused there as a non-finite coordinate.
 *
 * An earlier draft asked both questions here, which made `createPolygon` unable to fail
 * and left its refusal arm below unreachable — the `boundsOfZones` shape CLAUDE.md
 * records, where a redundant pre-check turns a real guard into dead code no test can
 * cover. The cost of the split is that a non-finite dimension answers
 * `asset.invalid-footprint` rather than `asset.non-positive-dimension`, which is the more
 * honest of the two anyway: NaN is not a non-positive number.
 */
export function footprintFromDimensions(
	width: number,
	depth: number,
): Result<Polygon, ValidationError> {
	for (const value of [width, depth]) {
		if (value <= 0) {
			return err(
				assetError(
					'non-positive-dimension',
					`A dimension must be a positive number of millimetres; got ${String(value)}.`,
				),
			);
		}
	}
	const halfWidth = width / 2;
	const halfDepth = depth / 2;
	// The SIGN guard above is about the input; this one is about the RECTANGLE it produces.
	// A positive subnormal (`Number.MIN_VALUE`, say) satisfies `> 0` and halves to exactly
	// zero, so all four vertices collapse onto the origin and `createPolygon` accepts them
	// happily — four finite points, no rule broken. The command would report a written
	// footprint with no extent. Asking whether the constructed half survived is the general
	// question; refusing one magnitude would leave the next one through.
	if (halfWidth <= 0 || halfDepth <= 0) {
		return err(
			assetError(
				'dimension-underflow',
				`A dimension is too small to describe a rectangle: ${String(width)} x ${String(depth)}.`,
			),
		);
	}
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
	const width = box.value.max.x - box.value.min.x;
	const depth = box.value.max.y - box.value.min.y;
	// A finite EXTENT does not mean a finite SPAN. Every boundary below this one admits
	// coordinates one at a time — the schema, `validatePolygonPoints`, `boundingBoxOf` —
	// so -1e308 and 1e308 each pass and their difference is `Infinity`. Reported rather
	// than returned, because a non-finite width presented as a measurement is the lie the
	// unscaled marker exists to prevent, and `JSON.stringify` would write it as `null`.
	// The same shape as `ReversibleCalibratePlan`'s finite-result guard: a finite ratio
	// does not mean a finite product.
	if (!Number.isFinite(width) || !Number.isFinite(depth)) {
		return err({
			category: 'Geometry',
			code: 'dimensions-overflow',
			message: `A footprint's extent is not representable: got ${String(width)} x ${String(depth)}.`,
		});
	}
	return ok({ width, depth });
}

/** One spelling per direction: `[0, 2π)`, so a stored 2π and a stored 0 cannot differ. */
export function normaliseFacing(radians: number): number {
	if (!Number.isFinite(radians)) return 0;
	const folded = radians % TAU;
	return folded < 0 ? folded + TAU : folded;
}

/**
 * DETACHED FROM THE CALLER on the way out: the validated polygon copies are returned
 * rather than the input's, and the anchor is copied too. Every other field is a primitive
 * and copies by value. The rule is the one `createPolygon` states for its own buffer — a
 * mutation after a successful validation must not be able to break what was just
 * validated — and it holds for a shape only if EVERY reference-typed field obeys it.
 * `Point.x` and `Point.y` are `readonly`, which stops a mutation through THIS type and
 * not through a caller that kept a mutable-typed reference to the same object.
 *
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
	if (!enclosesArea(footprint.value)) {
		return err(
			assetError(
				'degenerate-footprint',
				'A footprint must enclose an area; these vertices are collinear.',
			),
		);
	}
	let clearance: Polygon | null = null;
	if (shape.clearance !== null) {
		const validated = createPolygon(shape.clearance.points);
		if (isErr(validated)) return err(assetError('invalid-clearance', validated.error.message));
		if (!enclosesArea(validated.value)) {
			return err(
				assetError(
					'degenerate-clearance',
					'A clearance must enclose an area; these vertices are collinear.',
				),
			);
		}
		clearance = validated.value;
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
	return ok({
		...shape,
		footprint: footprint.value,
		clearance,
		anchor: { x: shape.anchor.x, y: shape.anchor.y },
		facing: normaliseFacing(shape.facing),
	});
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
