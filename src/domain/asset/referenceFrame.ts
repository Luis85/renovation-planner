import type { BoundingBox } from '../../core/geometry/BoundingBox';
import type { CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import { hasCurves } from '../../core/geometry/CurvedPolygon';
import type { Point } from '../../core/geometry/Point';
import { boundingBoxOf, coincident, rotate } from '../../core/geometry/operations';

/**
 * The FACING FRAME (AD12, contracts C04 and C07): the two placement points an asset can be
 * anchored at without typing coordinates, the four sides a rectangular clearance helper
 * generates against, and the name of the direction the object faces.
 *
 * **Every direction here is derived from `AssetShape.facing` and from nothing else.** C04 is
 * explicit that direction labels must agree with actual placement and are never copied from a
 * mockup, and AD01 §3 names `set-facing-tool.ts` as the shipped authority. That tool writes
 * `Math.atan2(head.y - origin.y, head.x - origin.x)` for a drag, and `anchorLayer.facingArrow`
 * draws the arrow at `(cos facing, sin facing)` from the anchor with the y term ADDED — so the
 * front of the object is exactly where the arrow points, and this module rotates INTO that
 * frame rather than restating any of it.
 *
 * **Left and right are the one thing neither of those two states, so the derivation is written
 * down here and pinned by a fixture.** The designer draws a plan seen from above with +y down
 * the screen. An object whose arrow points along +x has its own left toward −y (the top of the
 * sheet), the way a figure walking east on a map has north on its left. In angles that is
 * `facing − π/2`, which is what `QUARTER_LEFT` below spells and what
 * `designerReferenceFrame.test.ts` checks against `facingTip` — the point the arrow actually
 * reaches — rather than against this sentence.
 *
 * **It lives beside the components that use it rather than in `domain/asset/`, and that is a
 * LEASE fact rather than a layering judgement.** AD12's file lease excludes every existing
 * module under `domain/asset/`, and a shared placement frame is the kind of pure rule that
 * belongs beside `shapeEdits.ts`; moving it there is recorded as an integration change request
 * in AD12's report. Nothing here imports Vue, so the move is a rename.
 */

/** Where an asset can be anchored without typing two numbers. `custom` is the readout, never an input. */
export type AnchorPreset = 'centre' | 'back-centre';

/** Which quarter turn the front points along: 0 = +x, 1 = +y, 2 = −x, 3 = −y. */
export type FacingQuarter = 0 | 1 | 2 | 3;

const ORIGIN: Point = { x: 0, y: 0 };
const QUARTER_TURN = Math.PI / 2;

/**
 * How near a cardinal a facing has to be to be treated as one. A drag lands on a quarter turn
 * only through `SnapService.snapDirection`, whose 15-degree step is computed rather than
 * tabulated, so exact equality would refuse a facing the user really did snap. A tenth of a
 * microradian is far below anything a pointer can express and far above the 1e-16 that
 * trigonometry leaves behind.
 */
const CARDINAL_TOLERANCE_RAD = 1e-7;

/** The unit vectors of the four quarters, and of the LEFT of each — see the module docblock. */
const QUARTER_FRONT: readonly (readonly [number, number])[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const QUARTER_LEFT: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/**
 * Which quarter turn this facing is, or `null` for one that points between two of them.
 *
 * `null` is not a failure: it is what makes the four-side clearance helper WITHHELD rather
 * than offered with labels it cannot honour, which is C07's rule about a helper that is valid
 * only for supported geometry, met at the direction half.
 *
 * **A facing just UNDER a full turn is quarter 0**, which the loop alone would miss.
 * `validateAssetShape` folds the angle into `[0, 2π)`, so a drag a hair anticlockwise of due
 * east is stored as `2π − ε` rather than as `−ε`; without the fold below, the helper would
 * vanish for a front the user can see pointing along the axis.
 */
export function facingQuarter(facing: number): FacingQuarter | null {
	const folded = facing >= 2 * Math.PI - CARDINAL_TOLERANCE_RAD ? 0 : facing;
	for (const quarter of [0, 1, 2, 3] as const) {
		const difference = Math.abs(folded - quarter * QUARTER_TURN);
		if (difference <= CARDINAL_TOLERANCE_RAD) return quarter;
	}
	return null;
}

/**
 * The footprint's extent measured along the facing rather than along the axes: rotate the
 * outline by `-facing` so the front lies on +x, measure, and the caller reads min as back and
 * max as front.
 *
 * `boundingBoxOf` is what does the measuring, so an ARC's reach counts — a footprint whose
 * front is a semicircle has its front centre on the bulge and not on the chord.
 *
 * `null` is `boundingBoxOf`'s own refusal passed on: an outline with no points, a non-finite
 * coordinate, a bulge that describes no arc. A validated `AssetShape` can carry none of those,
 * which is why the arm is driven from a hand-built polygon in the unit test rather than
 * through a shape.
 */
function facingBox(footprint: CurvedPolygon, facing: number): BoundingBox | null {
	const measured = boundingBoxOf(rotate(footprint, -facing, ORIGIN));
	return measured.ok ? measured.value : null;
}

/**
 * Where a preset would put the anchor, in world millimetres, or `null` where the footprint
 * cannot be measured.
 *
 * `centre` is the middle of that facing-frame box and `back-centre` is the middle of its BACK
 * edge — opposite the front by construction, since the two are the `min` and `max` ends of the
 * same axis. That is AD12's second acceptance criterion made structural rather than asserted:
 * there is no second derivation for a rotation or a mirror to disagree with.
 */
export function anchorPresetPoint(footprint: CurvedPolygon, facing: number, preset: AnchorPreset): Point | null {
	const box = facingBox(footprint, facing);
	if (box === null) return null;
	const across = (box.min.y + box.max.y) / 2;
	const along = preset === 'centre' ? (box.min.x + box.max.x) / 2 : box.min.x;
	return rotate({ x: along, y: across }, facing, ORIGIN);
}

/**
 * Which preset the anchor is sitting on right now, or `null` for a point the user placed
 * themselves — the "custom" the card asks for, spelled as an absence so no third preset has to
 * exist to mean "none of them".
 *
 * Compared with `coincident`, the domain's own 1e-6 mm tolerance, because the round trip
 * through two rotations of a non-cardinal facing does not return bit-identical coordinates.
 */
export function currentAnchorPreset(footprint: CurvedPolygon, facing: number, anchor: Point): AnchorPreset | null {
	for (const preset of ['centre', 'back-centre'] as const) {
		const point = anchorPresetPoint(footprint, facing, preset);
		if (point !== null && coincident(point, anchor)) return preset;
	}
	return null;
}

/**
 * The footprint's box if it is an axis-aligned rectangle, `null` otherwise — the GEOMETRY half
 * of C07's "valid only for supported rectangular geometry".
 *
 * Refused rather than approximated for anything else, which is the same sentence's other half:
 * four numeric setbacks are not what an arbitrary curved outline means, so the helper is
 * withheld instead of inferring them from a bounding box that throws the outline away.
 */
export function rectangularFootprint(footprint: CurvedPolygon): BoundingBox | null {
	const { points } = footprint;
	if (points.length !== 4) return null;
	if (hasCurves(footprint)) return null;
	const xs = points.map((point) => point.x);
	const ys = points.map((point) => point.y);
	const box = { min: { x: Math.min(...xs), y: Math.min(...ys) }, max: { x: Math.max(...xs), y: Math.max(...ys) } };
	// Four points spanning that box, each on two of its edges, is the whole of what makes it a
	// rectangle: a quadrilateral with a vertex off the extremes has a point inside the span.
	const onEdges = points.every(
		(point) => (point.x === box.min.x || point.x === box.max.x) && (point.y === box.min.y || point.y === box.max.y),
	);
	if (!onEdges || box.min.x === box.max.x || box.min.y === box.max.y) return null;
	return box;
}

/** How far a generated boundary stands off each side of the footprint, in millimetres. */
export interface ClearanceSetbacks {
	readonly front: number;
	readonly back: number;
	readonly left: number;
	readonly right: number;
}

/**
 * The rectangle a four-side helper GENERATES around `box` — never a reading of an existing
 * clearance, which is C07's "do not infer four setbacks from an arbitrary curved polygon" met
 * at the only door that could break it.
 *
 * Each side is expanded along its own unit vector rather than by four hard-coded quarter
 * cases, so the left-hand rule the module docblock derives is stated once and the other three
 * sides follow from it.
 */
export function clearanceRectangle(
	box: BoundingBox,
	quarter: FacingQuarter,
	setbacks: ClearanceSetbacks,
): readonly Point[] {
	const [fx, fy] = QUARTER_FRONT[quarter];
	const [lx, ly] = QUARTER_LEFT[quarter];
	let { x: minX, y: minY } = box.min;
	let { x: maxX, y: maxY } = box.max;
	const sides: readonly (readonly [number, number, number])[] = [
		[fx, fy, setbacks.front],
		[-fx, -fy, setbacks.back],
		[lx, ly, setbacks.left],
		[-lx, -ly, setbacks.right],
	];
	for (const [dx, dy, amount] of sides) {
		if (dx === 1) maxX += amount;
		else if (dx === -1) minX -= amount;
		else if (dy === 1) maxY += amount;
		else minY -= amount;
	}
	return [
		{ x: minX, y: minY },
		{ x: maxX, y: minY },
		{ x: maxX, y: maxY },
		{ x: minX, y: maxY },
	];
}
