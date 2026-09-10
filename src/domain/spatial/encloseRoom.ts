import { createCurvedPolygon, type CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import type { Point } from '../../core/geometry/Point';
import { err, ok } from '../../core/result/Result';
import { samePoint, type Structure, type Wall } from './Structure';
import { spatialError, validateStructure } from './structureGeometry';

/** The wall running exactly along one room edge, in either direction; a reversed wall carries the negated bulge. */
export function wallOnEdge(walls: readonly Wall[], start: Point, end: Point, bulge: number): Wall | undefined {
	return walls.find(wall => (samePoint(wall.start, start) && samePoint(wall.end, end) && (wall.bulge ?? 0) === bulge) || (samePoint(wall.start, end) && samePoint(wall.end, start) && (wall.bulge ?? 0) === -bulge));
}

/**
 * Whether every edge of the room still runs along a wall its boundary lists, by `wallOnEdge`'s
 * rule; false with no boundary. Enclosure is never resynchronised, so a boundary can outlive the
 * edges it was made from, and "has a boundary" is not this answer.
 */
export function enclosedByBoundary(room: CurvedPolygon & { id: string }, structure: Structure): boolean {
	const boundary = structure.boundaries.find(entry => entry.roomId === room.id);
	if (!boundary) return false;
	const walls = structure.walls.filter(wall => boundary.wallIds.includes(wall.id));
	return room.points.every((start, index) => wallOnEdge(walls, start, room.points[(index + 1) % room.points.length], room.bulges?.[index] ?? 0) !== undefined);
}

/** Explicit enclosure reuses exact existing edges (`wallOnEdge`); it does not resynchronise outlines on later edits. */
export function encloseRoom(room: CurvedPolygon & { id: string }, structure: Structure, dimensions: { height: number; thickness: number }, nextWallId: () => string) {
	const polygon = createCurvedPolygon(room);
	if (!polygon.ok) return polygon;
	const walls = [...structure.walls], wallIds: string[] = [], createdIds: string[] = [];
	for (let index = 0; index < room.points.length; index++) {
		const start = room.points[index], end = room.points[(index + 1) % room.points.length];
		const bulge = room.bulges?.[index] ?? 0;
		const existing = wallOnEdge(walls, start, end, bulge);
		if (existing) { wallIds.push(existing.id); continue; }
		const wall: Wall = { id: nextWallId(), start: { ...start }, end: { ...end }, ...dimensions, ...(bulge !== 0 ? { bulge } : {}) };
		walls.push(wall); wallIds.push(wall.id); createdIds.push(wall.id);
	}
	if (new Set(wallIds).size !== wallIds.length) return err(spatialError('intersection'));
	const result: Structure = { ...structure, walls, boundaries: [...structure.boundaries.filter(boundary => boundary.roomId !== room.id), { roomId: room.id, wallIds }] };
	const checked = validateStructure(result, [...new Set([...structure.boundaries.map(boundary => boundary.roomId), room.id])]);
	return checked.ok ? ok({ structure: result, wallIds, createdIds }) : checked;
}
