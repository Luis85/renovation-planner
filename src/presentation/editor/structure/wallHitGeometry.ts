import type { Point } from '../../../core/geometry/Point';
import type { Structure } from '../../../domain/spatial/Structure';
import { wallSideNetworkGeometry } from '../../../domain/spatial/wallSideNetwork';
import { asymmetricWall } from '../../../domain/spatial/wallSides';
import { openingCutPolygon } from '../../../domain/spatial/openingGeometry';
import { wallHostClips, wallJunctions } from '../../../domain/spatial/wallSideJunctions';

export interface WallHitGeometry { readonly hitPoints: readonly Point[]; readonly hitRegions: readonly (readonly Point[])[] }
/** Canonical handles remain centre-line points; hits and framing follow the actual filled faces. */
export function wallHitGeometry(structure: Structure): ReadonlyMap<string, WallHitGeometry> {
	const network = wallSideNetworkGeometry(structure.walls), result = new Map<string, WallHitGeometry>(), nodes = wallJunctions(structure.walls);
	for (const body of network.bodies) result.set(body.id, { hitPoints: body.points,
		hitRegions: [body.points, ...network.joins.filter(join => join.wallIds.includes(body.id)).map(join => join.points)] });
	for (const opening of structure.openings) {
		const host = structure.walls.find(wall => wall.id === opening.hostId);
		if (!host || !asymmetricWall(host)) continue;
		const points = openingCutPolygon(opening, host, 1, 0, wallHostClips(host, nodes));
		result.set(opening.id, { hitPoints: points, hitRegions: [points] });
	}
	return result;
}
