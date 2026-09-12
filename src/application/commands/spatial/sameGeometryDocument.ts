import type { PlanGeometryDocument } from '../../ports/PlanGeometrySidecar';
import type { Point } from '../../../core/geometry/Point';
import type { Vector } from '../../../core/geometry/Vector';
import type { Structure } from '../../../domain/spatial/Structure';

/** Property insertion order is not content; explicit tuples compare every owned spatial fact. */
const point = (p: Point): readonly number[] => [p.x, p.y];
/** A dragged caption's offset is owned geometry (ADR-0029), so a peer's caption drop is a changed document. */
const offset = (v: Vector | undefined): readonly number[] | null => v ? [v.dx, v.dy] : null;
const curves = (values: readonly number[] | undefined, count: number): readonly number[] | null => values === undefined || (values.length === count && values.every(value => value === 0)) ? null : values;
function structureContent(s: Structure | undefined): unknown {
	return s ? [s.walls.map(wall => [wall.id, point(wall.start), point(wall.end), wall.height, wall.thickness, wall.bulge ?? 0]),
			s.openings.map(opening => [opening.id, opening.kind, opening.hostId, opening.offset, opening.width, opening.height, opening.sill,
				opening.swing ? [opening.swing.hinge, opening.swing.side, opening.swing.angle] : null]),
			s.boundaries.map(boundary => [boundary.roomId, boundary.wallIds]),
			(s.elements ?? []).toSorted((a, b) => a.id.localeCompare(b.id, 'en')).map(element => [element.id, element.kind, element.points.map(point),
				element.stair ? [element.stair.width, element.stair.treads, element.stair.direction] : null, element.assetId ?? null, offset(element.labelOffset)])] : null;
}

function content(document: PlanGeometryDocument): unknown {
	const c = document.calibration;
	return [c ? [point(c.pointA), point(c.pointB), c.knownDistance, c.pixelsPerWorldUnit] : null,
		document.objects.toSorted((a, b) => a.id.localeCompare(b.id, 'en')).map(object => [object.id, object.points.map(point), curves(object.bulges, object.points.length), offset(object.labelOffset)]),
		structureContent(document.structure), structureContent(document.intended),
		(document.groups ?? []).toSorted((a, b) => a.id.localeCompare(b.id, 'en')).map(group => [group.id, group.name, group.memberIds.toSorted()])];
}

export function sameGeometryDocument(a: PlanGeometryDocument, b: PlanGeometryDocument): boolean {
	return JSON.stringify(content(a)) === JSON.stringify(content(b));
}
