import type { Point } from '../../../core/geometry/Point';
import { normalised } from '../tools/draw-room-tool';
import { polygonForRect } from '../add/room-draft-store';

/** How an item's outline is drawn (2026-09-13 item modes spec §A): one rectangle drag, or corner by corner. */
export type ObjectShapeMode = 'rectangle' | 'free';
/** What the task bar and details say while an item or a hatched area is drawn as one rectangle drag. */
export function rectangleInstruction(kind: string): 'editor.drafting.banner.hatch-rectangle' | 'editor.element.banner.object-rectangle' {
	return kind === 'hatch' ? 'editor.drafting.banner.hatch-rectangle' : 'editor.element.banner.object-rectangle';
}

/**
 * The rectangle two opposite corners span, clockwise from the top-left; `null` when it
 * encloses no area. Built from the room tool's own helpers (spec §A) rather than a second
 * normalisation: `normalised` turns the drag into a `RoomRect`, and `polygonForRect` turns
 * that into the same clockwise-from-min-corner quadrilateral the room draft draws.
 */
export function rectangleCorners(a: Point, b: Point): Point[] | null {
	const rect = normalised(a, b);
	if (rect.width === 0 || rect.depth === 0) return null;
	const polygon = polygonForRect(rect);
	return polygon === null ? null : [...polygon.points];
}

/**
 * Free-form to rectangle: the outline's bounding box, or `null` when it spans no area.
 * An empty outline needs no separate refusal: `Math.min()`/`Math.max()` over `[]` answer
 * `Infinity`/`-Infinity`, which `rectangleCorners` turns into non-finite corners that
 * `polygonForRect` already refuses, so the result is `null` through that same path.
 */
export function boundingRectangle(points: readonly Point[]): Point[] | null {
	const xs = points.map(point => point.x), ys = points.map(point => point.y);
	return rectangleCorners({ x: Math.min(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.max(...ys) });
}

/**
 * An item outline as a library footprint (spec §B): moved so the middle of its bounding box is the origin —
 * the convention `footprintFromDimensions` uses, which makes the default anchor the middle of the object —
 * with that middle in world millimetres. The centre is rounded to whole millimetres, so
 * `centre + footprint[i]` equals the drawn point exactly (the subtraction is of that rounded
 * centre) — the footprint vertices themselves stay integers only when the outline's own
 * points already are.
 */
export function centredFootprint(points: readonly Point[]): { readonly centre: Point; readonly footprint: Point[] } {
	const xs = points.map(point => point.x), ys = points.map(point => point.y);
	const centre = { x: Math.round((Math.min(...xs) + Math.max(...xs)) / 2), y: Math.round((Math.min(...ys) + Math.max(...ys)) / 2) };
	return { centre, footprint: points.map(point => ({ x: point.x - centre.x, y: point.y - centre.y })) };
}
