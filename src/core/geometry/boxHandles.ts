import type { BoundingBox } from './BoundingBox';
import type { Point } from './Point';

/** Per box handle, clockwise from the top-left: which of min, middle, max it takes on each axis. */
const BOX_COLUMN = [0, 1, 2, 2, 2, 1, 0, 0] as const;
const BOX_ROW = [0, 0, 0, 1, 2, 2, 2, 1] as const;

/** Eight handles: four corners and four side midpoints. */
export const BOX_HANDLE_COUNT = BOX_COLUMN.length;

/**
 * Where box handle `index` sits — and, asked for `(index + 4) % 8`, the corner or side midpoint a
 * resize from `index` holds still, which is why the drag arithmetic asks this rather than a copy.
 * Shared by the asset designer's Transform mode and the plan editor's transform box.
 */
export function boxHandlePoint(box: BoundingBox, index: number): Point {
	return {
		x: [box.min.x, (box.min.x + box.max.x) / 2, box.max.x][BOX_COLUMN[index]],
		y: [box.min.y, (box.min.y + box.max.y) / 2, box.max.y][BOX_ROW[index]],
	};
}

/**
 * The factors and fixed point of a box-handle resize. The moved handle follows `to`, and the handle
 * opposite it holds still, so a factor is the new span over the old one along each axis the handle
 * moves — a side handle's other axis is exactly 1, because both midpoints are computed identically.
 * Dragged past the fixed side, a factor goes non-positive; the caller refuses it.
 *
 * Shift keeps proportions: both factors become whichever strays further from 1, for a side handle
 * as for a corner.
 */
export function boxResize(
	box: BoundingBox,
	index: number,
	to: Point,
	shift: boolean,
): { readonly factors: { readonly sx: number; readonly sy: number }; readonly origin: Point } {
	const handle = boxHandlePoint(box, index);
	const origin = boxHandlePoint(box, (index + 4) % 8);
	const sx = handle.x === origin.x ? 1 : (to.x - origin.x) / (handle.x - origin.x);
	const sy = handle.y === origin.y ? 1 : (to.y - origin.y) / (handle.y - origin.y);
	if (!shift) return { factors: { sx, sy }, origin };
	const uniform = Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy;
	return { factors: { sx: uniform, sy: uniform }, origin };
}
