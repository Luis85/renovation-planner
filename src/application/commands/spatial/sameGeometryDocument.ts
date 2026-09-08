import type { PlanGeometryDocument } from '../../ports/PlanGeometrySidecar';
import type { Point } from '../../../core/geometry/Point';
import type { Structure } from '../../../domain/spatial/Structure';

/** Property insertion order is not content; explicit tuples compare every owned spatial fact. */
const point = (p: Point): readonly number[] => [p.x, p.y];
function structureContent(s: Structure | undefined): unknown {
	return s ? [s.walls.map(wall => [wall.id, point(wall.start), point(wall.end), wall.height, wall.thickness]),
			s.openings.map(opening => [opening.id, opening.kind, opening.hostId, opening.offset, opening.width, opening.height, opening.sill,
				opening.swing ? [opening.swing.hinge, opening.swing.side, opening.swing.angle] : null]),
			s.boundaries.map(boundary => [boundary.roomId, boundary.wallIds]),
			(s.elements ?? []).toSorted((a, b) => a.id.localeCompare(b.id, 'en')).map(element => [element.id, element.kind, element.points.map(point)])] : null;
}

function content(document: PlanGeometryDocument): unknown {
	const c = document.calibration;
	return [c ? [point(c.pointA), point(c.pointB), c.knownDistance, c.pixelsPerWorldUnit] : null,
		document.objects.toSorted((a, b) => a.id.localeCompare(b.id, 'en')).map(object => [object.id, object.points.map(point)]),
		structureContent(document.structure), structureContent(document.intended),
		(document.groups ?? []).toSorted((a, b) => a.id.localeCompare(b.id, 'en')).map(group => [group.id, group.name, group.memberIds.toSorted()])];
}

export function sameGeometryDocument(a: PlanGeometryDocument, b: PlanGeometryDocument): boolean {
	return JSON.stringify(content(a)) === JSON.stringify(content(b));
}
