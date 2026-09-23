import type { ValidationError } from '../../core/errors/AppError';
import type { Point } from '../../core/geometry/Point';
import { err, type Result } from '../../core/result/Result';
import { assetError } from './Asset.errors';
import type { AssetDetail } from './AssetDetail';
import { validateAssetShape, type AssetShape } from './AssetShape';
import { QUARTER_BULGE, roundedRect } from './presets/presetGeometry';
import { partNotFound } from './shapeEdits';

/**
 * A rounded rectangle's corner radius, READ BACK from the geometry rather than stored (AD18-R16 Task 12;
 * AD11 item 2: *"store parameter intent only if subsequent edits can maintain it"*). Nothing new is
 * persisted: the radius is whatever makes `roundedRect` reproduce the stored points and bulges.
 *
 * **The question is "does rebuilding it give back exactly this outline", not "does it look rounded".**
 * The box is the points' own extent, the radius is read off one straight side, and `roundedRect` is asked
 * for that box and radius; the outline matches only if every point and every bulge agrees. So each edit
 * that leaves the shape somewhere one radius does not describe is a `null` without a rule of its own — a
 * width or depth typed alone keeps each corner's bulge over a chord that is no longer square (C04's
 * stated approximation), a rotation off the axes leaves the box, a moved corner or a bent edge breaks one
 * term. A quarter turn, a translation and a uniform scale keep it one, and read back as one.
 *
 * The four even starting points are the only rotations of the ring the check tries: `roundedRect` puts a
 * straight side at every even index, a quarter turn moves which side is on top without renumbering, and
 * nothing in the designer reverses a winding (there is no mirror edit), so a reversed ring is not tried.
 */
interface RoundedBox {
	readonly width: number;
	readonly depth: number;
	readonly centre: Point;
	readonly radius: number;
}

/** Relative to the box: float noise from a move or a quarter turn is ~1e-13 of the coordinates. */
const TOLERANCE = 1e-9;

const near = (a: number, b: number, tolerance: number): boolean => Math.abs(a - b) <= tolerance;

function roundedBoxOf(detail: AssetDetail): RoundedBox | null {
	if (detail.kind === 'open') return null;
	const { points, bulges } = detail.outline;
	if (points.length !== 8 || bulges === undefined) return null;
	const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
	const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
	const box = { width: right - left, depth: bottom - top, centre: { x: (left + right) / 2, y: (top + bottom) / 2 } };
	const tolerance = TOLERANCE * Math.max(box.width, box.depth);
	for (let start = 0; start < 8; start += 2) {
		const radius = points[start].x - left;
		const expected = roundedRect(box.width, box.depth, radius, box.centre.x, box.centre.y).points;
		const matches = expected.every((point, index) => {
			const at = (start + index) % 8;
			return near(points[at].x, point.x, tolerance) && near(points[at].y, point.y, tolerance) && near(bulges[at], index % 2 === 0 ? 0 : QUARTER_BULGE, TOLERANCE);
		});
		if (matches) return { ...box, radius };
	}
	return null;
}

/** The corner radius of a graphic that IS a rounded rectangle, or `null` for anything one radius does not describe. */
export const cornerRadiusOf = (detail: AssetDetail): number | null => roundedBoxOf(detail)?.radius ?? null;

/**
 * The largest WHOLE-millimetre radius `setCornerRadius` accepts for a box: strictly under half the shorter
 * side, since at exactly half two of the eight points coincide. Whole because it is what the inspector's
 * slider can reach (AD18-R17), and what a resize clamps to, so a clamped radius lands on the slider's end.
 */
const largestWholeRadius = (width: number, depth: number): number => Math.ceil(Math.min(width, depth) / 2) - 1;

/** A rounded rectangle's radius and the largest whole-millimetre one its box accepts, or `null` as `cornerRadiusOf`. */
export function roundedCorner(detail: AssetDetail): { readonly radius: number; readonly largest: number } | null {
	const box = roundedBoxOf(detail);
	return box === null ? null : { radius: box.radius, largest: largestWholeRadius(box.width, box.depth) };
}

/** `detail` rebuilt as the rounded rectangle `box` describes, keeping its id, name, line and pending flag, and the whole shape validated. */
function rebuilt(shape: AssetShape, detail: AssetDetail, box: RoundedBox): Result<AssetShape, ValidationError> {
	const outline = roundedRect(box.width, box.depth, box.radius, box.centre.x, box.centre.y);
	return validateAssetShape({ ...shape, details: shape.details.map((item) => (item.id === detail.id ? { ...detail, kind: 'closed', outline } : item)) });
}

/**
 * A Width or Depth edit that keeps a rounded rectangle one (AD18-R17): the box takes `target` along `axis`
 * about its own centre, and the radius is kept where the new box has room for it and clamped to the largest
 * whole millimetre under half the new shorter side where it has not. ONE whole-shape edit, and nothing
 * stored — AD11 item 2's *"store parameter intent only if subsequent edits can maintain it"*, this being
 * the subsequent edit that maintains it.
 *
 * **`min(old radius, half the new shorter side)` is what was asked, and exactly half is refused**, for
 * `setCornerRadius`'s own reason: two points coincide and the outline is self-intersecting. The clamp is
 * the slider's end instead, and is taken ONLY when the old radius no longer fits under half — a non-whole
 * radius that still fits (150.4 on a 301 side) is kept exactly, never rounded down to a whole millimetre.
 *
 * `null` means "not mine": the graphic is missing, is no rounded rectangle (a stretched one, one turned off
 * the axes), or no whole-millimetre radius fits the new box (a target of 2 mm or less, zero or negative).
 * The caller — `resizeToExtent`, which every door typing a Width or Depth goes through — then resizes as it
 * always has, which is also where a missing part or a bad extent is refused. A rounded rectangle's extent
 * is its point box — its quarter arcs are tangent to the sides — so `target` is the curve-aware extent the
 * inspector's field and the canvas's dimension label show.
 *
 * The canvas's HANDLE resize does not come here, deliberately: it previews a non-uniform scale
 * (`resizeBox`), so committing a rebuilt rounded rectangle would disagree with its own preview, and
 * AD18-R17 covers Width/Depth edits only (recorded by the integrator as an open item).
 */
export function resizeRoundedRect(shape: AssetShape, id: string, axis: 'width' | 'depth', target: number): Result<AssetShape, ValidationError> | null {
	const detail = shape.details.find((found) => found.id === id);
	const box = detail === undefined ? null : roundedBoxOf(detail);
	if (detail === undefined || box === null) return null;
	const [width, depth] = axis === 'width' ? [target, box.depth] : [box.width, target];
	const radius = box.radius < Math.min(width, depth) / 2 ? box.radius : largestWholeRadius(width, depth);
	return radius > 0 ? rebuilt(shape, detail, { width, depth, radius, centre: box.centre }) : null;
}

/**
 * The rounded rectangle `id` names, rebuilt about the same box with `radius` — ONE whole-shape edit, so
 * the inspector's field writes it as one undo entry through `editShape`.
 *
 * The range is (0, half the shorter side), open at BOTH ends. The brief asked for the half to be allowed;
 * at exactly half two of the eight points coincide and `createCurvedPolygon` refuses the outline as
 * self-intersecting, so the code overrules it — and refusing it here names the rule the user broke rather
 * than an edge they cannot see.
 */
export function setCornerRadius(shape: AssetShape, id: string, radius: number): Result<AssetShape, ValidationError> {
	const detail = shape.details.find((found) => found.id === id);
	if (detail === undefined) return err(partNotFound({ kind: 'detail', id }));
	const box = roundedBoxOf(detail);
	if (box === null) return err(assetError('not-rounded-rectangle', 'This graphic is not a rounded rectangle, so it has no corner radius.'));
	if (!(radius > 0 && radius < Math.min(box.width, box.depth) / 2)) {
		return err(assetError('corner-radius-out-of-range', `A corner radius must be more than 0 and under half the shorter side; got ${String(radius)}.`));
	}
	return rebuilt(shape, detail, { ...box, radius });
}
