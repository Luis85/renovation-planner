import type { PlanGeometryDocument } from '../../../application/ports/PlanGeometrySidecar';
import type { NamedRotationShape } from '../elements/objectRotation';
import type { useProjectStore } from '../../stores/ProjectStore';
import { groupMembers, groupRoots, selectedGroup } from '../../../domain/spatial/SpatialGroup';
import { groupPoints, groupPivot } from '../../../domain/spatial/groupGeometry';
import { EMPTY_STRUCTURE } from '../../../domain/spatial/Structure';
import { tr } from '../../i18n/strings';

export interface GroupSnapshot {
	readonly id: string;
	readonly name: string;
	readonly memberIds: readonly string[];
	readonly selectionIds: readonly string[];
	readonly generation: number;
	readonly document: PlanGeometryDocument;
}
export function projectedGroupGeometry(project: ReturnType<typeof useProjectStore>): PlanGeometryDocument {
	// Clone plain, serializable geometry rather than retaining a Vue proxy across a gesture.
	return JSON.parse(JSON.stringify({ calibration: project.plan?.calibration ?? null,
		objects: [...project.zones.values()].map(zone => ({ id: zone.id, points: zone.points, ...(zone.bulges ? { bulges: zone.bulges } : {}) })),
		structure: project.structure, intended: project.intended, groups: project.groups.length ? project.groups : undefined,
	})) as PlanGeometryDocument;
}
export function captureGroup(document: PlanGeometryDocument, ids: readonly string[], generation: number, single = false): GroupSnapshot | null {
	const structure = document.structure ?? EMPTY_STRUCTURE, roots = groupRoots(ids, structure);
	const available = new Set([...document.objects.map(object => object.id), ...structure.walls.map(wall => wall.id), ...structure.elements?.map(element => element.id) ?? []]);
	if (!roots.length || roots.some(id => !available.has(id))) return null;
	const saved = selectedGroup(document.groups ?? [], roots, structure);
	if (!saved && ids.length < 2 && !single) return null;
	const memberIds = groupMembers({ id: '', name: '', memberIds: roots }, structure);
	return { id: saved?.id ?? 'selection-group', name: saved?.name ?? tr('editor.group.selection'), memberIds, selectionIds: [...ids], generation, document };
}
export function groupRotationTarget(snapshot: GroupSnapshot, visible: boolean): (NamedRotationShape & { readonly group: GroupSnapshot }) | null {
	const points = groupPoints({ objects: snapshot.document.objects, structure: snapshot.document.structure ?? EMPTY_STRUCTURE }, snapshot.memberIds);
	const pivot = groupPivot(points); if (!pivot) return null;
	const xs = points.map(point => point.x), ys = points.map(point => point.y);
	const minX = Math.min(...xs), minY = Math.min(...ys), maxX = Math.max(...xs), maxY = Math.max(...ys);
	const corners = [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }];
	return { id: snapshot.id, name: snapshot.name, kind: 'group', generation: snapshot.generation, group: snapshot, visible,
		points: minX === maxX ? [corners[0], corners[3], corners[2], corners[1]] : corners };
}
