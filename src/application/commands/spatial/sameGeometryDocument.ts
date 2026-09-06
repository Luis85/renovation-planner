import type { PlanGeometryDocument } from '../../ports/PlanGeometrySidecar';
import type { Point } from '../../../core/geometry/Point';

/** Property insertion order is not content; explicit tuples compare every owned spatial fact. */
const point = (p: Point): readonly number[] => [p.x, p.y];
function content(document: PlanGeometryDocument): unknown {
	const c = document.calibration, s = document.structure;
	return [c ? [point(c.pointA), point(c.pointB), c.knownDistance, c.pixelsPerWorldUnit] : null,
		document.objects.map(object => [object.id, object.points.map(point)]),
		s ? [s.walls.map(wall => [wall.id, point(wall.start), point(wall.end), wall.height, wall.thickness]),
			s.openings.map(opening => [opening.id, opening.kind, opening.hostId, opening.offset, opening.width, opening.height, opening.sill]),
			s.boundaries.map(boundary => [boundary.roomId, boundary.wallIds])] : null];
}
export function sameGeometryDocument(a: PlanGeometryDocument, b: PlanGeometryDocument): boolean {
	return JSON.stringify(content(a)) === JSON.stringify(content(b));
}
