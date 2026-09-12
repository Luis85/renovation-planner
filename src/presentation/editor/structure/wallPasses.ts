import type { Point } from '../../../core/geometry/Point';
import { arcPolyline } from '../../../core/geometry/curvePolyline';
import { samePoint, wallLength, wallTangent, type Wall } from '../../../domain/spatial/Structure';

/** One RUN of walls and its two stroke passes, as flat Konva point arrays. */
export interface WallPasses { readonly id: string; readonly thickness: number; readonly closed: boolean; readonly edge: number[]; readonly body: number[] }

interface RunEnd { readonly wall: Wall; readonly point: Point }

const other = (wall: Wall, point: Point): Point => samePoint(wall.start, point) ? wall.end : wall.start;
const flat = (points: readonly Point[]): number[] => points.flatMap(p => [p.x, p.y]);
const touching = (walls: readonly Wall[], point: Point): Wall[] => walls.filter(wall => samePoint(wall.start, point) || samePoint(wall.end, point));
const unit = (from: Point, to: Point): Point => {
	const length = Math.hypot(to.x - from.x, to.y - from.y);
	return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
};

/**
 * The walls as runs: walls meeting end to end, exactly two at a joint and equally thick, are
 * chained into one polyline, so Konva's mitre join draws their corner exactly at any angle, and a
 * run that comes back to its start is `closed`, mitred there too. A run's open ends are butt-
 * capped, so each is carried past its end along the END TANGENT — the direction of the polyline's
 * first or last segment, which lets a curved wall through `arcPolyline` take the same rule — by
 * `extension`. `StructureLayer.vue` carries the ceiling.
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
	const last = line.length - 1;
	const [bodyStart, edgeStart] = extension(walls, head, unit(line[1], line[0]), zoom);
	const [bodyEnd, edgeEnd] = extension(walls, { wall: tail, point }, unit(line[last - 1], line[last]), zoom);
	return { id, thickness, closed: false, edge: capped(line, edgeStart, edgeEnd), body: capped(line, bodyStart, bodyEnd) };
}

/** The unit direction `wall` leaves `point`, one of its ends, in. */
function leaving(wall: Wall, point: Point): Point {
	if (samePoint(wall.start, point)) return wallTangent(wall, 0);
	const tangent = wallTangent(wall, wallLength(wall));
	return { x: -tangent.x, y: -tangent.y };
}

/** Two of `joined` leaving `point` in opposite directions — the host a T's stem runs into — as one's direction and the thinner one's half thickness. */
function host(joined: readonly Wall[], point: Point): { readonly direction: Point; readonly half: number } | undefined {
	for (const [index, first] of joined.entries()) {
		for (const second of joined.slice(index + 1)) {
			const a = leaving(first, point), b = leaving(second, point);
			if (a.x * b.x + a.y * b.y < 1e-6 - 1) return { direction: a, half: Math.min(first.thickness, second.thickness) / 2 };
		}
	}
	return undefined;
}

/**
 * How far a run END is carried along `out` (unit, pointing out of the run), as [body, edge].
 * A T's STEM — an end whose joined walls include two passing straight through the point — is
 * carried until the far corner of its butt cap meets the host's far face, and the edge until its
 * corner meets the far side of the host's own 1 px dark line: `(host half − own half · cos) / sin`
 * of the angle between them. That is the host's half thickness at a right angle and less at any
 * other, so a stem never pokes through; a stem thicker than its host at a shallow angle comes out
 * negative and is pulled back behind the joint. `sin` is never 0: a stem along its host would
 * overlap it, which `validateStructure` refuses. Any other shared end (an unequal L, three walls
 * with none straight through) moves the body by the largest half thickness among the joined
 * walls — never this wall's own, which would poke a thick wall past a thin one's face — and the
 * edge `1 / zoom` further; a free end moves only the edge, by `1 / zoom`, its 1 px dark cap.
 */
function extension(walls: readonly Wall[], end: RunEnd, out: Point, zoom: number): readonly [number, number] {
	const joined = touching(walls, end.point).filter(item => item !== end.wall), cap = 1 / zoom, through = host(joined, end.point);
	if (!through) {
		const body = Math.max(0, ...joined.map(item => item.thickness / 2));
		return [body, body + cap];
	}
	const { direction } = through, half = end.wall.thickness / 2;
	const cos = Math.abs(out.x * direction.x + out.y * direction.y), sin = Math.abs(out.x * direction.y - out.y * direction.x);
	return [(through.half - half * cos) / sin, (through.half + cap - (half + cap) * cos) / sin];
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

/** `to`, carried `by` further along the direction it was reached from `from`; a negative `by` pulls it back. */
function past(from: Point, to: Point, by: number): Point {
	const length = Math.hypot(to.x - from.x, to.y - from.y);
	return by && length ? { x: to.x + (to.x - from.x) / length * by, y: to.y + (to.y - from.y) / length * by } : to;
}
