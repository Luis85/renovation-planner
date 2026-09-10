import { describe, expect, it } from 'vitest';
import { distance } from '../../../src/core/geometry/operations';
import { rotateWallStructure, wallRotationPivot } from '../../../src/domain/spatial/rotateWall';
import { openingPoints, wallLength, type Structure } from '../../../src/domain/spatial/Structure';
import { WALL_LOOP } from '../../helpers/structure';
import { expectOk } from '../../helpers/domain';

const wall = { id: 'wall-a', start: { x: 100, y: 200 }, end: { x: 2100, y: 200 }, thickness: 150, height: 2600 };
const opening = { id: 'opening-a', kind: 'window' as const, hostId: wall.id, offset: 123.4, width: 975, height: 1200, sill: 800 };
const single: Structure = { walls: [wall], openings: [opening], boundaries: [] };

describe('wall rotation with hosted openings and coincident junctions', () => {
	it.each([15.25, 90, -90, 225])('rotates rigidly around the frozen midpoint for %s degrees without changing hosted measurements', degrees => {
		const before = structuredClone(single), rotated = expectOk(rotateWallStructure(single, wall.id, degrees));
		expect(single).toEqual(before); expect(rotated.openings).toBe(single.openings);
		expect(rotated.walls[0]).toMatchObject({ id: wall.id, thickness: wall.thickness, height: wall.height });
		expect(wallLength(rotated.walls[0])).toBeCloseTo(wallLength(wall), 9);
		const pivot = wallRotationPivot(rotated.walls[0]); expect(pivot.x).toBeCloseTo(1100, 9); expect(pivot.y).toBeCloseTo(200, 9);
		const endpoints = openingPoints(opening, rotated.walls);
		expect(distance(rotated.walls[0].start, endpoints[0])).toBeCloseTo(opening.offset, 9);
		expect(distance(endpoints[0], endpoints[1])).toBeCloseTo(opening.width, 9);
	});
	it('propagates both moved junctions, preserves unrelated endpoints and retains Room associations', () => {
		const structure = { ...WALL_LOOP, boundaries: [{ roomId: 'room-a', wallIds: WALL_LOOP.walls.map(item => item.id) }] };
		const rotated = expectOk(rotateWallStructure(structure, 'wall-a', 90));
		expect(rotated.walls[0].start.x).toBeCloseTo(2000, 9); expect(rotated.walls[0].start.y).toBe(-2000);
		expect(rotated.walls[0].end.x).toBeCloseTo(2000, 9); expect(rotated.walls[0].end.y).toBe(2000);
		expect(rotated.walls[1].start).toBe(rotated.walls[0].end); expect(rotated.walls[3].end).toBe(rotated.walls[0].start);
		expect(rotated.walls[1].end).toBe(structure.walls[1].end); expect(rotated.walls[3].start).toBe(structure.walls[3].start);
		expect(rotated.walls[2]).toEqual(structure.walls[2]); expect(rotated.boundaries).toBe(structure.boundaries);
	});
	it('refuses intersections and an opening on a shortened neighbor without modifying either host', () => {
		expect(rotateWallStructure(WALL_LOOP, 'wall-a', 180)).toMatchObject({ ok: false, error: { code: 'spatial.intersection' } });
		const structure = { ...WALL_LOOP, openings: [{ ...opening, hostId: 'wall-b', offset: 2600, width: 300 }] }, before = structuredClone(structure);
		expect(rotateWallStructure(structure, 'wall-a', 90)).toMatchObject({ ok: false, error: { code: 'spatial.opening-containment' } });
		expect(structure).toEqual(before);
	});
	it('retains exact no-op identity and refuses nonfinite angles or missing walls', () => {
		for (const degrees of [0, 360, -720, 1e-12]) expect(expectOk(rotateWallStructure(single, wall.id, degrees))).toBe(single);
		for (const degrees of [Infinity, NaN]) expect(rotateWallStructure(single, wall.id, degrees).ok).toBe(false);
		const edge = { ...single, walls: [{ ...wall, start: { x: 1e9 - 2000, y: 1e9 }, end: { x: 1e9, y: 1e9 } }] };
		expect(rotateWallStructure(edge, wall.id, 90)).toMatchObject({ ok: false, error: { code: 'spatial.wall-dimensions' } });
		expect(rotateWallStructure(single, 'missing', 90)).toMatchObject({ ok: false, error: { code: 'spatial.host-missing' } });
	});
	it.each([1, 7, 13, 29, 37, 89])('keeps a full-width opening contained under a rigid %s-degree rotation', degrees => {
		const structure = { ...single, openings: [{ ...opening, offset: 0, width: wallLength(wall) }] };
		expect(expectOk(rotateWallStructure(structure, wall.id, degrees)).openings).toEqual(structure.openings);
	});
});
