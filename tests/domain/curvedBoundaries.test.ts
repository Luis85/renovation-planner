import { expect, it } from 'vitest';
import { alongWall, EMPTY_STRUCTURE, openingPoints, projectOntoWall, wallLength, wallTangent } from '../../src/domain/spatial/Structure';
import { encloseRoom } from '../../src/domain/spatial/encloseRoom';
import { groupPoints, groupPivot } from '../../src/domain/spatial/groupGeometry';
import { wallsConflict } from '../../src/domain/spatial/structureGeometry';
import { expectOk } from '../helpers/domain';
const wall = { id: 'wall-curve', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 150, bulge: 0.25 };
it('positions hosted openings by arc length and exposes the local tangent', () => {
	const length = wallLength(wall); expect(length).toBeGreaterThan(4000);
	expect(alongWall(wall, 0)).toEqual(wall.start); expect(alongWall(wall, length)).toEqual(wall.end);
	const middle = alongWall(wall, length / 2); expect(middle.x).toBeCloseTo(2000, 9); expect(middle.y).toBeCloseTo(-500, 9);
	expect(wallTangent(wall, length / 2)).toEqual({ x: 1, y: 0 }); expect(wallTangent(wall, 0).y).toBeLessThan(0);
	const opening = { id: 'opening-curve', hostId: wall.id, kind: 'window' as const, offset: length / 2 - 400, width: 800, height: 1200, sill: 800 };
	const span = openingPoints(opening, [wall]); expect(span[0].x + span[1].x).toBeCloseTo(4000, 8); expect(span[0].y).toBeCloseTo(span[1].y, 8); expect(span[0].y).toBeLessThan(0);
	const projection = projectOntoWall(wall, { x: 2000, y: -550 }); expect(projection.fraction).toBeCloseTo(0.5, 10); expect(projection.offset).toBeCloseTo(length / 2, 8); expect(projection.distance).toBeCloseTo(50, 8);
	expect(projectOntoWall(wall, { x: -200, y: 0 }).offset).toBe(0);
});
it('validates actual arc intersections rather than the invisible chord', () => {
	const crossing = { start: { x: 2000, y: -1000 }, end: { x: 2000, y: -250 } };
	expect(wallsConflict(wall, crossing)).toBe(true); expect(wallsConflict({ ...wall, bulge: 0 }, crossing)).toBe(false);
	expect(wallsConflict(wall, { start: wall.end, end: { x: 4000, y: 3000 } })).toBe(false);
	expect(wallsConflict(wall, { ...wall, start: wall.end, end: wall.start, bulge: -wall.bulge })).toBe(true);
});
it('encloses a curved Room with the same arc and reuses a reversed existing curve', () => {
	const room = { id: 'room-curved', points: [wall.start, wall.end, { x: 4000, y: 3000 }, { x: 0, y: 3000 }], bulges: [0.25, 0, 0, 0] };
	let count = 0;
	const result = expectOk(encloseRoom(room, EMPTY_STRUCTURE, { height: 2400, thickness: 150 }, () => `wall-made-${count++}`));
	expect(result.structure.walls[0].bulge).toBe(0.25);
	const reversed = { ...result.structure, walls: result.structure.walls.map(value => ({ ...value, start: value.end, end: value.start, ...(value.bulge ? { bulge: -value.bulge } : {}) })) };
	expect(expectOk(encloseRoom(room, reversed, { height: 2400, thickness: 150 }, () => `wall-made-${count++}`)).createdIds).toEqual([]);
	const points = groupPoints({ objects: [room], structure: result.structure }, [room.id, ...result.wallIds]);
	expect(groupPivot(points)?.x).toBeCloseTo(2000, 8); expect(groupPivot(points)?.y).toBeCloseTo(1250, 8);
});
it('refuses to enclose a Room whose outline is not itself a valid polygon', () => {
	const room = { id: 'room-too-few', points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }] };
	const result = encloseRoom(room, EMPTY_STRUCTURE, { height: 2400, thickness: 150 }, () => 'wall-unreachable');
	expect(result.ok).toBe(false);
	if (result.ok) return;
	expect(result.error).toMatchObject({ category: 'Geometry', code: 'polygon-too-few-points' });
});
it('refuses an enclosure whose caller hands back the same wall id for two different edges', () => {
	const room = { id: 'room-collision', points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }] };
	const result = encloseRoom(room, EMPTY_STRUCTURE, { height: 2400, thickness: 150 }, () => 'wall-collision');
	expect(result.ok).toBe(false);
	if (result.ok) return;
	expect(result.error).toMatchObject({ category: 'Validation', code: 'spatial.intersection' });
});
