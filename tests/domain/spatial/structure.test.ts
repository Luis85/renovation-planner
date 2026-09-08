import { describe, expect, it } from 'vitest';
import { EMPTY_STRUCTURE, alongWall, openingPoints, wallLength, type Opening, type Structure, type Wall } from '../../../src/domain/spatial/Structure';
import { closedChain, editWall, scaleStructure, validateStructure, validSpatialPoint, wallsConflict } from '../../../src/domain/spatial/structureGeometry';

const wall: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 150 };
const opening: Opening = { id: 'opening-a', kind: 'door', hostId: wall.id, offset: 500, width: 900, height: 2100, sill: 0 };
const structure: Structure = { walls: [wall], openings: [opening], boundaries: [] };
const line = (x1: number, y1: number, x2: number, y2: number) => ({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });

describe('ADR-0020 spatial geometry', () => {
	it('derives hosted positions and scales every normalized measurement exactly once', () => {
		expect(wallLength(wall)).toBe(4000);
		expect(alongWall(wall, 500)).toEqual({ x: 500, y: 0 });
		expect(openingPoints(opening, [wall])).toEqual([{ x: 500, y: 0 }, { x: 1400, y: 0 }]);
		expect(openingPoints(opening, [])).toEqual([]);
		expect(scaleStructure(structure, 2)).toEqual({ walls: [{ ...wall, end: { x: 8000, y: 0 }, height: 4800, thickness: 300 }], openings: [{ ...opening, offset: 1000, width: 1800, height: 4200, sill: 0 }], boundaries: [] });
	});
	it.each([
		[line(0, 0, 10, 0), line(10, 0, 10, 10), false],
		[line(0, 0, 10, 0), line(10, 0, 20, 0), false],
		[line(0, 0, 10, 0), line(0, 0, -10, 0), false],
		[line(0, 0, 10, 0), line(0, 0, 5, 0), true],
		[line(0, 0, 10, 0), line(10, 0, 5, 0), true],
		[line(0, 0, 10, 0), line(10, 0, 0, 0), true],
		[line(0, 0, 10, 0), line(5, -5, 5, 5), true],
		[line(0, 0, 10, 0), line(5, 0, 5, 5), true],
		[line(0, 0, 10, 0), line(5, 5, 5, 0), true],
		[line(0, 0, 10, 0), line(-1, 0, 11, 0), true],
		[line(0, 0, 10, 0), line(20, 0, 30, 0), false],
		[line(0, 0, 10, 0), line(0, 10, 10, 10), false],
	])('handles endpoint connectivity and intersection %#', (a, b, expected) => expect(wallsConflict(a, b)).toBe(expected));
	it('accepts touching openings and separate hosts, refuses horizontal overlap even at different heights', () => {
		expect(validateStructure(structure, []).ok).toBe(true);
		const second = { ...opening, id: 'opening-b', offset: 1400 };
		expect(validateStructure({ ...structure, openings: [opening, second] }, []).ok).toBe(true);
		expect(validateStructure({ ...structure, openings: [opening, { ...second, offset: 1399 }] }, [])).toMatchObject({ ok: false, error: { code: 'spatial.opening-overlap' } });
		expect(validateStructure({ ...structure, walls: [wall, { ...wall, id: 'wall-b', start: { x: 0, y: 1000 }, end: { x: 4000, y: 1000 } }], openings: [opening, { ...second, hostId: 'wall-b', offset: 500 }] }, []).ok).toBe(true);
	});
	it.each([
		{ id: 'wrong' }, { height: 0 }, { height: Infinity }, { thickness: NaN }, { thickness: -1 },
		{ start: { x: 1e10, y: 0 } }, { end: { x: 0, y: 0 } }, { end: { x: 1e7, y: 0 } },
	])('refuses invalid wall values %#', update => expect(validateStructure({ ...EMPTY_STRUCTURE, walls: [{ ...wall, ...update }] }, []).ok).toBe(false));
	it.each([
		{ id: 'wrong' }, { width: 0 }, { height: 0 }, { width: Infinity }, { offset: -1 }, { offset: NaN },
		{ offset: 3500 }, { height: 2500 }, { sill: -1 }, { sill: 500 }, { sill: Infinity },
	])('refuses invalid opening containment %#', update => expect(validateStructure({ ...structure, openings: [{ ...opening, ...update }] }, []).ok).toBe(false));
	it('refuses missing hosts, duplicate IDs and malformed room associations', () => {
		expect(validateStructure({ ...structure, openings: [{ ...opening, hostId: 'gone' }] }, [])).toMatchObject({ error: { code: 'spatial.host-missing' } });
		expect(validateStructure({ ...structure, openings: [opening, opening] }, []).ok).toBe(false);
		expect(validateStructure({ ...structure, walls: [wall, { ...wall, id: '' }] }, []).ok).toBe(false);
		for (const wallIds of [[], ['wall-a', 'wall-a', 'wall-a'], ['wall-a', 'wall-b', 'wall-c']]) {
			expect(validateStructure({ ...structure, boundaries: [{ roomId: 'zone-room', wallIds }] }, ['zone-room']).ok).toBe(false);
		}
	});
	it('moves exactly the connected end junction and preserves opening offsets', () => {
		const b = { ...wall, id: 'wall-b', start: wall.end, end: { x: 4000, y: 3000 } };
		const c = { ...wall, id: 'wall-c', start: { x: 4000, y: -3000 }, end: wall.end };
		const before = { ...structure, walls: [wall, b, c], boundaries: [{ roomId: 'room', wallIds: [wall.id, b.id, c.id] }] };
		const moved = editWall(before, { ...wall, end: { x: 4500, y: 0 } });
		expect(moved.walls.map(item => [item.start, item.end])).toEqual([[wall.start, { x: 4500, y: 0 }], [{ x: 4500, y: 0 }, b.end], [c.start, { x: 4500, y: 0 }]]);
		expect(moved.openings).toEqual(before.openings);
		expect(moved.boundaries).toEqual(before.boundaries);
		expect(validateStructure(moved, ['room']).ok).toBe(true);
		expect(validateStructure(moved, []).ok).toBe(false);
		expect(validateStructure({ ...moved, boundaries: [...moved.boundaries, ...moved.boundaries] }, ['room']).ok).toBe(false);
		expect(editWall(before, { ...wall, id: 'absent' })).toBe(before);
	});
	it('detects explicit closure and coordinate limits', () => {
		expect(closedChain([])).toBe(false);
		expect(closedChain([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 0 }])).toBe(true);
		expect(closedChain([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }])).toBe(false);
		expect(validSpatialPoint({ x: -1e9, y: 1e9 })).toBe(true);
		expect(validSpatialPoint({ x: 0, y: Infinity })).toBe(false);
	});
});
