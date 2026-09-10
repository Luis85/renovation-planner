import { coincident, rotate } from '../../core/geometry/operations';
import type { Point } from '../../core/geometry/Point';
import { err, ok } from '../../core/result/Result';
import { samePoint, type Structure, type Wall } from './Structure';
import { spatialError, validateStructure } from './structureGeometry';

export function wallRotationPivot(wall: Wall): Point {
	return { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 };
}

/** Rotate a host rigidly; connected neighbors share its moved junctions, never its pivot. */
export function rotateWallStructure(structure: Structure, id: string, degrees: number) {
	const wall = structure.walls.find(candidate => candidate.id === id);
	if (!wall) return err(spatialError('host-missing'));
	if (!Number.isFinite(degrees)) return err(spatialError('wall-dimensions'));
	const angle = degrees % 360;
	if (angle === 0) return ok(structure);
	const points = rotate({ points: [wall.start, wall.end] }, angle * Math.PI / 180, wallRotationPivot(wall)).points;
	if (coincident(wall.start, points[0]) && coincident(wall.end, points[1])) return ok(structure);
	const junction = (point: Point): Point => samePoint(point, wall.start) ? points[0] : samePoint(point, wall.end) ? points[1] : point;
	const rotated = { ...structure, walls: structure.walls.map(candidate => ({ ...candidate, start: junction(candidate.start), end: junction(candidate.end) })) };
	return validateStructure(rotated, structure.boundaries.map(boundary => boundary.roomId));
}
