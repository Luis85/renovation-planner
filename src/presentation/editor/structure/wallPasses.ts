import type { Point } from '../../../core/geometry/Point';
import { arcPolyline } from '../../../core/geometry/curvePolyline';
import { samePoint, type Wall } from '../../../domain/spatial/Structure';

export interface WallPasses { readonly edge: number[]; readonly body: number[] }

/**
 * One wall's two stroke passes as flat Konva point arrays. Both are butt-capped, so each is
 * carried past the wall's ends along the END TANGENT — the direction of the polyline's first
 * or last segment, which is what lets a curved wall through `arcPolyline` take the same rule:
 * an endpoint other walls share moves the body by the largest half thickness among THOSE walls
 * — the joined wall's outer face, never this wall's own half, which would poke a thick wall past
 * a thin one's face — and the edge `1 / zoom` further (the joint's outer quadrant); a free
 * endpoint moves only the edge, by `1 / zoom` (the end's 1 px dark cap). `StructureLayer.vue`
 * carries the argument and its ceiling.
 */
export function wallPasses(wall: Wall, walls: readonly Wall[], zoom: number): WallPasses {
	const line = arcPolyline({ ...wall, bulge: wall.bulge ?? 0 }, 0.25 / zoom);
	const joint = (point: Point): number => Math.max(0, ...walls
		.filter(other => other.id !== wall.id && (samePoint(other.start, point) || samePoint(other.end, point)))
		.map(other => other.thickness / 2));
	const cap = 1 / zoom, last = line.length - 1, atStart = joint(wall.start), atEnd = joint(wall.end);
	const pass = (start: number, end: number): number[] =>
		[past(line[1], line[0], start), ...line.slice(1, last), past(line[last - 1], line[last], end)].flatMap(point => [point.x, point.y]);
	return { edge: pass(atStart + cap, atEnd + cap), body: pass(atStart, atEnd) };
}

/** `to`, carried `by` further along the direction it was reached from `from`. */
function past(from: Point, to: Point, by: number): Point {
	const length = Math.hypot(to.x - from.x, to.y - from.y);
	return by && length ? { x: to.x + (to.x - from.x) / length * by, y: to.y + (to.y - from.y) / length * by } : to;
}
