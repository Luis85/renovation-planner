import type { BoundingBox } from '../../core/geometry/BoundingBox';
import type { CurvedPath } from '../../core/geometry/CurvedPath';
import type { CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import type { Point } from '../../core/geometry/Point';
import type { Vector } from '../../core/geometry/Vector';
import { rotate, scale, translate } from '../../core/geometry/operations';
import type { ValidationError } from '../../core/errors/AppError';
import { err, isErr, ok, type Result } from '../../core/result/Result';
import { assetError } from './Asset.errors';
import { mapDetailOutline, type AssetDetail } from './AssetDetail';
import { assetGroups, validateAssetShape, type AssetGroup, type AssetShape } from './AssetShape';
import { detailBox, highestDetailNumber, resolveParticipants } from './detailEdits';
import { highestGroupNumber } from './groupEdits';

/**
 * Composing SEVERAL graphics at once (contract C06, AD10): align them, space them out, move, rotate
 * or proportionally scale them as one, and repeat them along an axis.
 *
 * **Every function here computes the whole result and ends in `validateAssetShape`.** So a refusal
 * about any one participant refuses the WHOLE operation and no half-aligned design is ever handed
 * back, let alone persisted — which is C06's rule and the reason this layer answers a shape rather
 * than applying a sequence of per-part edits.
 *
 * **A part is measured by its CURVE-AWARE box**, `detailEdits.detailBox`, which reads an arc's
 * reach rather than its corner points and answers for an OPEN graphic as readily as a closed one.
 * That is what lets a line take part in an alignment: a path has no interior, but it has an extent,
 * and an extent is the whole of what these operations need. `partExtent.partBox` in the designer is
 * the same measurement for one CLOSED part and cannot answer for a path, which is why nothing here
 * routes through it.
 *
 * **The two disagree about an OPEN graphic, and that is AD11's to reconcile rather than this
 * module's.** `selection/partExtent.ts`'s `outlineOf` answers `null` for a path, so every
 * SINGLE-part gesture in the designer refuses a line outright, while a composition here measures the
 * same line happily and moves it. Both readings are deliberate where they are; the contradiction is
 * between them, and closing it means deciding what a single-part width field means for something
 * with no interior.
 *
 * **Order: nothing here reorders `details`.** Aligning, distributing and transforming rewrite
 * coordinates only; repeating APPENDS its copies, which is the one place the array grows. The
 * drawing order a user set survives all of it, and `groupEdits.moveGroupToEnd` stays the only
 * deliberate reordering a group has.
 *
 * **Stable tie-breaking** comes from `resolveParticipants` answering in canonical `details` order
 * and from `toSorted` being a stable sort: two parts whose centres are equal keep the order the
 * shape draws them in, so the same selection distributed twice lands the same way.
 */

/** Which box edge an alignment brings together. `top` is the LESSER y — an angle of 0 points right and 90 points down. */
export type AlignEdge = 'left' | 'centre-x' | 'right' | 'top' | 'centre-y' | 'bottom';

export type ArrangeAxis = 'x' | 'y';

/** What a distance between two repeated or distributed parts MEANS — C06 requires this be stated, never inferred. */
export type SpacingMode = 'centres' | 'gaps';

/**
 * What an alignment holds still.
 *
 * `bounds` is the default C06 names: the box around every participant, which no single part
 * necessarily occupies. `key` names one participant explicitly and that part DOES NOT MOVE — its
 * own box is the target, so its shift is exactly zero rather than nearly so. A key that is not a
 * participant is refused rather than added to the selection on the user's behalf.
 */
export type AlignReference = { readonly kind: 'bounds' } | { readonly kind: 'key'; readonly id: string };

/** The graphics an operation acts on, plus the ids a leaf has LOCKED (`detailEdits.resolveParticipants`). */
export interface ArrangeSelection {
	readonly ids: readonly string[];
	readonly immovable?: ReadonlySet<string>;
}

/** How many copies one repeat may add. A bound rather than a warning: C06 asks for validated count limits. */
export const MAX_REPEAT_COPIES = 50;

export interface RepeatSpec extends ArrangeSelection {
	/** How many COPIES to add, never counting the original. */
	readonly count: number;
	readonly axis: ArrangeAxis;
	/** Millimetres, read according to `mode`. Negative repeats backwards along the axis. */
	readonly spacing: number;
	readonly mode: SpacingMode;
}

/** One participant with its box, measured once so no operation measures the same part twice. */
interface Measured {
	readonly detail: AssetDetail;
	readonly box: BoundingBox;
}

const axisOf: Record<AlignEdge, ArrangeAxis> = {
	left: 'x',
	'centre-x': 'x',
	right: 'x',
	top: 'y',
	'centre-y': 'y',
	bottom: 'y',
};

const lowOn = (box: BoundingBox, axis: ArrangeAxis): number => (axis === 'x' ? box.min.x : box.min.y);
const highOn = (box: BoundingBox, axis: ArrangeAxis): number => (axis === 'x' ? box.max.x : box.max.y);
const extentOn = (box: BoundingBox, axis: ArrangeAxis): number => highOn(box, axis) - lowOn(box, axis);
const centreOn = (box: BoundingBox, axis: ArrangeAxis): number => (lowOn(box, axis) + highOn(box, axis)) / 2;
const vectorOn = (axis: ArrangeAxis, amount: number): Vector => (axis === 'x' ? { dx: amount, dy: 0 } : { dx: 0, dy: amount });

function edgeOf(box: BoundingBox, edge: AlignEdge): number {
	if (edge === 'left') return box.min.x;
	if (edge === 'right') return box.max.x;
	if (edge === 'top') return box.min.y;
	if (edge === 'bottom') return box.max.y;
	return centreOn(box, axisOf[edge]);
}

/** The box around every participant. `parts` is never empty: every caller resolves a minimum of at least one. */
function unionBox(parts: readonly Measured[]): BoundingBox {
	return parts.reduce<BoundingBox>(
		(union, part) => ({
			min: { x: Math.min(union.min.x, part.box.min.x), y: Math.min(union.min.y, part.box.min.y) },
			max: { x: Math.max(union.max.x, part.box.max.x), y: Math.max(union.max.y, part.box.max.y) },
		}),
		parts[0].box,
	);
}

const centreOf = (box: BoundingBox): Point => ({ x: centreOn(box, 'x'), y: centreOn(box, 'y') });

/**
 * The chosen graphics, measured, or the first reason the operation is refused — **the ONE funnel
 * every spatial operation here goes through**, which is what makes the mixed-space refusal below a
 * rule rather than a habit. `moveDetails` needs no boxes and still comes through it, at the cost of
 * a few `arcExtrema` calls, because the alternative is a rule that holds in five places out of six.
 *
 * **A selection mixing a PENDING graphic with a measured one is refused** (ruling AD10-R1, contract
 * C07): a pending graphic's numbers are background pixels and a measured one's are millimetres, so
 * an arithmetic across the two places a part using a distance that means two different things at its
 * two ends. It is the same rule `fitFootprintToDetails` enforces under `details-await-scale`, asked
 * of a selection rather than of the whole shape.
 *
 * **Refused for MIXING, never for being unscaled.** An all-pending selection shares one coordinate
 * space, is incompatible with nothing, and arranges like any other.
 *
 * It is NOT in `resolveParticipants`, which would be the obvious site and is the wrong one:
 * `groupEdits.groupDetails` shares that function, and AD10-R1 keeps grouping allowed on a mixed
 * selection because a group carries no coordinates at all.
 */
function participants(shape: AssetShape, selection: ArrangeSelection, minimum: number): Result<Measured[], ValidationError> {
	const chosen = resolveParticipants(shape, selection.ids, {
		minimum,
		...(selection.immovable === undefined ? {} : { immovable: selection.immovable }),
	});
	if (isErr(chosen)) return chosen;
	if (chosen.value.some((detail) => detail.pending) && chosen.value.some((detail) => !detail.pending)) {
		return err(
			assetError(
				'mixed-coordinate-spaces',
				'Some chosen parts are still in background pixels and others are in millimetres, so one arrangement cannot measure both.',
			),
		);
	}
	const measured: Measured[] = [];
	for (const detail of chosen.value) {
		const box = detailBox(detail);
		if (isErr(box)) return box;
		measured.push({ detail, box: box.value });
	}
	return ok(measured);
}

/**
 * The shape with the named graphics translated and everything else untouched.
 *
 * A part ABSENT from `deltas` is not written at all, which is how "the endpoints are retained" is
 * exact rather than nearly so: `distributeDetails` gives its two extremes no entry, so neither goes
 * through arithmetic whose result could land a hair off where it already is.
 *
 * **The KEY OBJECT is exact for a different reason, and the distinction is worth keeping**: it does
 * get an entry, of exactly `(0, 0)`, because writing one for every participant is what keeps
 * `alignDetails` a single loop. `x + 0 === x` for every finite double, so the coordinates come back
 * identical — which the case asserting it compares with `toEqual` rather than with a tolerance.
 */
function shifted(shape: AssetShape, deltas: ReadonlyMap<string, Vector>): Result<AssetShape, ValidationError> {
	// **Nothing to write when every shift is zero** (contract C05): pressing Align left twice, or
	// distributing a row that is already even. The INPUT object comes back BY IDENTITY, which is what
	// `DesignerArrangePanel.commit` compares to answer `editShape`'s `null` — no dispatch, no sidecar
	// revision, no undo entry that appears to do nothing. An equal-but-fresh shape would not do:
	// `SetAssetShapeCommand` compares nothing and writes whatever it is handed.
	if ([...deltas.values()].every((by) => by.dx === 0 && by.dy === 0)) return ok(shape);
	return validateAssetShape({
		...shape,
		details: shape.details.map((detail) => {
			const by = deltas.get(detail.id);
			return by === undefined ? detail : mapDetailOutline(detail, (outline) => translate(outline, by));
		}),
	});
}

function referenceBox(parts: readonly Measured[], reference: AlignReference): Result<BoundingBox, ValidationError> {
	if (reference.kind === 'bounds') return ok(unionBox(parts));
	const key = parts.find((part) => part.detail.id === reference.id);
	return key === undefined
		? err(assetError('key-part-not-selected', `The alignment reference "${reference.id}" is not one of the parts being aligned.`))
		: ok(key.box);
}

/**
 * Every participant moved along ONE axis until the named box edge meets the reference's.
 *
 * One axis only: aligning left moves nothing vertically, so an alignment can be built up from two
 * gestures without the second undoing the first.
 */
export function alignDetails(
	shape: AssetShape,
	spec: ArrangeSelection & { readonly edge: AlignEdge; readonly reference: AlignReference },
): Result<AssetShape, ValidationError> {
	const chosen = participants(shape, spec, 2);
	if (isErr(chosen)) return chosen;
	const reference = referenceBox(chosen.value, spec.reference);
	if (isErr(reference)) return reference;
	const target = edgeOf(reference.value, spec.edge);
	const axis = axisOf[spec.edge];
	const deltas = new Map<string, Vector>();
	for (const part of chosen.value) {
		const shift = target - edgeOf(part.box, spec.edge);
		// Zero for the key object by construction — the target IS its own edge — and the map entry
		// is still written, because `shifted` translating by (0, 0) lands the same coordinates.
		deltas.set(part.detail.id, vectorOn(axis, shift));
	}
	return shifted(shape, deltas);
}

/**
 * The interior participants spaced evenly between the two extremes, which keep their places.
 *
 * **`spacing` says which quantity is made even, and the two answer differently.** `centres` evens
 * the distance between box CENTRES, which is what a row of identical parts wants; `gaps` evens the
 * empty space BETWEEN boxes, which is what a row of different-sized parts wants. C06 requires the
 * choice be stated, so it is a parameter rather than a convention.
 *
 * **The sort key follows the mode** for the same reason: under `centres` the endpoints are the
 * extreme centres, under `gaps` they are the extreme edges, and a wide part can be first by one
 * reading and second by the other.
 *
 * **Refused, not approximated**: fewer than three participants has no interior to distribute, and
 * that — with the locked, unknown and repeated-id refusals `resolveParticipants` owns — is the whole
 * list. Everything else is defined: parts already evenly spaced move nothing, a zero span collapses
 * the interiors onto the endpoints, and boxes wider than their span take a negative gap and overlap,
 * which is what the numbers say and not a failure.
 */
export function distributeDetails(
	shape: AssetShape,
	spec: ArrangeSelection & { readonly axis: ArrangeAxis; readonly spacing: SpacingMode },
): Result<AssetShape, ValidationError> {
	const chosen = participants(shape, spec, 3);
	if (isErr(chosen)) return chosen;
	const key = spec.spacing === 'centres' ? centreOn : lowOn;
	const ordered = chosen.value.toSorted((a, b) => key(a.box, spec.axis) - key(b.box, spec.axis));
	return shifted(shape, spec.spacing === 'centres' ? evenCentres(ordered, spec.axis) : evenGaps(ordered, spec.axis));
}

/** Interior centres on a uniform step between the first and last centre; the endpoints get no entry. */
function evenCentres(ordered: readonly Measured[], axis: ArrangeAxis): Map<string, Vector> {
	const first = centreOn(ordered[0].box, axis);
	const step = (centreOn(ordered[ordered.length - 1].box, axis) - first) / (ordered.length - 1);
	const deltas = new Map<string, Vector>();
	for (let index = 1; index < ordered.length - 1; index++) {
		deltas.set(ordered[index].detail.id, vectorOn(axis, first + index * step - centreOn(ordered[index].box, axis)));
	}
	return deltas;
}

/** Interior parts laid end to end with one gap between each; the endpoints get no entry. */
function evenGaps(ordered: readonly Measured[], axis: ArrangeAxis): Map<string, Vector> {
	const span = highOn(ordered[ordered.length - 1].box, axis) - lowOn(ordered[0].box, axis);
	const filled = ordered.reduce((sum, part) => sum + extentOn(part.box, axis), 0);
	const gap = (span - filled) / (ordered.length - 1);
	const deltas = new Map<string, Vector>();
	let cursor = lowOn(ordered[0].box, axis) + extentOn(ordered[0].box, axis) + gap;
	for (let index = 1; index < ordered.length - 1; index++) {
		deltas.set(ordered[index].detail.id, vectorOn(axis, cursor - lowOn(ordered[index].box, axis)));
		cursor += extentOn(ordered[index].box, axis) + gap;
	}
	return deltas;
}

/**
 * Every participant translated by the same vector; nothing else on the shape moves.
 *
 * Through `participants` and its measured boxes although a translation needs none of them: that
 * function is where the mixed-space refusal lives, and a second resolution path here is a door the
 * rule does not reach. The boxes are discarded.
 */
export function moveDetails(shape: AssetShape, spec: ArrangeSelection & { readonly by: Vector }): Result<AssetShape, ValidationError> {
	const chosen = participants(shape, spec, 1);
	if (isErr(chosen)) return chosen;
	return shifted(shape, new Map(chosen.value.map((part) => [part.detail.id, spec.by])));
}

/**
 * Every participant transformed about the CENTRE of their shared box, so a set turns and grows as
 * one body rather than each part about its own middle.
 *
 * A non-finite angle or origin needs no guard of its own: the transformed coordinates reach
 * `validateAssetShape`, which already refuses a non-finite point under the code it owns. A guard
 * here would duplicate that answer and cost a branch nothing could ever cover.
 */
function aboutCentre(
	shape: AssetShape,
	spec: ArrangeSelection,
	map: <T extends CurvedPolygon | CurvedPath>(outline: T, origin: Point) => T,
): Result<AssetShape, ValidationError> {
	const chosen = participants(shape, spec, 1);
	if (isErr(chosen)) return chosen;
	const origin = centreOf(unionBox(chosen.value));
	const moving = new Set(chosen.value.map((part) => part.detail.id));
	return validateAssetShape({
		...shape,
		details: shape.details.map((detail) =>
			moving.has(detail.id) ? mapDetailOutline(detail, (outline) => map(outline, origin)) : detail,
		),
	});
}

export function rotateDetails(shape: AssetShape, spec: ArrangeSelection & { readonly radians: number }): Result<AssetShape, ValidationError> {
	return aboutCentre(shape, spec, (outline, origin) => rotate(outline, spec.radians, origin));
}

/**
 * PROPORTIONAL scaling, which is the only kind offered for a set.
 *
 * A uniform factor preserves every circular arc exactly (C04's first sentence), so nothing here has
 * to argue about silhouettes: r1's ruling about nonuniform scaling belongs to the whole-design
 * dimensions gesture (`scaleDesignToDimensions`), which solves per axis, and this operation
 * deliberately offers no per-axis factor at all. A non-positive or non-finite factor is refused
 * under `shapeEdits`' own `invalid-scale`, so a set and a single part answer the same way.
 */
export function scaleDetails(shape: AssetShape, spec: ArrangeSelection & { readonly factor: number }): Result<AssetShape, ValidationError> {
	if (!Number.isFinite(spec.factor) || spec.factor <= 0) {
		return err(assetError('invalid-scale', `A scale factor must be a finite positive number; got ${String(spec.factor)}.`));
	}
	return aboutCentre(shape, spec, (outline, origin) => scale(outline, spec.factor, origin));
}

/**
 * `count` copies of the chosen graphics, stepped along one axis.
 *
 * **`mode` says what `spacing` measures** (C06): `centres` steps by the distance itself, `gaps` by
 * the selection's own extent along the axis plus the distance, so consecutive copies leave exactly
 * that much empty space between them.
 *
 * **Fresh ids, assigned ONCE.** The whole batch is numbered in one pass from the highest suffix the
 * shape already carries, so no id is recycled and no copy collides with another. **Redo cannot
 * produce a different identity graph**, and that is a property of the write path rather than a
 * promise made here: one call answers one whole shape, which is dispatched as a single
 * `SetAssetShape`, so undo restores the shape before and redo restores the very shape this function
 * built — ids included. Nothing re-runs this function to redo it.
 *
 * **Group membership is remapped per copy.** Each copy of a group that has at least one participant
 * member becomes its own new group over the copies, keeping the original's label; a group's members
 * that were not selected are simply not in the copy, since they were not copied. The originals'
 * groups are untouched.
 *
 * Copies are APPENDED, so they draw on top and the existing order is unchanged — `duplicateDetail`
 * splices one copy directly above its original instead, which is right for one part and would
 * interleave a batch with the parts it was copied from.
 */
export function repeatDetails(shape: AssetShape, spec: RepeatSpec): Result<AssetShape, ValidationError> {
	if (!Number.isInteger(spec.count) || spec.count < 1 || spec.count > MAX_REPEAT_COPIES) {
		return err(
			assetError('repeat-count-out-of-range', `A repeat makes between 1 and ${String(MAX_REPEAT_COPIES)} copies; got ${String(spec.count)}.`),
		);
	}
	if (!Number.isFinite(spec.spacing)) {
		return err(assetError('repeat-spacing-invalid', `A repeat spacing must be a finite number of millimetres; got ${String(spec.spacing)}.`));
	}
	const chosen = participants(shape, spec, 1);
	if (isErr(chosen)) return chosen;
	const step = spec.mode === 'centres' ? spec.spacing : extentOn(unionBox(chosen.value), spec.axis) + spec.spacing;
	const originals = chosen.value.map((part) => part.detail);
	return validateAssetShape(withCopies(shape, originals, spec, step));
}

/** The whole batch built in one pass, so the id run is allocated once rather than per copy. */
function withCopies(shape: AssetShape, originals: readonly AssetDetail[], spec: RepeatSpec, step: number): AssetShape {
	let detailNumber = highestDetailNumber(shape);
	let groupNumber = highestGroupNumber(shape);
	const details: AssetDetail[] = [...shape.details];
	const groups: AssetGroup[] = [...assetGroups(shape)];
	for (let copy = 1; copy <= spec.count; copy++) {
		const by = vectorOn(spec.axis, step * copy);
		const fresh = new Map<string, string>();
		for (const detail of originals) {
			detailNumber += 1;
			const id = `detail-${String(detailNumber)}`;
			fresh.set(detail.id, id);
			details.push({ ...mapDetailOutline(detail, (outline) => translate(outline, by)), id });
		}
		for (const group of assetGroups(shape)) {
			const members = group.members.flatMap((member) => {
				const copied = fresh.get(member);
				return copied === undefined ? [] : [copied];
			});
			if (members.length === 0) continue;
			groupNumber += 1;
			groups.push({ id: `group-${String(groupNumber)}`, ...(group.label === undefined ? {} : { label: group.label }), members });
		}
	}
	return { ...shape, details, groups };
}
