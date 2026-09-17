import type { BoundingBox } from '../../core/geometry/BoundingBox';
import type { CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import type { Point } from '../../core/geometry/Point';
import type { Vector } from '../../core/geometry/Vector';
import { boundingBoxOf, translate } from '../../core/geometry/operations';
import type { ValidationError } from '../../core/errors/AppError';
import { err, isErr, ok, unwrap, type Result } from '../../core/result/Result';
import { assetError } from './Asset.errors';
import { mapDetailOutline, type AssetDetail, type ClosedDetail, type DetailLine, type OpenDetail } from './AssetDetail';
import { validateAssetShape, type AssetShape } from './AssetShape';
import { partNotFound } from './shapeEdits';

/**
 * The edits that change WHICH details a shape has, or their order and labels (asset designer
 * symbols spec, Decision 9 and Amendment 1). Beside `shapeEdits.ts` rather than inside it because
 * those reshape one outline and these reshape the list; both answer a validated shape or a refusal.
 */

/** How far a duplicate lands from its original, along +x and +y (Amendment 1). */
export const DUPLICATE_OFFSET_MM = 100;

/**
 * A detail as a tool proposes it: everything but the id, which the shape assigns.
 *
 * **A union over `AssetDetail`'s own arms rather than a fourth spelling of a graphic** (AD11). It
 * was `{ name, outline: CurvedPolygon, line, pending }`, which is the closed arm written out — so
 * `addDetail` was the one door into the shape and it could only be handed a ring. That was correct
 * while nothing could build an open one; AD04 recorded the day something could as the day this had
 * to widen. Derived from the arms so it cannot drift from them, and so `label` (AD09) arrives here
 * too rather than being the next field somebody notices is missing.
 */
export type NewDetail = Omit<ClosedDetail, 'id'> | Omit<OpenDetail, 'id'>;

const NUMBERED_ID = /^detail-(\d+)$/;

/**
 * The highest numeric suffix among `ids` matching `pattern`, 0 for none — the arithmetic behind
 * every `<prefix>-<n>` id this aggregate mints.
 *
 * Shared rather than written twice because GROUPS number the same way (`groupEdits.ts`), and a
 * second copy of "one above the highest" is the pair that drifts into "one above the count" —
 * which is the id recycling this rule exists to refuse. `pattern` is a module constant at each
 * call site, so nothing here builds a regular expression at runtime.
 */
export function highestSuffix(ids: Iterable<string>, pattern: RegExp): number {
	let highest = 0;
	for (const id of ids) {
		const match = pattern.exec(id);
		if (match !== null) highest = Math.max(highest, Number(match[1]));
	}
	return highest;
}

/** What `nextDetailId` counts from, exported so a BATCH can allocate a run of ids in one pass. */
export function highestDetailNumber(shape: AssetShape): number {
	return highestSuffix(
		shape.details.map((detail) => detail.id),
		NUMBERED_ID,
	);
}

/**
 * `detail-<n>` with n one above the highest numeric suffix among ids of that form, `detail-1` for
 * none. One above the HIGHEST rather than the count, so deleting `detail-1` of two cannot hand the
 * next detail the id `detail-2` still carries.
 */
export function nextDetailId(shape: AssetShape): string {
	return `detail-${String(highestDetailNumber(shape) + 1)}`;
}

/**
 * A graphic's CURVE-AWARE bounding box, whichever kind it is — what every composition operation
 * measures a part by (`arrangeDetails.ts`, and `fitFootprintToDetails` below).
 *
 * **Both kinds through one function, and the open arm is the reason it exists.** `boundingBoxOf`
 * takes a `CurvedPolygon`, whose bulge array is one per POINT because its wrap edge is real; an
 * open path carries one per SEGMENT, so handing its own array over answers `curve-edge-count` and
 * refuses every CURVED open graphic. A trailing zero is the honest reading: it makes the absent
 * wrap edge straight, and a straight edge between two points already in the list contributes no
 * extent at all. Reading the POINTS alone instead would drop an arc's reach, which is exactly the
 * measurement a box is asked for.
 */
export function detailBox(detail: AssetDetail): Result<BoundingBox, ValidationError> {
	const measured = boundingBoxOf(closedReading(detail));
	return isErr(measured) ? err(assetError('invalid-detail', measured.error.message)) : ok(measured.value);
}

/** A graphic's geometry in the shape `boundingBoxOf` reads; `detailBox` above explains the trailing zero. */
function closedReading(detail: AssetDetail): CurvedPolygon {
	const { points, bulges } = detail.outline;
	if (bulges === undefined) return { points };
	return { points, bulges: detail.kind === 'open' ? [...bulges, 0] : bulges };
}

/**
 * The graphics `ids` names, in CANONICAL `details` order, or the first reason the whole operation
 * is refused (C06: an invalid participant refuses the edit rather than being worked around).
 *
 * **Canonical order rather than selection order**, which is what gives every composition operation
 * its stable tie-breaking: two parts sharing a centre distribute in the order the shape draws them,
 * and that is a fact about the design rather than about the order the user happened to press.
 *
 * **`immovable` is how a leaf-local LOCK reaches a pure function** (AD09's `PartView.locked`). The
 * domain knows nothing about a lock; it is handed the ids that must not move, and a chosen
 * participant inside that set refuses the WHOLE operation rather than being dropped from it —
 * dropping would rearrange the others around a part the user can see is locked, which is the
 * half-applied edit C06 refuses. Nothing moves by IMPLICATION either, because a graphic that is not
 * a participant is never written; that half holds even for a lock this function is never told about.
 */
export function resolveParticipants(
	shape: AssetShape,
	ids: readonly string[],
	rules: { readonly minimum: number; readonly immovable?: ReadonlySet<string> },
): Result<AssetDetail[], ValidationError> {
	const chosen = new Set(ids);
	if (chosen.size !== ids.length) {
		return err(assetError('duplicate-part', 'A part was named twice in one operation.'));
	}
	if (ids.length < rules.minimum) {
		return err(
			assetError('too-few-parts', `This operation needs at least ${String(rules.minimum)} parts; got ${String(ids.length)}.`),
		);
	}
	const known = new Set(shape.details.map((detail) => detail.id));
	for (const id of ids) {
		if (!known.has(id)) return err(partNotFound({ kind: 'detail', id }));
		if (rules.immovable?.has(id) === true) {
			return err(assetError('locked-part', `Part "${id}" is locked, so nothing may move it.`));
		}
	}
	return ok(shape.details.filter((detail) => chosen.has(detail.id)));
}

function detailIndex(shape: AssetShape, id: string): Result<number, ValidationError> {
	const index = shape.details.findIndex((detail) => detail.id === id);
	return index < 0 ? err(partNotFound({ kind: 'detail', id })) : ok(index);
}

/** Appended, so the new detail draws on top. */
export function addDetail(shape: AssetShape, detail: NewDetail): Result<AssetShape, ValidationError> {
	const id = nextDetailId(shape);
	// Both arms written out for `mapDetailOutline`'s reason: TypeScript cannot correlate a spread
	// with a union, so `{ ...detail, id }` over the union is assignable to neither arm even though
	// each arm's own spread is.
	const added: AssetDetail = detail.kind === 'open' ? { ...detail, id } : { ...detail, id };
	return validateAssetShape({ ...shape, details: [...shape.details, added] });
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
 *
 * **`label` takes the opposite rule, and the asymmetry is the point** (C02, AD09): `name` is the
 * stable semantic key a preset, a locale lookup and every test address a graphic by, so it may
 * never be empty; `label` is the renovator's own words for the same graphic, optional by
 * construction, so a CLEARED field removes it and the surfaces fall back to the name. Writing the
 * user's words over `name` would rename the key rather than label the part, which is exactly what
 * the two fields exist to keep apart — so the Parts panel's rename reaches `label` and nothing in
 * the product writes `name` from a free-text field.
 *
 * An absent member of `changes` leaves that field as it was, label included.
 */
export function updateDetail(
	shape: AssetShape,
	id: string,
	changes: { readonly name?: string; readonly line?: DetailLine; readonly label?: string },
): Result<AssetShape, ValidationError> {
	const found = detailIndex(shape, id);
	if (isErr(found)) return found;
	const original = shape.details[found.value];
	const trimmed = changes.name?.trim() ?? '';
	const name = trimmed === '' ? original.name : trimmed;
	const line = changes.line ?? original.line;
	const label = labelAfter(original.label, changes.label);
	return validateAssetShape({
		...shape,
		details: shape.details.map((detail, index) => (index === found.value ? relabelled(detail, name, line, label) : detail)),
	});
}

/** What the label becomes: the one given, trimmed; removed when it is blank; unchanged when none is given. */
function labelAfter(original: string | undefined, change: string | undefined): string | undefined {
	if (change === undefined) return original;
	const trimmed = change.trim();
	return trimmed === '' ? undefined : trimmed;
}

/**
 * One graphic with its name, line and label replaced, keeping everything else it carries.
 *
 * Removing a label REMOVES THE PROPERTY rather than setting it to `undefined`, which is why this
 * destructures rather than spreading over the original: `validateDetail` and the sidecar mapper
 * both ask whether the key is there, and `{ ...detail, label: undefined }` leaves it there.
 *
 * The `kind`/`outline` pair is restored explicitly on each arm for `mapDetailOutline`'s reason —
 * the rest object has lost the correlation between the two, so the compiler would refuse the
 * result as assignable to neither arm. A closed graphic comes back with `kind: 'closed'` written
 * out, which is what `validateDetails` stamps on it anyway.
 */
function relabelled(detail: AssetDetail, name: string, line: DetailLine, label: string | undefined): AssetDetail {
	const { label: _previous, ...rest } = detail;
	const next = { ...rest, name, line, ...(label === undefined ? {} : { label }) };
	return detail.kind === 'open' ? { ...next, kind: 'open', outline: detail.outline } : { ...next, kind: 'closed', outline: detail.outline };
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
		// Through `detailBox` rather than `boundingBoxOf` directly. The reading that lived here
		// handed an open path its OWN bulge array, which is a segment shorter than a ring's, so
		// every CURVED open graphic was refused under `curve-edge-count` — a graphic nothing could
		// draw yet when this line was written and one AD11 is about to make ordinary.
		const box = detailBox(detail);
		if (isErr(box)) return box;
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
