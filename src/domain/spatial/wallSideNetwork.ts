import type { Point } from '../../core/geometry/Point';
import type { Wall } from './Structure';
import { asymmetricWall } from './wallSides';
import { validWallFaceCurve, wallFacePolygon } from './wallFaceGeometry';
import { clipWallPolygon, outerWallJoins, wallCrossesHostClip, wallHostClips, wallJunctions, wallPointKey, type WallJoinPolygon, type WallRay } from './wallSideJunctions';

/** Unchanged centred networks retain their established stroke rendering exactly. */
export function independentWallNetwork(walls: readonly Wall[]): ReadonlySet<string> {
	const active = new Set(walls.filter(wall => asymmetricWall(wall)).map(wall => wall.id));
	if (!active.size) return active;
	const nodes = new Map(wallJunctions(walls).map(node => [wallPointKey(node.point), node.rays]));
	const byId = new Map(walls.map(wall => [wall.id, wall])), queue = [...active];
	for (let index = 0; index < queue.length; index++) {
		const wall = byId.get(queue[index]) as Wall;
		// Every endpoint was inserted by wallJunctions over this same wall set.
		for (const point of [wall.start, wall.end]) for (const ray of nodes.get(wallPointKey(point)) as readonly WallRay[]) if (!active.has(ray.wall.id)) { active.add(ray.wall.id); queue.push(ray.wall.id); }
	}
	return active;
}

export interface WallSideGeometryIssue { readonly wallId: string; readonly kind: 'curve-radius' | 'curved-junction' }
export function wallSideGeometryIssue(walls: readonly Wall[]): WallSideGeometryIssue | null {
	const ids = independentWallNetwork(walls); if (!ids.size) return null;
	const nodes = wallJunctions(walls);
	for (const wall of walls.filter(item => ids.has(item.id))) {
		if (!validWallFaceCurve(wall)) return { wallId: wall.id, kind: 'curve-radius' };
		if (wall.bulge && wallHostClips(wall, nodes).some(clip => wallCrossesHostClip(wall, clip))) return { wallId: wall.id, kind: 'curved-junction' };
	}
	return null;
}

export interface WallSideNetworkGeometry {
	readonly ids: ReadonlySet<string>;
	readonly bodies: readonly { readonly id: string; readonly points: readonly Point[] }[];
	readonly joins: readonly WallJoinPolygon[];
}
export function wallSideNetworkGeometry(walls: readonly Wall[], tolerance = 1): WallSideNetworkGeometry {
	const ids = independentWallNetwork(walls), selected = walls.filter(wall => ids.has(wall.id));
	if (!selected.length) return { ids, bodies: [], joins: [] };
	const nodes = wallJunctions(selected);
	const bodies = selected.map(wall => {
		let points = validWallFaceCurve(wall) ? wallFacePolygon(wall, tolerance) : [];
		for (const clip of wallHostClips(wall, nodes)) {
			if (!wall.bulge) points = clipWallPolygon(points, clip);
			else if (wallCrossesHostClip(wall, clip)) points = [];
		}
		return { id: wall.id, points };
	});
	return { ids, bodies, joins: nodes.flatMap(node => outerWallJoins(node)) };
}
