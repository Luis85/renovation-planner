import type { Point } from '../../../core/geometry/Point';
import type { Vector } from '../../../core/geometry/Vector';
import type { PlanGeometryDocument } from '../../../application/ports/PlanGeometrySidecar';
import { rotate } from '../../../core/geometry/operations';
import { EMPTY_STRUCTURE } from '../../../domain/spatial/Structure';
import { groupRoots } from '../../../domain/spatial/SpatialGroup';
import { transformGroupGeometry } from '../../../domain/spatial/groupGeometry';
import type { GroupSnapshot } from './groupSnapshot';
import { groupRotationTarget } from './groupSnapshot';
import { rotationDegreesBetween, rotationPivot } from '../elements/objectRotation';

export function translatedGroup(snapshot: GroupSnapshot, delta: Vector): PlanGeometryDocument {
	return { ...snapshot.document, ...transformGroupGeometry(snapshot.document.objects, snapshot.document.structure ?? EMPTY_STRUCTURE,
		snapshot.memberIds, point => ({ x: point.x + delta.dx, y: point.y + delta.dy })) };
}
export function rotatedGroup(snapshot: GroupSnapshot, envelope: readonly Point[]): PlanGeometryDocument | null {
	const target = groupRotationTarget(snapshot, true), pivot = target ? rotationPivot(target) : null;
	if (!target || !pivot) return null;
	const angle = rotationDegreesBetween(target.points, envelope) * Math.PI / 180;
	return { ...snapshot.document, ...transformGroupGeometry(snapshot.document.objects, snapshot.document.structure ?? EMPTY_STRUCTURE,
		snapshot.memberIds, point => rotate({ points: [point] }, angle, pivot).points[0]) };
}
export function adjustedNeighbours(snapshot: GroupSnapshot, proposed: PlanGeometryDocument): number {
	const roots = new Set(groupRoots(snapshot.memberIds, snapshot.document.structure ?? EMPTY_STRUCTURE));
	const before = new Map(snapshot.document.structure?.walls.map(wall => [wall.id, wall]));
	return proposed.structure?.walls.filter(wall => !roots.has(wall.id) && before.has(wall.id)
		&& JSON.stringify(before.get(wall.id)) !== JSON.stringify(wall)).length ?? 0;
}
