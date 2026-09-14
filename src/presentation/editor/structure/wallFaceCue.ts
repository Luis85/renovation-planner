import type { Point } from '../../../core/geometry/Point';
import { arcPoint } from '../../../core/geometry/circularArc';
import { wallLength, wallTangent, type Structure, type WallSide } from '../../../domain/spatial/Structure';
import { validWallFaceCurve, wallFacePoint, wallFacePoints } from '../../../domain/spatial/wallFaceGeometry';
import { wallSideNormal } from '../../../domain/spatial/wallSides';
import { clipWallSegment, wallHostClips, wallJunctions } from '../../../domain/spatial/wallSideJunctions';
import { wallSolidRanges } from './wallSolidRanges';

/** Keep the cue on the real face: leave opening gaps and respect the far side of a T host. */
export function wallFaceCue(structure: Structure, id: string, side: WallSide, zoom: number) {
	const wall = structure.walls.find(item => item.id === id);
	if (!wall || !validWallFaceCurve(wall)) return null;
	const length = wallLength(wall), ranges = wallSolidRanges(wall, structure.openings);
	const count = wallFacePoints(wall, side, 0.25 / zoom).length - 1, clips = wallHostClips(wall, wallJunctions(structure.walls));
	const faces = ranges.flatMap(([start, end]) => {
		const steps = Math.max(1, Math.ceil(count * (end - start)));
		return Array.from({ length: steps }, (_, i) => clipWallSegment(wallFacePoint(wall, side, start + (end - start) * i / steps), wallFacePoint(wall, side, start + (end - start) * (i + 1) / steps), clips)).filter(points => points.length);
	});
	const middle = arcPoint({ ...wall, bulge: wall.bulge ?? 0 }, 0.5), tangent = wallTangent(wall, length / 2), normal = wallSideNormal(tangent, 'a');
	const wing = (sign: number): Point => ({ x: middle.x - tangent.x * 9 / zoom + normal.x * sign * 5 / zoom, y: middle.y - tangent.y * 9 / zoom + normal.y * sign * 5 / zoom });
	return { faces, arrow: [wing(1), middle, wing(-1)] };
}
