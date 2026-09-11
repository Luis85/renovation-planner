import type { Point } from '../../../core/geometry/Point';
import { arcPolyline } from '../../../core/geometry/curvePolyline';
import { samePoint, type Wall } from '../../../domain/spatial/Structure';

/** One RUN of walls and its two stroke passes, as flat Konva point arrays. */
export interface WallPasses { readonly id: string; readonly thickness: number; readonly closed: boolean; readonly edge: number[]; readonly body: number[] }

interface RunEnd { readonly wall: Wall; readonly point: Point }

const other = (wall: Wall, point: Point): Point => samePoint(wall.start, point) ? wall.end : wall.start;
const flat = (points: readonly Point[]): number[] => points.flatMap(p => [p.x, p.y]);
const touching = (walls: readonly Wall[], point: Point): Wall[] => walls.filter(wall => samePoint(wall.start, point) || samePoint(wall.end, point));
/** The largest half thickness among the OTHER walls at `point`; 0 at a free end. */
const joint = (walls: readonly Wall[], wall: Wall, point: Point): number => Math.max(0, ...touching(walls, point).filter(joined => joined !== wall).map(joined => joined.thickness / 2));

/**
 * The walls as runs: walls meeting end to end, exactly two at a joint and equally thick, are
 * chained into one polyline, so Konva's mitre join draws their corner exactly at any angle, and a
 * run that comes back to its start is `closed`, mitred there too. A run's open ends are butt-
 * capped, so each is carried past its end along the END TANGENT — the direction of the polyline's
 * first or last segment, which lets a curved wall through `arcPolyline` take the same rule: an
 * endpoint other walls share (a T, or a change of thickness) moves the body by the largest half
 * thickness among THOSE walls — the joined wall's outer face, never this wall's own half, which
 * would poke a thick wall past a thin one's face — and the edge `1 / zoom` further; a free end
 * moves only the edge, by `1 / zoom` (its 1 px dark cap). `StructureLayer.vue` carries the ceiling.
 */
export function wallPasses(walls: readonly Wall[], zoom: number): WallPasses[] {
	const used = new Set<Wall>(), runs: WallPasses[] = [];
	for (const first of walls) if (!used.has(first)) runs.push(run(walls, runStart(walls, first), used, zoom));
	return runs;
}

/** The one wall continuing `wall` through `point`: exactly two walls there, equally thick. */
function onward(walls: readonly Wall[], wall: Wall, point: Point): Wall | undefined {
	const joined = touching(walls, point), next = joined.find(candidate => candidate !== wall);
	return joined.length === 2 && next?.thickness === wall.thickness ? next : undefined;
}

/** Where the run holding `first` begins: its open end, walked back to, or `first` itself round a loop. */
function runStart(walls: readonly Wall[], first: Wall): RunEnd {
	let wall = first, point = first.start, previous = onward(walls, wall, point);
	for (; previous && previous !== first; previous = onward(walls, wall, point)) { point = other(previous, point); wall = previous; }
	return previous === first ? { wall: first, point: first.start } : { wall, point };
}

/** The run from `head`, marking each wall it takes as `used`. */
function run(walls: readonly Wall[], head: RunEnd, used: Set<Wall>, zoom: number): WallPasses {
	const line: Point[] = [];
	let wall: Wall | undefined = head.wall, point = head.point, tail = head.wall;
	while (wall && !used.has(wall)) {
		used.add(wall); tail = wall;
		const oriented = along(wall, point, zoom);
		line.push(...(line.length ? oriented.slice(1) : oriented));
		point = other(wall, point); wall = onward(walls, wall, point);
	}
	const { id, thickness } = head.wall;
	if (wall === head.wall) { const loop = flat(line.slice(0, -1)); return { id, thickness, closed: true, edge: loop, body: loop }; }
	const cap = 1 / zoom, atStart = joint(walls, head.wall, head.point), atEnd = joint(walls, tail, point);
	return { id, thickness, closed: false, edge: capped(line, atStart + cap, atEnd + cap), body: capped(line, atStart, atEnd) };
}

/** A wall's polyline, walked from `from`; a reversed wall walks its reversed arc. */
function along(wall: Wall, from: Point, zoom: number): readonly Point[] {
	const bulge = wall.bulge ?? 0;
	return arcPolyline(samePoint(wall.start, from) ? { start: wall.start, end: wall.end, bulge } : { start: wall.end, end: wall.start, bulge: -bulge }, 0.25 / zoom);
}

/** `line` carried `start` past its first point and `end` past its last. */
function capped(line: readonly Point[], start: number, end: number): number[] {
	const last = line.length - 1;
	return flat([past(line[1], line[0], start), ...line.slice(1, last), past(line[last - 1], line[last], end)]);
}

/** `to`, carried `by` further along the direction it was reached from `from`. */
function past(from: Point, to: Point, by: number): Point {
	const length = Math.hypot(to.x - from.x, to.y - from.y);
	return by && length ? { x: to.x + (to.x - from.x) / length * by, y: to.y + (to.y - from.y) / length * by } : to;
}
