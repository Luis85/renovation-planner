import type { CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import type { Point } from '../../core/geometry/Point';
import type { Vector } from '../../core/geometry/Vector';
import { boundingBoxOf, translate } from '../../core/geometry/operations';
import type { ValidationError } from '../../core/errors/AppError';
import { err, isErr, ok, unwrap, type Result } from '../../core/result/Result';
import { assetError } from './Asset.errors';
import { mapDetailOutline, type DetailLine } from './AssetDetail';
import { validateAssetShape, type AssetShape } from './AssetShape';
import { partNotFound } from './shapeEdits';

/**
 * The edits that change WHICH details a shape has, or their order and labels (asset designer
 * symbols spec, Decision 9 and Amendment 1). Beside `shapeEdits.ts` rather than inside it because
 * those reshape one outline and these reshape the list; both answer a validated shape or a refusal.
 */

/** How far a duplicate lands from its original, along +x and +y (Amendment 1). */
export const DUPLICATE_OFFSET_MM = 100;

/** A detail as a tool proposes it: everything but the id, which the shape assigns. */
export interface NewDetail {
	readonly name: string;
	readonly outline: CurvedPolygon;
	readonly line: DetailLine;
	readonly pending: boolean;
}

const NUMBERED_ID = /^detail-(\d+)$/;

/**
 * `detail-<n>` with n one above the highest numeric suffix among ids of that form, `detail-1` for
 * none. One above the HIGHEST rather than the count, so deleting `detail-1` of two cannot hand the
 * next detail the id `detail-2` still carries.
 */
export function nextDetailId(shape: AssetShape): string {
	let highest = 0;
	for (const detail of shape.details) {
		const match = NUMBERED_ID.exec(detail.id);
		if (match !== null) highest = Math.max(highest, Number(match[1]));
	}
	return `detail-${String(highest + 1)}`;
}

function detailIndex(shape: AssetShape, id: string): Result<number, ValidationError> {
	const index = shape.details.findIndex((detail) => detail.id === id);
	return index < 0 ? err(partNotFound({ kind: 'detail', id })) : ok(index);
}

/** Appended, so the new detail draws on top. */
export function addDetail(shape: AssetShape, detail: NewDetail): Result<AssetShape, ValidationError> {
	return validateAssetShape({ ...shape, details: [...shape.details, { ...detail, id: nextDetailId(shape) }] });
}

/** A copy directly above the original, offset by `offset`, with its name, line and pending flag. */
export function duplicateDetail(shape: AssetShape, id: string, offset: Vector): Result<AssetShape, ValidationError> {
	const found = detailIndex(shape, id);
	if (isErr(found)) return found;
	const original = shape.details[found.value];
	const copy = { ...mapDetailOutline(original, (outline) => translate(outline, offset)), id: nextDetailId(shape) };
	return validateAssetShape({ ...shape, details: shape.details.toSpliced(found.value + 1, 0, copy) });
}

export function deleteDetail(shape: AssetShape, id: string): Result<AssetShape, ValidationError> {
	const found = detailIndex(shape, id);
	if (isErr(found)) return found;
	return validateAssetShape({ ...shape, details: shape.details.filter((detail) => detail.id !== id) });
}

/** One step in the drawing order: `forward` is one later in the array, which draws over its neighbour. */
export function reorderDetail(shape: AssetShape, id: string, direction: 'forward' | 'backward'): Result<AssetShape, ValidationError> {
	const found = detailIndex(shape, id);
	if (isErr(found)) return found;
	const to = found.value + (direction === 'forward' ? 1 : -1);
	if (to < 0 || to >= shape.details.length) {
		return err(assetError('detail-at-limit', `Detail "${id}" cannot move ${direction}; it is already at that end of the drawing order.`));
	}
	const details = shape.details.with(found.value, shape.details[to]).with(to, shape.details[found.value]);
	return validateAssetShape({ ...shape, details });
}

/**
 * A name is TRIMMED, and a blank one keeps the name the detail had rather than refusing: the
 * inspector commits on blur, and a cleared field is a user who has not finished typing, not a
 * request for a detail with no name.
 */
export function updateDetail(
	shape: AssetShape,
	id: string,
	changes: { readonly name?: string; readonly line?: DetailLine },
): Result<AssetShape, ValidationError> {
	const found = detailIndex(shape, id);
	if (isErr(found)) return found;
	const original = shape.details[found.value];
	const trimmed = changes.name?.trim() ?? '';
	const name = trimmed === '' ? original.name : trimmed;
	const line = changes.line ?? original.line;
	return validateAssetShape({
		...shape,
		details: shape.details.map((detail, index) => (index === found.value ? { ...detail, name, line } : detail)),
	});
}

/**
 * The footprint replaced by the rectangle around every detail's CURVE-AWARE extent, as a typed,
 * unpending outline; nothing else changes.
 *
 * Refused while any detail awaits a scale: a typed footprint is millimetres by definition, so one
 * drawn around background pixels would launder them into millimetres the calibration then leaves
 * alone. A detail whose outline cannot be measured is refused under the detail's own code — the
 * shape handed in is not assumed to have been validated.
 */
export function fitFootprintToDetails(shape: AssetShape): Result<AssetShape, ValidationError> {
	if (shape.details.length === 0) return err(assetError('no-details', 'There are no details to fit the footprint to.'));
	if (shape.details.some((detail) => detail.pending)) {
		return err(assetError('details-await-scale', 'A detail is still in background pixels, so no footprint in millimetres can be fitted to it.'));
	}
	const corners: Point[] = [];
	for (const detail of shape.details) {
		// Over the graphic's POINTS rather than the graphic: an open path has no interior, but its
		// box is the same question and the same answer. Arcs are read at their extrema either way,
		// which `boundingBoxOf` does for a bulge array it is given.
		const box = boundingBoxOf({ points: detail.outline.points, ...(detail.outline.bulges === undefined ? {} : { bulges: detail.outline.bulges }) });
		if (isErr(box)) return err(assetError('invalid-detail', box.error.message));
		corners.push(box.value.min, box.value.max);
	}
	const { min, max } = unwrap(boundingBoxOf({ points: corners }));
	return validateAssetShape({
		...shape,
		footprint: { points: [{ x: min.x, y: min.y }, { x: max.x, y: min.y }, { x: max.x, y: max.y }, { x: min.x, y: max.y }] },
		footprintOrigin: 'typed',
		footprintPending: false,
	});
}
