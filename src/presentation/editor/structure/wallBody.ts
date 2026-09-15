import type { Point } from '../../../core/geometry/Point';
import { arcPolyline } from '../../../core/geometry/curvePolyline';
import type { Wall } from '../../../domain/spatial/Structure';
import { asymmetricWall } from '../../../domain/spatial/wallSides';
import { wallFacePolygon } from '../../../domain/spatial/wallFaceGeometry';

/** One face, then the other reversed: the closed outline a wall's body covers, for a fill that a stroke cannot carry. */
export function wallBodyPolygon(wall: Wall, tolerance: number): readonly Point[] {
	if (asymmetricWall(wall)) return wallFacePolygon(wall, tolerance);
	const line = arcPolyline({ ...wall, bulge: wall.bulge ?? 0 }, tolerance), half = wall.thickness / 2;
	const normal = (index: number): Point => {
		const a = line[Math.max(0, index - 1)], b = line[Math.min(line.length - 1, index + 1)];
		const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
		return { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
	};
	const face = (sign: number) => line.map((point, index) => { const n = normal(index); return { x: point.x + sign * n.x * half, y: point.y + sign * n.y * half }; });
	return [...face(-1), ...face(1).toReversed()];
}
