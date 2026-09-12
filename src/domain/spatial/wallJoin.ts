import type { Point } from '../../core/geometry/Point';
import { circularEdgeIntersections } from '../../core/geometry/circularIntersections';
import { alongWall, projectOntoWall, wallLength, wallTangent, type Wall } from './Structure';

/** A point on a wall's BODY where a new wall may join it, cutting the host there when saved. */
export interface WallJoin { readonly wallId: string; readonly offset: number; readonly point: Point; readonly perpendicular: boolean }
/**
 * `point` is the cursor (already Shift-constrained when `ray` is given); `from` the chain's last
 * point; `ray` the constrained point itself, which lies on the ray from `from` — present only
 * while Shift is held, when the ray's intersection with the wall replaces the projected candidates
 * so the 15° step stays exact rather than drifting by a projection.
 */
export interface JoinQuery { readonly walls: readonly Wall[]; readonly point: Point; readonly tolerance: number; readonly from?: Point; readonly ray?: Point }

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const perpendicularTo = (wall: Wall, offset: number, from: Point, to: Point): boolean => {
	const tangent = wallTangent(wall, offset), length = distance(from, to);
	return length > 0 && Math.abs((tangent.x * (to.x - from.x) + tangent.y * (to.y - from.y)) / length) <= 1e-6;
};

/** `offset` on `wall` as a join, or null within `tolerance` of either end: an end is an endpoint snap, never a cut. */
function joinAt(wall: Wall, offset: number, tolerance: number, perpendicular: boolean): WallJoin | null {
	const rounded = Math.round(offset);
	if (rounded <= tolerance || rounded >= wallLength(wall) - tolerance) return null;
	return { wallId: wall.id, offset: rounded, point: alongWall(wall, rounded), perpendicular };
}

/** Shift held: where the ray from `from` through `ray`, carried `tolerance` further, crosses the wall. */
function rayJoin(wall: Wall, query: JoinQuery, from: Point, ray: Point): WallJoin | null {
	const reach = distance(from, ray);
	if (reach === 0) return null;
	const end = { x: ray.x + (ray.x - from.x) / reach * query.tolerance, y: ray.y + (ray.y - from.y) / reach * query.tolerance };
	const hits = circularEdgeIntersections({ start: from, end, bulge: 0 }, { start: wall.start, end: wall.end, bulge: wall.bulge ?? 0 });
	let nearest: Point | undefined;
	for (const hit of hits.points) if (distance(hit, query.point) <= query.tolerance && (!nearest || distance(hit, query.point) < distance(nearest, query.point))) nearest = hit;
	if (!nearest) return null;
	const offset = projectOntoWall(wall, nearest).offset;
	return joinAt(wall, offset, query.tolerance, perpendicularTo(wall, offset, from, ray));
}

/** No Shift: the foot of the perpendicular from `from` when the cursor is near it, else the nearest body point. */
function freeJoin(wall: Wall, query: JoinQuery): WallJoin | null {
	if (query.from) {
		const foot = projectOntoWall(wall, query.from);
		if (foot.fraction > 0 && foot.fraction < 1 && distance(foot.point, query.point) <= query.tolerance) {
			const candidate = joinAt(wall, foot.offset, query.tolerance, true);
			if (candidate) return candidate;
		}
	}
	const nearest = projectOntoWall(wall, query.point);
	return nearest.distance <= query.tolerance ? joinAt(wall, nearest.offset, query.tolerance, false) : null;
}

/** The wall body the cursor lands on, or null. A perpendicular foot beats a nearer plain point, so a right angle is not lost to a closer wall. */
export function resolveWallJoin(query: JoinQuery): WallJoin | null {
	let best: { join: WallJoin; away: number } | null = null;
	for (const wall of query.walls) {
		const candidate = query.from && query.ray ? rayJoin(wall, query, query.from, query.ray) : freeJoin(wall, query);
		if (!candidate) continue;
		const away = distance(candidate.point, query.point);
		if (!best || (candidate.perpendicular && !best.join.perpendicular) || (candidate.perpendicular === best.join.perpendicular && away < best.away)) best = { join: candidate, away };
	}
	return best?.join ?? null;
}
