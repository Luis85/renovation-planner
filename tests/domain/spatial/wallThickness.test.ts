import { describe, expect, it } from 'vitest';
import { MAX_WALL_THICKNESS, MIN_WALL_THICKNESS, withWallThickness } from '../../../src/domain/spatial/wallThickness';
import { WALL_LOOP } from '../../helpers/structure';
import { wallBodyPolygon } from '../../../src/presentation/editor/structure/wallBody';
import { openingSymbol } from '../../../src/domain/spatial/openingGeometry';

describe('symmetric wall thickness', () => {
	it.each([NaN, Infinity, -1, 0, 0.9, MAX_WALL_THICKNESS + 1])('refuses %s without changing the floor', value => {
		expect(withWallThickness(WALL_LOOP, 'wall-a', value)).toBeNull();
	});
	it('preserves the exact geometry and metadata of joined walls and hosted openings', () => {
		const opening = { id: 'opening-a', kind: 'window' as const, hostId: 'wall-a', offset: 1000, width: 1000, height: 1200, sill: 900 };
		const before = { ...WALL_LOOP, openings: [opening], boundaries: [{ roomId: 'room-a', wallIds: ['wall-a', 'wall-b', 'wall-c', 'wall-d'] }] };
		const after = withWallThickness(before, 'wall-a', 237.5);
		expect(after).toEqual({ ...before, walls: [{ ...before.walls[0], thickness: 237.5, sideExtents: { a: 118.75, b: 118.75 } }, ...before.walls.slice(1)] });
		expect(after?.openings).toBe(before.openings); expect(after?.boundaries).toBe(before.boundaries);
		const wall = after?.walls[0]; if (!wall) throw new Error('missing wall');
		expect(wallBodyPolygon(wall, 1).map(point => point.y)).toEqual([-118.75, -118.75, 118.75, 118.75]);
		expect(openingSymbol(opening, wall)).toBeTruthy();
	});
	it('accepts the existing dimension bounds and refuses a missing wall', () => {
		for (const value of [MIN_WALL_THICKNESS, MAX_WALL_THICKNESS]) expect(withWallThickness(WALL_LOOP, 'wall-a', value)?.walls[0].thickness).toBe(value);
		expect(withWallThickness(WALL_LOOP, 'missing', 100)).toBeNull();
	});
});
