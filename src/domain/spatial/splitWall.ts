import type { Point } from '../../core/geometry/Point';
import type { ValidationError } from '../../core/errors/AppError';
import { err, ok, type Result } from '../../core/result/Result';
import { alongWall, wallLength, type Structure, type Wall } from './Structure';
import { spatialError } from './structureGeometry';

/**
 * Cuts `wallId` at `offset` millimetres along it, so a new wall can join there: walls meet only
 * end to end (`wallsConflict`), so a junction in the middle of a wall IS a cut. The second half
 * takes `newId`; openings past the cut move onto it and keep their plan position, and a room
 * boundary naming the wall names both halves. A cut through an opening is refused, and a cut at
 * either end is no cut at all — that end is where the new wall starts.
 */
export function splitWall(structure: Structure, wallId: string, offset: number, newId: string): Result<{ structure: Structure; point: Point }, ValidationError> {
	const wall = structure.walls.find(item => item.id === wallId);
	if (!wall) return err(spatialError('host-missing'));
	const length = wallLength(wall);
	if (offset <= 0) return ok({ structure, point: wall.start });
	if (offset >= length) return ok({ structure, point: wall.end });
	if (structure.openings.some(opening => opening.hostId === wallId && opening.offset < offset && offset < opening.offset + opening.width)) return err(spatialError('opening-split'));
	const point = alongWall(wall, offset), fraction = offset / length;
	// A bulge is tan(sweep / 4), and a cut at a fraction of the arc's length is the same fraction of its sweep.
	const bend = (part: number): Pick<Wall, 'bulge'> => wall.bulge ? { bulge: Math.tan(Math.atan(wall.bulge) * part) } : {};
	const first: Wall = { ...wall, end: point, ...bend(fraction) }, second: Wall = { ...wall, id: newId, start: point, ...bend(1 - fraction) };
	return ok({ point, structure: { ...structure,
		walls: structure.walls.flatMap(item => item === wall ? [first, second] : [item]),
		openings: structure.openings.map(opening => opening.hostId === wallId && opening.offset >= offset ? { ...opening, hostId: newId, offset: opening.offset - offset } : opening),
		boundaries: structure.boundaries.map(boundary => boundary.wallIds.includes(wallId) ? { ...boundary, wallIds: boundary.wallIds.flatMap(id => id === wallId ? [id, newId] : [id]) } : boundary),
	} });
}
