import { createCurvedPolygon, type CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import { arcPoint } from '../../core/geometry/circularArc';
import { curveTolerance } from '../../core/geometry/circularIntersections';
import { edgeSupports, offsetOutline, outwardDistance, outwardNormal, type EdgeSupport } from '../../core/geometry/offsetOutline';
import type { Point } from '../../core/geometry/Point';
import { err, ok } from '../../core/result/Result';
import { alongWall, samePoint, wallLength, projectOntoWall, type Structure, type Wall } from './Structure';
import { spatialError, validateStructure } from './structureGeometry';

/** The wall running exactly along one room edge, in either direction; a reversed wall carries the negated bulge. */
export function wallOnEdge(walls: readonly Wall[], start: Point, end: Point, bulge: number): Wall | undefined {
	return walls.find(wall => (samePoint(wall.start, start) && samePoint(wall.end, end) && (wall.bulge ?? 0) === bulge) || (samePoint(wall.start, end) && samePoint(wall.end, start) && (wall.bulge ?? 0) === -bulge));
}

interface EdgeProbe { readonly support: EdgeSupport; readonly middle: Point; readonly tolerance: number }

function edgeProbes(room: CurvedPolygon): EdgeProbe[] {
	const tolerance = Math.max(1e-6, curveTolerance(room.points));
	return edgeSupports(room).map((support, index) => ({ support, tolerance,
		middle: arcPoint({ start: room.points[index], end: room.points[(index + 1) % room.points.length], bulge: room.bulges?.[index] ?? 0 }, 0.5) }));
}

/**
 * Whether a wall's centre line lies on the edge's line or circle moved `distance` outward, and
 * passes the edge's own midpoint. Three points on the wall pin its whole line or circle; the
 * midpoint keeps a wall elsewhere on that line from counting.
 */
function runsAlong(wall: Wall, edge: EdgeProbe, distance: number): boolean {
	const onSupport = [wall.start, alongWall(wall, wallLength(wall) / 2), wall.end].every(point => Math.abs(outwardDistance(edge.support, point) - distance) <= edge.tolerance);
	const normal = outwardNormal(edge.support, edge.middle);
	return onSupport && projectOntoWall(wall, { x: edge.middle.x + normal.x * distance, y: edge.middle.y + normal.y * distance }).distance <= edge.tolerance;
}

/** A wall centred on the edge (a shared wall, or one enclosed before walls moved outside) or with its inner face on it. */
const wallAlongEdge = (walls: readonly Wall[], edge: EdgeProbe): Wall | undefined => walls.find(wall => runsAlong(wall, edge, 0) || runsAlong(wall, edge, wall.thickness / 2));

/**
 * Whether every edge of the room still runs along a wall its boundary lists, by `wallAlongEdge`'s
 * rule; false with no boundary. Enclosure is never resynchronised, so a boundary can outlive the
 * edges it was made from, and "has a boundary" is not this answer.
 */
export function enclosedByBoundary(room: CurvedPolygon & { id: string }, structure: Structure): boolean {
	const boundary = structure.boundaries.find(entry => entry.roomId === room.id);
	if (!boundary) return false;
	const walls = structure.walls.filter(wall => boundary.wallIds.includes(wall.id));
	return edgeProbes(room).every(edge => wallAlongEdge(walls, edge) !== undefined);
}

/** Neighbouring Rooms trace a shared edge the opposite way; the same way round would mean the two overlap. */
function sharesEdge(rooms: readonly CurvedPolygon[], start: Point, end: Point, bulge: number): boolean {
	return rooms.some(other => other.points.some((point, index) =>
		samePoint(point, end) && samePoint(other.points[(index + 1) % other.points.length], start) && (other.bulges?.[index] ?? 0) === -bulge));
}

/** The Room of a closed wall loop, listed in loop order: its outline on the walls' inner faces. */
export function roomInsideWalls(walls: readonly Wall[]) {
	const loop = { points: walls.map(wall => wall.start), ...(walls.some(wall => wall.bulge) ? { bulges: walls.map(wall => wall.bulge ?? 0) } : {}) };
	const inside = offsetOutline(loop, walls.map(wall => -wall.thickness / 2));
	return inside.ok ? inside : err(spatialError('wall-offset'));
}

/**
 * Explicit enclosure builds each wall outside the room, its inner face on the edge. An edge another
 * Room shares, or one a wall is already centred on, keeps a centred wall instead, so neighbours
 * share one. Exact existing walls (`wallOnEdge`) are reused; outlines are not resynchronised later.
 */
export function encloseRoom(room: CurvedPolygon & { id: string }, structure: Structure, dimensions: { height: number; thickness: number }, nextWallId: () => string, neighbours: readonly CurvedPolygon[] = []) {
	const polygon = createCurvedPolygon(room);
	if (!polygon.ok) return polygon;
	const count = room.points.length, probes = edgeProbes(room);
	const distances = room.points.map((start, index) => sharesEdge(neighbours, start, room.points[(index + 1) % count], room.bulges?.[index] ?? 0)
		|| structure.walls.some(wall => runsAlong(wall, probes[index], 0)) ? 0 : dimensions.thickness / 2);
	const outline = offsetOutline(room, distances);
	if (!outline.ok) return err(spatialError('wall-offset'));
	const junctions = structure.walls.flatMap(wall => [wall.start, wall.end]), tolerance = probes[0].tolerance;
	const corners = outline.value.points.map(corner => junctions.find(junction => Math.hypot(junction.x - corner.x, junction.y - corner.y) <= tolerance) ?? corner);
	const walls = [...structure.walls], wallIds: string[] = [], createdIds: string[] = [];
	for (let index = 0; index < count; index++) {
		const start = corners[index], end = corners[(index + 1) % count];
		const bulge = outline.value.bulges?.[index] ?? 0;
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
