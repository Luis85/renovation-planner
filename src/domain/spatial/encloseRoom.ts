import { createCurvedPolygon, type CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import { err, ok } from '../../core/result/Result';
import { samePoint, type Structure, type Wall } from './Structure';
import { spatialError, validateStructure } from './structureGeometry';

/** Explicit enclosure reuses exact existing edges; it does not resynchronise outlines on later edits. */
export function encloseRoom(room: CurvedPolygon & { id: string }, structure: Structure, dimensions: { height: number; thickness: number }, nextWallId: () => string) {
	const polygon = createCurvedPolygon(room);
	if (!polygon.ok) return polygon;
	const walls = [...structure.walls], wallIds: string[] = [], createdIds: string[] = [];
	for (let index = 0; index < room.points.length; index++) {
		const start = room.points[index], end = room.points[(index + 1) % room.points.length];
		const bulge = room.bulges?.[index] ?? 0;
		const existing = walls.find(wall => (samePoint(wall.start, start) && samePoint(wall.end, end) && (wall.bulge ?? 0) === bulge) || (samePoint(wall.start, end) && samePoint(wall.end, start) && (wall.bulge ?? 0) === -bulge));
		if (existing) { wallIds.push(existing.id); continue; }
		const wall: Wall = { id: nextWallId(), start: { ...start }, end: { ...end }, ...dimensions, ...(bulge !== 0 ? { bulge } : {}) };
		walls.push(wall); wallIds.push(wall.id); createdIds.push(wall.id);
	}
	if (new Set(wallIds).size !== wallIds.length) return err(spatialError('intersection'));
	const boundaries = [...structure.boundaries], boundaryIndex = boundaries.findIndex(item => item.roomId === room.id);
	const enclosedBoundary = { roomId: room.id, wallIds };
	if (boundaryIndex < 0) boundaries.push(enclosedBoundary);
	else boundaries[boundaryIndex] = enclosedBoundary;
	const result: Structure = { ...structure, walls, boundaries };
	const checked = validateStructure(result, [...new Set([...structure.boundaries.map(boundary => boundary.roomId), room.id])]);
	return checked.ok ? ok({ structure: result, wallIds, createdIds }) : checked;
}
