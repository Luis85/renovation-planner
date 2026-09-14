import type { Point } from '../../core/geometry/Point';
import { samePoint, wallLength, wallTangent, type Wall } from './Structure';
import { wallSideExtents, wallSideNormal } from './wallSides';
import { wallFacePoint } from './wallFaceGeometry';
import { arcExtrema } from '../../core/geometry/circularArc';

export interface WallRay { readonly wall: Wall; readonly direction: Point; readonly a: number; readonly b: number }
export interface WallJunction { readonly point: Point; readonly rays: readonly WallRay[] }
export interface WallJoinPolygon { readonly wallIds: readonly string[]; readonly points: readonly Point[] }
export interface WallClip { readonly point: Point; readonly normal: Point; readonly distance: number; readonly tangent?: boolean }
export const wallPointKey = (point: Point): string => `${point.x},${point.y}`;
const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x;
const add = (p: Point, n: Point, d: number): Point => ({ x: p.x + n.x * d, y: p.y + n.y * d });

function wallRays(wall: Wall) {
	const start = wallTangent(wall, 0), end = wallTangent(wall, wallLength(wall)), sides = wallSideExtents(wall);
	return [
		{ point: wall.start, ray: { wall, direction: start, a: sides.a, b: sides.b } },
		{ point: wall.end, ray: { wall, direction: { x: -end.x, y: -end.y }, a: sides.b, b: sides.a } },
	];
}

export function wallJunctions(walls: readonly Wall[]): readonly WallJunction[] {
	const nodes = new Map<string, { point: Point; rays: WallRay[] }>();
	for (const wall of walls) for (const { point, ray } of wallRays(wall)) {
		const key = wallPointKey(point);
		const node = nodes.get(key); if (node) node.rays.push(ray); else nodes.set(key, { point, rays: [ray] });
	}
	return [...nodes.values()];
}

/** Only an outside gap needs a join wedge: body unions already form inside corners and T cores. */
export function outerWallJoins(junction: WallJunction): readonly WallJoinPolygon[] {
	const { point, rays } = junction; if (rays.length < 2) return [];
	const ordered = rays.map(ray => ({ ...ray, angle: Math.atan2(ray.direction.y, ray.direction.x) })).toSorted((a, b) => a.angle - b.angle);
	return ordered.flatMap((first, index) => {
		const second = ordered[(index + 1) % ordered.length], gap = second.angle - first.angle + (index === ordered.length - 1 ? Math.PI * 2 : 0);
		if (gap <= Math.PI + 1e-8) return [];
		const a = add(point, wallSideNormal(first.direction, 'b'), first.b), b = add(point, wallSideNormal(second.direction, 'a'), second.a);
		const determinant = cross(first.direction, second.direction);
		const along = Math.abs(determinant) < 1e-9 ? null : cross({ x: b.x - a.x, y: b.y - a.y }, second.direction) / determinant;
		const intersection = along === null ? null : add(a, first.direction, along);
		// The limit belongs to this face pair, never the unrelated opposite extent.
		const miter = intersection && Math.hypot(intersection.x - point.x, intersection.y - point.y) <= 10 * Math.max(first.b, second.a) ? [intersection] : [];
		return [{ wallIds: [first.wall.id, second.wall.id], points: [point, a, ...miter, b] }];
	});
}

/** A T stem ends at the host's far face; its two faces are clipped independently, not translated. */
export function wallHostClips(wall: Wall, junctions: readonly WallJunction[]): readonly WallClip[] {
	return junctions.filter(node => samePoint(node.point, wall.start) || samePoint(node.point, wall.end)).flatMap(node => {
		const own = node.rays.find(ray => ray.wall.id === wall.id) as WallRay, others = node.rays.filter(ray => ray !== own);
		for (const [index, first] of others.entries()) for (const second of others.slice(index + 1)) {
			if (dot(first.direction, second.direction) > -1 + 1e-6) continue;
			const axis = wallSideNormal(first.direction, 'a'), alignment = dot(own.direction, axis), sign = alignment < 0 ? -1 : 1;
			const normal = { x: axis.x * sign, y: axis.y * sign };
			const far = (ray: WallRay) => dot(wallSideNormal(ray.direction, 'a'), normal) < 0 ? ray.a : ray.b;
			return [{ point: node.point, normal, distance: Math.min(far(first), far(second)), ...(Math.abs(alignment) < 1e-8 && wall.bulge ? { tangent: true } : {}) }];
		}
		return [];
	});
}

export const wallClipDistance = (point: Point, clip: WallClip): number => dot({ x: point.x - clip.point.x, y: point.y - clip.point.y }, clip.normal) + clip.distance;

/** Analytic bounds in the host-normal frame keep refusal independent of camera zoom/tessellation. */
export function wallCrossesHostClip(wall: Wall, clip: WallClip): boolean {
	if (clip.tangent) return true;
	const frame = (point: Point): Point => {
		const delta = { x: point.x - clip.point.x, y: point.y - clip.point.y };
		return { x: delta.x * clip.normal.y - delta.y * clip.normal.x, y: dot(delta, clip.normal) };
	};
	return (['a', 'b'] as const).some(side => arcExtrema({ start: frame(wallFacePoint(wall, side, 0)), end: frame(wallFacePoint(wall, side, 1)), bulge: wall.bulge ?? 0 })
		.some(point => point.y + clip.distance < -1e-6));
}

/** Convex straight-wall body clipping. Curved cases requiring clipping are refused before preview/write. */
export function clipWallPolygon(points: readonly Point[], clip: WallClip): readonly Point[] {
	const result: Point[] = [];
	for (const [index, current] of points.entries()) {
		const previous = points[(index + points.length - 1) % points.length], a = wallClipDistance(previous, clip), b = wallClipDistance(current, clip);
		if ((a >= 0) !== (b >= 0)) { const fraction = a / (a - b); result.push({ x: previous.x + (current.x - previous.x) * fraction, y: previous.y + (current.y - previous.y) * fraction }); }
		if (b >= 0) result.push(current);
	}
	return result;
}
