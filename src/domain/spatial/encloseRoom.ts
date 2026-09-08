import type { Point } from '../../core/geometry/Point';
import { createPolygon } from '../../core/geometry/Polygon';
import { err, ok } from '../../core/result/Result';
import { samePoint, type Structure, type Wall } from './Structure';
import { spatialError, validateStructure } from './structureGeometry';

/** Explicit enclosure reuses exact existing edges; it does not resynchronise outlines on later edits. */
export function encloseRoom(room: { id: string; points: readonly Point[] }, structure: Structure, dimensions: { height: number; thickness: number }, nextWallId: () => string) {
	const polygon = createPolygon(room.points);
	if (!polygon.ok) return polygon;
	const walls = [...structure.walls], wallIds: string[] = [], createdIds: string[] = [];
	for (let index = 0; index < room.points.length; index++) {
		const start = room.points[index], end = room.points[(index + 1) % room.points.length];
		const existing = walls.find(wall => (samePoint(wall.start, start) && samePoint(wall.end, end)) || (samePoint(wall.start, end) && samePoint(wall.end, start)));
		if (existing) { wallIds.push(existing.id); continue; }
		const wall: Wall = { id: nextWallId(), start: { ...start }, end: { ...end }, ...dimensions };
		walls.push(wall); wallIds.push(wall.id); createdIds.push(wall.id);
	}
	if (new Set(wallIds).size !== wallIds.length) return err(spatialError('intersection'));
	const result: Structure = { ...structure, walls, boundaries: [...structure.boundaries.filter(boundary => boundary.roomId !== room.id), { roomId: room.id, wallIds }] };
	const checked = validateStructure(result, [...new Set([...structure.boundaries.map(boundary => boundary.roomId), room.id])]);
	return checked.ok ? ok({ structure: result, wallIds, createdIds }) : checked;
}
