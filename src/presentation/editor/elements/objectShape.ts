import type { Point } from '../../../core/geometry/Point';

/** How an item's outline is drawn (2026-09-13 item modes spec §A): one rectangle drag, or corner by corner. */
export type ObjectShapeMode = 'rectangle' | 'free';

/** The rectangle two opposite corners span, clockwise from the top-left; `null` when it encloses no area. */
export function rectangleCorners(a: Point, b: Point): Point[] | null {
	const left = Math.min(a.x, b.x), top = Math.min(a.y, b.y), right = Math.max(a.x, b.x), bottom = Math.max(a.y, b.y);
	if (left === right || top === bottom) return null;
	return [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
}

/** Free-form to rectangle: the outline's bounding box, or `null` when it spans no area. */
export function boundingRectangle(points: readonly Point[]): Point[] | null {
	if (points.length === 0) return null;
	const xs = points.map(point => point.x), ys = points.map(point => point.y);
	return rectangleCorners({ x: Math.min(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.max(...ys) });
}

/**
 * An item outline as a library footprint (spec §B): moved so the middle of its bounding box is the origin —
 * the convention `footprintFromDimensions` uses, which makes the default anchor the middle of the object —
 * with that middle in world millimetres. Rounded to whole millimetres so the placement anchor and every
 * footprint vertex stay integers and `centre + footprint` is the drawn outline exactly.
 */
export function centredFootprint(points: readonly Point[]): { readonly centre: Point; readonly footprint: Point[] } {
	const xs = points.map(point => point.x), ys = points.map(point => point.y);
	const centre = { x: Math.round((Math.min(...xs) + Math.max(...xs)) / 2), y: Math.round((Math.min(...ys) + Math.max(...ys)) / 2) };
	return { centre, footprint: points.map(point => ({ x: point.x - centre.x, y: point.y - centre.y })) };
}
