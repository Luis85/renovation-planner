import type { CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import type { CurvedPath } from '../../core/geometry/CurvedPath';
import type { Point } from '../../core/geometry/Point';
import type { Vector } from '../../core/geometry/Vector';
import { rotate, translate } from '../../core/geometry/operations';
import type { ValidationError } from '../../core/errors/AppError';
import { err, isErr, ok, type Result } from '../../core/result/Result';
import { assetError } from './Asset.errors';
import { mapDetailOutline } from './AssetDetail';
import { dimensionsOf, validateAssetShape, type AssetShape, type Dimensions } from './AssetShape';
import { solveScale } from './scaleSolve';

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

/**
 * The CLOSED outline a part names, or null when the shape has no such part — **and null for an
 * OPEN graphic**, which is the whole point of the function and did not change at AD11.
 *
 * A path has no interior and its bulge array is a segment shorter, so handing one to a routine
 * that closes would draw a wrong picture rather than fail. What AD11 changed is that the
 * point-wise transforms no longer come through here: `moveOutline`, `rotateOutline` and
 * `resizeBox` go through `mapPartOutline` below, which keeps a graphic's kind. What is still
 * closed-only is everything that needs the ring itself — `moveVertex` and `setBulge` here (a
 * path's bulge array is indexed per SEGMENT, so `indexIn`'s point-count rule is the wrong question
 * for one), plus, outside this module, **eight call sites in six files, which is what
 * `grep -rn 'outlineOf(' src/` prints once this file and `AssetShelf.vue`'s same-named local are
 * dropped.** The count is written down because both earlier versions of this paragraph got it
 * wrong: the first said "four" and listed four, and the rewrite that caught that said "seven"
 * while listing eight.
 *
 * - `partExtent.partMeasure` — reaches here for the footprint and the clearance only; a detail of
 *   either kind now goes through `detailBox`.
 * - `selectionDrag.boxOf` — so a vertex, box or rotate drag of a path answers `partNotFound`.
 * - `handles.selectionHandles` — which is why a path is drawn with no handles at all, and in turn
 *   why the two `dragSnap` sites and `designer-select-tool.beginBend` below cannot be reached on
 *   one.
 * - `selectionLayer.selectedRun` (footprint and clearance only, as `partMeasure`) and
 *   `selectionLayer.selectionFrame` — the second is why Shift+2 frames nothing on a path.
 * - `dragSnap`'s vertex and box-handle arms, and `designer-select-tool.beginBend` — all three cast
 *   the answer to a `CurvedPolygon`, and all three are safe because `selectionHandles` draws no
 *   handle on a path for a press to land on.
 *
 * So an open graphic today has no vertex handles, no bend, no box resize and nothing for Shift+2
 * to frame. What it HAS is the Parts panel, the inspector's numeric fields, the arrow-key nudge and
 * a body drag — the first three through the transforms below, the last through `partPoints`.
 */
export function outlineOf(shape: AssetShape, part: OutlinePart): CurvedPolygon | null {
	if (part.kind === 'footprint') return shape.footprint;
	if (part.kind === 'clearance') return shape.clearance;
	const detail = shape.details.find((found) => found.id === part.id);
	return detail === undefined || detail.kind === 'open' ? null : detail.outline;
}

/**
 * Every VERTEX of the part `part` names, whatever its kind, or null when the shape has no such
 * part — the read for a caller that wants points and no interior (AD11).
 *
 * Its own function rather than a widened `outlineOf` because the two answer different questions
 * and one of them has to keep refusing: `outlineOf` promises a ring, and every caller that asks
 * for one goes on to close, fill or index it per point. `dragSnap.snapBody` is the caller this
 * exists for — a body drag is a translation, so a path's vertices are the whole of what it needs.
 */
export function partPoints(shape: AssetShape, part: OutlinePart): readonly Point[] | null {
	if (part.kind !== 'detail') return outlineOf(shape, part)?.points ?? null;
	return shape.details.find((found) => found.id === part.id)?.outline.points ?? null;
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
function scaled<T extends CurvedPolygon | CurvedPath>(outline: T, sx: number, sy: number, origin: Point): T {
	return {
		...outline,
		points: outline.points.map((point) => ({ x: origin.x + (point.x - origin.x) * sx, y: origin.y + (point.y - origin.y) * sy })),
	};
}

/**
 * `map` applied to whichever part `part` names, KEEPING ITS KIND, then validated — the one path
 * every point-wise transform of a part takes (AD11).
 *
 * `map` is generic exactly as `mapDetailOutline`'s callback is, so an open path comes back an open
 * path with its brand intact and a ring comes back a ring: `translate`, `rotate` and `scaled` all
 * have that shape already, which is why this is a re-pointing rather than a second implementation.
 * `editOutline` beside it stays for the edits that genuinely need a closed ring.
 */
function mapPartOutline(
	shape: AssetShape,
	part: OutlinePart,
	map: <T extends CurvedPolygon | CurvedPath>(outline: T) => T,
): Result<AssetShape, ValidationError> {
	if (part.kind === 'footprint') return validateAssetShape({ ...shape, footprint: map(shape.footprint) });
	if (part.kind === 'clearance') {
		return shape.clearance === null ? err(partNotFound(part)) : validateAssetShape({ ...shape, clearance: map(shape.clearance) });
	}
	if (!shape.details.some((detail) => detail.id === part.id)) return err(partNotFound(part));
	return validateAssetShape({
		...shape,
		details: shape.details.map((detail) => (detail.id === part.id ? mapDetailOutline(detail, map) : detail)),
	});
}

/** The shape with one part's outline replaced; a detail keeps its id, name, line and pending flag. */
function withOutline(shape: AssetShape, part: OutlinePart, outline: CurvedPolygon): AssetShape {
	if (part.kind === 'footprint') return { ...shape, footprint: outline };
	if (part.kind === 'clearance') return { ...shape, clearance: outline };
	// `detail.kind !== 'open'` and not a guard clause: `outlineOf` above has already answered null
	// for an open graphic, so `editOutline` refused this part before reaching here. The condition is
	// what makes that true at the type level as well — an open detail cannot be handed a polygon.
	return { ...shape, details: shape.details.map((detail) => (detail.id === part.id && detail.kind !== 'open' ? { ...detail, outline } : detail)) };
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

/** Translation is kind-agnostic, so an open graphic moves here — the arrow-key nudge and the inspector's centre fields. */
export function moveOutline(shape: AssetShape, part: OutlinePart, by: Vector): Result<AssetShape, ValidationError> {
	return mapPartOutline(shape, part, (outline) => translate(outline, by));
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
	return mapPartOutline(shape, part, (outline) => scaled(outline, factors.sx, factors.sy, origin));
}

export function rotateOutline(shape: AssetShape, part: OutlinePart, radians: number, origin: Point): Result<AssetShape, ValidationError> {
	return mapPartOutline(shape, part, (outline) => rotate(outline, radians, origin));
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
 * is, by one raw factor per axis. `scaleDesignToDimensions` below is the caller for the dimensions
 * gesture: it uses this as the per-axis `apply` a secant solve calls with successive factors, one
 * axis at a time, rather than calling it directly with a ratio.
 */
export function scaleDesign(shape: AssetShape, sx: number, sy: number): Result<AssetShape, ValidationError> {
	const refused = scaleRefusal(sx, sy);
	if (refused !== null) return err(refused);
	const about = <T extends CurvedPolygon | CurvedPath>(outline: T): T => scaled(outline, sx, sy, shape.anchor);
	return validateAssetShape({
		...shape,
		footprint: about(shape.footprint),
		clearance: shape.clearance === null ? null : about(shape.clearance),
		details: shape.details.map((detail) => mapDetailOutline(detail, (outline) => scaled(outline, sx, sy, shape.anchor))),
	});
}

/** The design and what its footprint measures, carried together so a solve never re-asks for a size that could overflow. */
interface Sized {
	readonly shape: AssetShape;
	readonly dimensions: Dimensions;
}

/**
 * Maps `dimensionsOf`'s own overflow guard onto a design edit's refusal shape. Called both on the
 * shape a caller hands in AND, inside `scaleDesignToDimensions`'s loop, on every candidate a secant
 * step produces — `solveScale` clamps a factor only away from non-positive, never away from large,
 * so an internally-computed factor can stretch a footprint past what a double can represent, the
 * same `-1e308`-to-`1e308` overflow `AssetShape.dimensionsOf` already refuses as `dimensions-overflow`.
 * Refused here rather than solved against, since `Infinity` is not a measurement a secant can use.
 */
function sized(shape: AssetShape): Result<Sized, ValidationError> {
	const dimensions = dimensionsOf(shape.footprint);
	if (isErr(dimensions)) return err(assetError('invalid-footprint', dimensions.error.message));
	return ok({ shape, dimensions: dimensions.value });
}

/**
 * The design scaled about its anchor until its FOOTPRINT measures `width` x `depth` — what Set
 * dimensions does to a design that already has real millimetres in it.
 *
 * Solved rather than divided, through `solveScale`, for the reason that function states: bulges are
 * kept, so an arc's reach follows its chord and a plain ratio misses on anything curved.
 *
 * **One axis at a time, three passes, because the axes are COUPLED.** Scaling y changes the chord of
 * an arc that bows in x, so its x-extent moves with it: x, then y, then x again, each solved on the
 * result of the last. The answer is whatever the LAST pass lands. `shapeEdits.test.ts`'s
 * "never lands the third pass on width worse than the second" reconstructs pass 1 and pass 2 through
 * the exported `solveScale` and `scaleDesign` for an unreachable width, then checks the real third
 * pass against that reconstruction: it never lands further from the target than the second pass did,
 * and lands within a tenth of a millimetre of it — CLOSE rather than exact, since a secant correction
 * still moves it slightly. Circles, a scalloped ring, `roundFront` and the toilet preset at a spread
 * of other targets were measured once at extraction to behave the same way and are not held by a
 * check. A straight-sided design lands both axes exactly on the first pass and the later ones change
 * nothing.
 *
 * Its ceiling is `solveScale`'s: an unreachable extent lands near the typed value rather than on it.
 */
export function scaleDesignToDimensions(shape: AssetShape, width: number, depth: number): Result<AssetShape, ValidationError> {
	const start = sized(shape);
	if (isErr(start)) return start;
	const passes = [
		{ axis: 'width', target: width },
		{ axis: 'depth', target: depth },
		{ axis: 'width', target: width },
	] as const;
	let current = start.value;
	for (const pass of passes) {
		const solved = solveScale<Sized>({
			start: current.dimensions[pass.axis],
			target: pass.target,
			apply: (factor) => {
				const scaledShape = scaleDesign(current.shape, pass.axis === 'width' ? factor : 1, pass.axis === 'width' ? 1 : factor);
				return isErr(scaledShape) ? scaledShape : sized(scaledShape.value);
			},
			measure: (candidate) => candidate.dimensions[pass.axis],
		});
		if (isErr(solved)) return solved;
		current = solved.value;
	}
	return ok(current.shape);
}
