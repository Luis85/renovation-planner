import { describe, expect, it } from 'vitest';
import type { Structure, Wall } from '../../../src/domain/spatial/Structure';
import { enclosedByBoundary, wallOnEdge } from '../../../src/domain/spatial/encloseRoom';

const at = (x: number, y: number) => ({ x, y });
const wall = (id: string, start: { x: number; y: number }, end: { x: number; y: number }): Wall => ({ id, start, end, height: 2400, thickness: 150 });
const room = { id: 'room', points: [at(0, 0), at(4000, 0), at(4000, 3000), at(0, 3000)] };
const walls = [wall('north', at(0, 0), at(4000, 0)), wall('east', at(4000, 0), at(4000, 3000)), wall('south', at(4000, 3000), at(0, 3000)), wall('west', at(0, 3000), at(0, 0))];
const enclosed: Structure = { walls, openings: [], boundaries: [{ roomId: room.id, wallIds: walls.map(value => value.id) }] };

describe('wallOnEdge', () => {
	it('finds the wall along an edge in either direction, a reversed one carrying the negated bulge', () => {
		const curved = { ...wall('curved', at(0, 0), at(4000, 0)), bulge: 0.25 };
		expect(wallOnEdge([curved], at(0, 0), at(4000, 0), 0.25)).toBe(curved);
		expect(wallOnEdge([curved], at(4000, 0), at(0, 0), -0.25)).toBe(curved);
		expect(wallOnEdge([curved], at(4000, 0), at(0, 0), 0.25)).toBeUndefined();
		expect(wallOnEdge([curved], at(0, 0), at(4000, 0), 0)).toBeUndefined();
		expect(wallOnEdge(walls, at(4000, 0), at(0, 0), 0)).toBe(walls[0]);
		expect(wallOnEdge(walls, at(0, 0), at(4000, 1), 0)).toBeUndefined();
	});
});

describe('enclosedByBoundary', () => {
	it('holds while every edge runs exactly along a wall its boundary lists', () => {
		expect(enclosedByBoundary(room, enclosed)).toBe(true);
	});
	it('lets go once one boundary wall moves off its edge', () => {
		const moved = { ...enclosed, walls: walls.map(value => value.id === 'west' ? { ...value, start: at(-200, 3000), end: at(-200, 0) } : value) };
		expect(enclosedByBoundary(room, moved)).toBe(false);
	});
	it('lets go when the boundary names walls that no longer exist', () => {
		expect(enclosedByBoundary(room, { ...enclosed, walls: [] })).toBe(false);
	});
	it('never holds for a room with no boundary, even with walls on every edge', () => {
		expect(enclosedByBoundary(room, { ...enclosed, boundaries: [] })).toBe(false);
	});
});
