import type { Point } from '../../core/geometry/Point';
import type { Polygon } from '../../core/geometry/Polygon';
import { createPolygon } from '../../core/geometry/Polygon';
import type { CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import { createCurvedPolygon } from '../../core/geometry/CurvedPolygon';
import { boundingBoxOf, enclosesArea } from '../../core/geometry/operations';
import type { GeometryError, ValidationError } from '../../core/errors/AppError';
import { err, isErr, ok, type Result } from '../../core/result/Result';
import { assetError } from './Asset.errors';
import { validateDetails, type AssetDetail } from './AssetDetail';

const TAU = Math.PI * 2;

export type FootprintOrigin = 'typed' | 'traced';

export interface AssetShape {
	readonly footprint: CurvedPolygon;
	readonly footprintOrigin: FootprintOrigin;
	/**
	 * One flag per coordinate group that can be captured on its own, each set at THAT
	 * attribute's capture on an uncalibrated surface and cleared by the calibration that
	 * converts it. Typed geometry is never pending, which is why no rule has to name it.
	 */
	readonly footprintPending: boolean;
	readonly clearancePending: boolean;
	readonly anchorPending: boolean;
	readonly clearance: CurvedPolygon | null;
	/**
	 * **A MEASURED clearance this object was resized around, kept at the size its author drew
	 * and flagged instead of scaled** (AD14-R1, ADR-0034). Set in `scaleDesign` and nowhere else;
	 * cleared by any write whose SUBJECT is the clearance itself, because a gesture aimed at the
	 * boundary IS the review.
	 *
	 * **NOT a fourth pending flag, despite sitting beside three.** `clearancePending` means
	 * *these coordinates are background pixels*; this one means *these millimetres are the ones
	 * you drew, and the object around them is no longer the object you drew them for*. A
	 * calibration clears the first and deliberately leaves this one alone — `CalibrateAsset`'s
	 * `rescaled` spreads the shape and names neither, which is what makes that true without a
	 * line of its own.
	 *
	 * **OPTIONAL in the type, unlike those three, and that is measured rather than stylistic.**
	 * `grep -rn "clearancePending:" src/ tests/` prints 61 construction sites across 41 files,
	 * most of them in suites this card does not own; a required field would make every one of
	 * them a compile error for a flag that reads `false` at all of them. That is `groups`' own
	 * argument one field up, and it costs the same thing: a reader asks `=== true` rather than
	 * reading a definite boolean.
	 *
	 * **Six reads carry that `=== true`, counted by `grep -rn "clearanceNeedsReview" src/` in this
	 * edit rather than remembered**: `validatePlacement` and the normalisation below, `scaleDesign`,
	 * `sameClearance` in `SetAssetClearance`, `shapeToPersistence` in the sidecar mapper, and
	 * `DesignerClearanceReview.vue`'s predicate. (The first draft of this sentence said "two", which
	 * is what the grep exists to stop.) Six two-word comparisons is not a case for an
	 * `assetGroups`-style accessor — that one exists because its callers each carried a FALLBACK ARM
	 * the validator can never take, and `=== true` has no arm at all.
	 *
	 * The SIDECAR still stores it as a definite boolean — `.default(false)` at schema v4, so an
	 * absent key is an older file and a present malformed one fails the read.
	 */
	readonly clearanceNeedsReview?: boolean;
	readonly anchor: Point;
	/** Radians, measured anticlockwise from +x, normalised to [0, 2π). */
	readonly facing: number;
	/** Interior linework, drawn in this order over the footprint (symbols spec, Decisions 1 and 4). */
	readonly details: readonly AssetDetail[];
	/**
	 * Shallow groups of graphic ids (AD04 §4). EDITING METADATA and nothing more: a group carries
	 * no coordinates and no z-order, so `details` above stays the one canonical draw order and a
	 * group's members remain visually interleaved with everything else until somebody reorders
	 * them deliberately (C06).
	 *
	 * Optional in the TYPE so every existing construction site stays valid and reads as no groups;
	 * `validateAssetShape` answers `[]` for an absent one, so a validated shape always has the
	 * array.
	 */
	readonly groups?: readonly AssetGroup[];
}

/**
 * One shallow group. `members` are detail ids — never the footprint, the clearance, the anchor,
 * the facing or another group (C05, C06). `label` is the renovator's own name for it, optional
 * because a group is useful before it is named.
 */
export interface AssetGroup {
	readonly id: string;
	readonly label?: string;
	readonly members: readonly string[];
}

/**
 * This shape's groups, which is `[]` for a shape that has none.
 *
 * **One function because `groups` is OPTIONAL in the type and always present after validation**, and
 * those two facts together had produced nine copies of `shape.groups ?? []` across the domain, the
 * Parts panel and the sidecar. Every one of them carried a fallback arm that `validateAssetShape`
 * can never take — it writes `groups: []` onto every shape it returns — so the arms were reachable
 * only from a hand-built literal, and each cost a branch it could not pay back.
 *
 * The optionality itself is deliberate and stays: it is what lets every construction site written
 * before groups existed go on compiling and read as no groups (AD04). What changes is that the
 * question is asked once.
 */
export function assetGroups(shape: AssetShape): readonly AssetGroup[] {
	return shape.groups ?? [];
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
export function dimensionsOf(footprint: CurvedPolygon): Result<Dimensions, GeometryError> {
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

/**
 * One spelling per direction: `[0, 2π)`, so a stored 2π and a stored 0 cannot differ.
 *
 * The final fold is `>= TAU`, not `=== TAU`: a hair below the +x axis (`-1e-17`) rounds,
 * once folded positive, to exactly `TAU` — below `TAU`'s own floating-point resolution —
 * and used to survive as a second spelling of zero. `-TAU` itself folds to `-0`, which
 * `folded < 0` reads as false (`-0 < 0` is false in JS), so it also needs the `=== 0` arm
 * rather than falling through as a non-zero positive angle.
 */
export function normaliseFacing(radians: number): number {
	if (!Number.isFinite(radians)) return 0;
	const folded = radians % TAU;
	const positive = folded < 0 ? folded + TAU : folded;
	return positive >= TAU || positive === 0 ? 0 : positive;
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
 * It also refuses the three states the per-attribute flag model makes incoherent: a
 * typed footprint marked pending, a pending flag on an absent clearance, and (AD14) a review
 * flag on an absent clearance. All three are REFUSALS rather than repairs, for the same reason
 * a two-vertex polygon is refused — no command can produce any of them, so one in a sidecar is
 * a hand edit, and quietly clearing the flag would suppress the unscaled warning over
 * placeholder-space geometry or report an unreviewed boundary as reviewed.
 *
 * Curved edges are checked for self-intersection only when an edge actually curves
 * (`validateCurvedBoundary`), so a straight outline gets exactly the validation it had
 * before curves existed.
 */
/**
 * The clearance's own half of `validateAssetShape`, split out for the complexity budget rather
 * than for taste: the shape validator answers eight questions and adding groups put its cognitive
 * score over the gate's threshold. Same rules, same two error codes, one caller.
 */
function validateClearance(clearance: CurvedPolygon | null): Result<CurvedPolygon | null, ValidationError> {
	if (clearance === null) return ok(null);
	const validated = createCurvedPolygon(clearance);
	if (isErr(validated)) return err(assetError('invalid-clearance', validated.error.message));
	return enclosesArea(validated.value)
		? ok(validated.value)
		: err(assetError('degenerate-clearance', 'A clearance must enclose an area; these vertices are collinear.'));
}

/**
 * The anchor, the facing and the three flag coherences — the questions that are about the
 * shape's own fields rather than about a polygon. Split from `validateAssetShape` for the
 * complexity budget the group check pushed it over.
 *
 * The count is three since AD14, and the third is `clearanceNeedsReview`'s: the two clearance
 * rules share a single `clearance !== null` early return rather than re-asking it, which is what
 * keeps the split's original complexity argument true.
 */
function validatePlacement(shape: AssetShape): Result<void, ValidationError> {
	if (!Number.isFinite(shape.anchor.x) || !Number.isFinite(shape.anchor.y)) {
		return err(assetError('invalid-anchor', 'An anchor must have finite coordinates.'));
	}
	if (!Number.isFinite(shape.facing)) {
		return err(assetError('invalid-facing', 'A facing must be a finite angle in radians.'));
	}
	if (shape.footprintOrigin === 'typed' && shape.footprintPending) {
		return err(assetError('typed-footprint-cannot-be-pending', 'A typed footprint is authored in millimetres and never awaits a scale.'));
	}
	if (shape.clearance !== null) return ok(undefined);
	if (shape.clearancePending) {
		return err(assetError('absent-clearance-cannot-be-pending', 'A shape with no clearance has no clearance coordinates awaiting a scale.'));
	}
	// The same refusal, the same argument and the same site as the one above (AD14-R1): no command
	// can produce it, so one in a sidecar is a hand edit, and quietly clearing the flag would
	// report a boundary nobody has reviewed as reviewed. A refusal, never a repair.
	//
	// **`clearancePending && clearanceNeedsReview` gets NO guard of its own, deliberately.** A
	// capture replaces the clearance and a calibration converts it, so the combination is
	// unreachable — and an unreachable guard costs a branch it can never pay back.
	return shape.clearanceNeedsReview === true
		? err(assetError('absent-clearance-cannot-need-review', 'A shape with no clearance has no boundary to review.'))
		: ok(undefined);
}

export function validateAssetShape(shape: AssetShape): Result<AssetShape, ValidationError> {
	const footprint = createCurvedPolygon(shape.footprint);
	if (isErr(footprint)) return err(assetError('invalid-footprint', footprint.error.message));
	if (!enclosesArea(footprint.value)) {
		return err(
			assetError(
				'degenerate-footprint',
				'A footprint must enclose an area; these vertices are collinear.',
			),
		);
	}
	const clearanceResult = validateClearance(shape.clearance);
	if (isErr(clearanceResult)) return clearanceResult;
	const clearance = clearanceResult.value;
	const placement = validatePlacement(shape);
	if (isErr(placement)) return placement;
	const details = validateDetails(shape.details);
	if (isErr(details)) return details;
	const groups = validateGroups(shape.groups, details.value);
	if (isErr(groups)) return groups;
	return ok({
		...shape,
		footprint: footprint.value,
		clearance,
		// NORMALISED here for `groups` reason one field over: the type is optional so that 61
		// existing construction sites stay valid, and a shape that has been through this function
		// always carries the definite boolean anyway — which is what lets the sidecar's round trip
		// compare a written shape against the one it reads back.
		clearanceNeedsReview: shape.clearanceNeedsReview === true,
		anchor: { x: shape.anchor.x, y: shape.anchor.y },
		facing: normaliseFacing(shape.facing),
		details: details.value,
		groups: groups.value,
	});
}

/**
 * Shallow groups of GRAPHIC ids (C06, AD04 §4), checked against the details that survived
 * validation rather than against the raw input, so a group cannot come out pointing at a detail
 * the step above refused.
 *
 * **Every fault is a refusal and not a repair.** Dropping a dangling member or de-duplicating a
 * membership would leave the file saying one thing and the loaded shape another, which is the
 * direction C06 names: *reject dangling, duplicated or cyclic membership rather than repairing
 * it silently.* Cycles and nesting need no check of their own — a group holds detail ids and a
 * group id is not one, so neither state is representable.
 *
 * What a group may NOT hold is as load-bearing as what it may: the footprint, the clearance, the
 * anchor and the facing are the shape's own special parts, and a bulk grouping that absorbed one
 * would make "select the whole object" and "select this group" the same act (C05).
 */
function validateGroups(
	groups: readonly AssetGroup[] | undefined,
	details: readonly AssetDetail[],
): Result<AssetGroup[], ValidationError> {
	if (groups === undefined) return ok([]);
	const known = new Set(details.map((detail) => detail.id));
	const seenGroups = new Set<string>();
	const claimed = new Set<string>();
	const validated: AssetGroup[] = [];
	for (const group of groups) {
		if (group.id === '' || seenGroups.has(group.id)) {
			return err(assetError('invalid-group-id', `Every group needs its own non-empty id; got "${group.id}".`));
		}
		seenGroups.add(group.id);
		const members = validateMembers(group, known, claimed);
		if (isErr(members)) return members;
		validated.push({ id: group.id, ...(group.label === undefined ? {} : { label: group.label }), members: members.value });
	}
	return ok(validated);
}

/**
 * One group's membership, against the graphics that exist and the ones already claimed. Split from
 * the loop above for the complexity budget; `claimed` is mutated as it goes, which is what makes
 * "a graphic belongs to at most one group" a check across the whole list rather than within one.
 */
function validateMembers(
	group: AssetGroup,
	known: ReadonlySet<string>,
	claimed: Set<string>,
): Result<string[], ValidationError> {
	if (group.members.length === 0) {
		return err(assetError('empty-group', `Group "${group.id}" has no members; delete it rather than keeping it empty.`));
	}
	for (const member of group.members) {
		if (!known.has(member)) {
			return err(assetError('dangling-group-member', `Group "${group.id}" names "${member}", which is not a graphic on this shape.`));
		}
		if (claimed.has(member)) {
			return err(assetError('overlapping-groups', `"${member}" is already in another group; a graphic belongs to at most one.`));
		}
		claimed.add(member);
	}
	return ok([...group.members]);
}

/**
 * Every shape starts here: typed origin, unpending, centred anchor, facing +x, no clearance —
 * for a footprint that already IS a polygon rather than two numbers still to become one. A
 * traced outline and (via `shapeFromDimensions` below) a typed rectangle both start here, so
 * "every shape starts here" is one function rather than one sentence describing two.
 *
 * **Composed and then VALIDATED**, so this constructor and `validateAssetShape` cannot disagree
 * about what a valid shape is — for the reason below and for every future rule neither of them
 * has yet. It is one call rather than a third copy of the area rule, which is what the
 * alternative would have been.
 */
export function shapeFromOutline(points: readonly Point[]): Result<AssetShape, ValidationError> {
	return validateAssetShape({
		footprint: { points },
		footprintOrigin: 'typed',
		footprintPending: false,
		clearancePending: false,
		anchorPending: false,
		clearance: null,
		anchor: { x: 0, y: 0 },
		facing: 0,
		details: [],
	});
}

/**
 * A typed width and depth, turned into the rectangle `shapeFromOutline` above validates. The two
 * constructors are one call apart rather than two copies of the same literal, so they cannot
 * drift about what "every shape starts here" means.
 *
 * The disagreement was real before they shared this call: at `Number.MIN_VALUE * 2` the
 * rectangle has four DISTINCT vertices whose shoelace products all underflow, so
 * `footprintFromDimensions` answers `ok` for a polygon enclosing exactly zero area and this used
 * to hand back a shape the validator refuses. The translation in `signedAreaSum` cannot help —
 * that addresses cancellation between large terms, and this is underflow of small ones.
 *
 * Only ONE of `validateAssetShape`'s refusals is reachable from here, which is why this is not a
 * dead guard: the shape is built `typed` and not pending, with no clearance and a finite anchor
 * and facing, so degeneracy is the only arm — and it is live.
 *
 * `footprintFromDimensions` is deliberately NOT given the same rule. It answers a `Polygon`, and
 * a degenerate polygon is a legal one (SDD §26 files that under "Future"); its own docblock
 * states the one-gate-per-question rule a third guard there would break, and its single `src/`
 * caller validates the whole shape downstream anyway.
 */
export function shapeFromDimensions(width: number, depth: number): Result<AssetShape, ValidationError> {
	const footprint = footprintFromDimensions(width, depth);
	if (isErr(footprint)) return footprint;
	return shapeFromOutline(footprint.value.points);
}
