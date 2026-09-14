import type { CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import type { Point } from '../../core/geometry/Point';
import type { Vector } from '../../core/geometry/Vector';
import { rotate, translate } from '../../core/geometry/operations';
import type { ValidationError } from '../../core/errors/AppError';
import { err, isErr, ok, type Result } from '../../core/result/Result';
import { assetError } from './Asset.errors';
import { validateAssetShape, type AssetShape } from './AssetShape';

/**
 * Part edits (asset designer symbols spec, Decision 9 and Amendment 1): pure functions over an
 * `AssetShape`, each answering a VALIDATED shape or a refusal. A gesture computes its whole result
 * here and presentation dispatches it through `SetAssetShape`, so a drag, a typed width and its undo
 * each describe one shape rather than a sequence of partial writes.
 *
 * **Every function ends in `validateAssetShape`**, which is what makes a degenerate outline, a
 * non-finite coordinate or a bulge past a semicircle a refusal under the codes validation already
 * owns. No edit re-asks those questions, so none can disagree with the constructor about what a
 * valid shape is.
 *
 * **Bulges ride along unchanged** through translation, rotation and POSITIVE scaling, uniform or
 * not: a non-uniform scale keeps each arc circular through its new chord, which the spec states as
 * behaviour. Only a mirror flips a bulge's sign, which is why a non-positive factor is refused as
 * `asset.invalid-scale` rather than handled. `translate` and `rotate` spread the polygon they map,
 * so they carry `bulges`; `operations.ts`'s `scale` is uniform only, hence `scaled` below.
 *
 * **Pending flags are carried, never re-decided**: an edit to a group captured in background pixels
 * leaves it in pixel space, and only the calibration that converts it clears the flag.
 * `removeClearance` writes one, because validation refuses a pending flag on an absent clearance.
 */

/** Which outline an edit names: the footprint, the clearance, or a detail by id. */
export type OutlinePart =
	| { readonly kind: 'footprint' }
	| { readonly kind: 'clearance' }
	| { readonly kind: 'detail'; readonly id: string };

/** The outline a part names, or null when the shape has no such part. */
export function outlineOf(shape: AssetShape, part: OutlinePart): CurvedPolygon | null {
	if (part.kind === 'footprint') return shape.footprint;
	if (part.kind === 'clearance') return shape.clearance;
	return shape.details.find((detail) => detail.id === part.id)?.outline ?? null;
}

/**
 * "The part an edit names is not there" — a clearance the shape has not got, or a detail id it does
 * not carry. Exported so every place that asks this has one spelling.
 */
export function partNotFound(part: OutlinePart): ValidationError {
	return assetError('part-not-found', `This design has no such part: ${JSON.stringify(part)}.`);
}

function indexIn(outline: CurvedPolygon, index: number): boolean {
	return Number.isInteger(index) && index >= 0 && index < outline.points.length;
}

function outOfRange(outline: CurvedPolygon, index: number): ValidationError {
	return assetError(
		'vertex-out-of-range',
		`${String(index)} is not a corner or edge of an outline with ${String(outline.points.length)} corners.`,
	);
}

/** `null` when both factors are finite and positive; the refusal otherwise. */
function scaleRefusal(sx: number, sy: number): ValidationError | null {
	if ([sx, sy].every((factor) => Number.isFinite(factor) && factor > 0)) return null;
	return assetError('invalid-scale', `A scale factor must be a finite positive number; got ${String(sx)} x ${String(sy)}.`);
}

/** Each axis scaled about `origin` on its own; bulges are carried by the spread. */
function scaled(outline: CurvedPolygon, sx: number, sy: number, origin: Point): CurvedPolygon {
	return {
		...outline,
		points: outline.points.map((point) => ({ x: origin.x + (point.x - origin.x) * sx, y: origin.y + (point.y - origin.y) * sy })),
	};
}

/** The shape with one part's outline replaced; a detail keeps its id, name, line and pending flag. */
function withOutline(shape: AssetShape, part: OutlinePart, outline: CurvedPolygon): AssetShape {
	if (part.kind === 'footprint') return { ...shape, footprint: outline };
	if (part.kind === 'clearance') return { ...shape, clearance: outline };
	return { ...shape, details: shape.details.map((detail) => (detail.id === part.id ? { ...detail, outline } : detail)) };
}

/** Find the part, edit its outline, write it back and validate the whole shape: every outline edit's one path. */
function editOutline(
	shape: AssetShape,
	part: OutlinePart,
	edit: (outline: CurvedPolygon) => Result<CurvedPolygon, ValidationError>,
): Result<AssetShape, ValidationError> {
	const outline = outlineOf(shape, part);
	if (outline === null) return err(partNotFound(part));
	const edited = edit(outline);
	if (isErr(edited)) return edited;
	return validateAssetShape(withOutline(shape, part, edited.value));
}

export function moveOutline(shape: AssetShape, part: OutlinePart, by: Vector): Result<AssetShape, ValidationError> {
	return editOutline(shape, part, (outline) => ok(translate(outline, by)));
}

/**
 * One corner moved. The point count is unchanged, so every edge keeps its bulge — the spread is
 * `preservePointCurves`' rule without that function's topology-change arm, which a vertex move
 * cannot reach and which would therefore be a refusal no test could drive.
 */
export function moveVertex(shape: AssetShape, part: OutlinePart, index: number, to: Point): Result<AssetShape, ValidationError> {
	return editOutline(shape, part, (outline) => {
		if (!indexIn(outline, index)) return err(outOfRange(outline, index));
		return ok({ ...outline, points: outline.points.map((point, at) => (at === index ? to : point)) });
	});
}

/** One edge's bulge replaced. Writes a value for EVERY edge, so a straight outline gains a full list with zeros elsewhere. */
export function setBulge(shape: AssetShape, part: OutlinePart, edge: number, bulge: number): Result<AssetShape, ValidationError> {
	return editOutline(shape, part, (outline) => {
		if (!indexIn(outline, edge)) return err(outOfRange(outline, edge));
		const bulges = outline.points.map((_, at) => (at === edge ? bulge : (outline.bulges?.[at] ?? 0)));
		return ok({ points: outline.points, bulges });
	});
}

/** Scales one outline about `origin`, each axis by its own factor; the caller picks the fixed corner or side. */
export function resizeBox(
	shape: AssetShape,
	part: OutlinePart,
	factors: { readonly sx: number; readonly sy: number },
	origin: Point,
): Result<AssetShape, ValidationError> {
	const refused = scaleRefusal(factors.sx, factors.sy);
	if (refused !== null) return err(refused);
	return editOutline(shape, part, (outline) => ok(scaled(outline, factors.sx, factors.sy, origin)));
}

export function rotateOutline(shape: AssetShape, part: OutlinePart, radians: number, origin: Point): Result<AssetShape, ValidationError> {
	return editOutline(shape, part, (outline) => ok(rotate(outline, radians, origin)));
}

export function moveAnchor(shape: AssetShape, to: Point): Result<AssetShape, ValidationError> {
	return validateAssetShape({ ...shape, anchor: to });
}

/** The angle passes straight through: validation is what folds it into `[0, 2π)`. */
export function setFacing(shape: AssetShape, radians: number): Result<AssetShape, ValidationError> {
	return validateAssetShape({ ...shape, facing: radians });
}

/** The clearance removed with its pending flag. The footprint has no counterpart: without one there is no shape. */
export function removeClearance(shape: AssetShape): Result<AssetShape, ValidationError> {
	if (shape.clearance === null) return err(partNotFound({ kind: 'clearance' }));
	return validateAssetShape({ ...shape, clearance: null, clearancePending: false });
}

/**
 * Every outline scaled about the ANCHOR, so the point a plan positions the asset by stays where it
 * is. What "Set dimensions" uses on a shape with details or curves (Amendment 1).
 */
export function scaleDesign(shape: AssetShape, sx: number, sy: number): Result<AssetShape, ValidationError> {
	const refused = scaleRefusal(sx, sy);
	if (refused !== null) return err(refused);
	const about = (outline: CurvedPolygon): CurvedPolygon => scaled(outline, sx, sy, shape.anchor);
	return validateAssetShape({
		...shape,
		footprint: about(shape.footprint),
		clearance: shape.clearance === null ? null : about(shape.clearance),
		details: shape.details.map((detail) => ({ ...detail, outline: about(detail.outline) })),
	});
}
