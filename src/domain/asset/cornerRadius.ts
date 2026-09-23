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
	const outline = roundedRect(box.width, box.depth, radius, box.centre.x, box.centre.y);
	return validateAssetShape({ ...shape, details: shape.details.map((item) => (item.id === id ? { ...detail, kind: 'closed', outline } : item)) });
}
