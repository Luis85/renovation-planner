import { describe, expect, it } from 'vitest';
import { EMPTY_STRUCTURE, type Structure, type Wall } from '../../../src/domain/spatial/Structure';
import { enclosedByBoundary, encloseRoom, roomInsideWalls, wallOnEdge } from '../../../src/domain/spatial/encloseRoom';
import { expectOk } from '../../helpers/domain';

const at = (x: number, y: number) => ({ x, y });
const wall = (id: string, start: { x: number; y: number }, end: { x: number; y: number }): Wall => ({ id, start, end, height: 2400, thickness: 150 });
const room = { id: 'room', points: [at(0, 0), at(4000, 0), at(4000, 3000), at(0, 3000)] };
const walls = [wall('wall-north', at(0, 0), at(4000, 0)), wall('wall-east', at(4000, 0), at(4000, 3000)), wall('wall-south', at(4000, 3000), at(0, 3000)), wall('wall-west', at(0, 3000), at(0, 0))];
const enclosed: Structure = { walls, openings: [], boundaries: [{ roomId: room.id, wallIds: walls.map(value => value.id) }] };
const dimensions = { height: 2400, thickness: 150 };
const ids = (prefix: string) => { let count = 0; return () => `wall-${prefix}-${count++}`; };
const ends = (structure: Structure, wallIds: readonly string[]) => wallIds.map(id => structure.walls.find(value => value.id === id)).map(value => [value?.start, value?.end]);

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

describe('encloseRoom', () => {
	it('builds the walls outside the room, their inner faces on its edges, and reuses them when asked again', () => {
		const result = expectOk(encloseRoom(room, EMPTY_STRUCTURE, dimensions, ids('made')));
		expect(ends(result.structure, result.wallIds)).toEqual([[at(-75, -75), at(4075, -75)], [at(4075, -75), at(4075, 3075)], [at(4075, 3075), at(-75, 3075)], [at(-75, 3075), at(-75, -75)]]);
		expect(result.createdIds).toEqual(result.wallIds);
		expect(enclosedByBoundary(room, result.structure)).toBe(true);
		const repeated = expectOk(encloseRoom(room, result.structure, dimensions, ids('again')));
		expect(repeated.createdIds).toEqual([]); expect(repeated.structure.walls).toEqual(result.structure.walls);
	});
	it('keeps one centred wall on an edge another Room shares, which that Room then reuses', () => {
		const neighbour = { id: 'neighbour', points: [at(4000, 0), at(7000, 0), at(7000, 3000), at(4000, 3000)] };
		const first = expectOk(encloseRoom(room, EMPTY_STRUCTURE, dimensions, ids('first'), [neighbour]));
		expect(ends(first.structure, [first.wallIds[1]])).toEqual([[at(4000, -75), at(4000, 3075)]]);
		expect(ends(first.structure, [first.wallIds[0]])).toEqual([[at(-75, -75), at(4000, -75)]]);
		const second = expectOk(encloseRoom(neighbour, first.structure, dimensions, ids('second'), [room]));
		expect(second.wallIds[3]).toBe(first.wallIds[1]); expect(second.createdIds).toHaveLength(3);
		expect(enclosedByBoundary(room, second.structure) && enclosedByBoundary(neighbour, second.structure)).toBe(true);
	});
	it('reuses the wall between two Rooms spaced exactly one wall apart', () => {
		const first = expectOk(encloseRoom(room, EMPTY_STRUCTURE, dimensions, ids('first')));
		const beside = { id: 'beside', points: [at(4150, 0), at(7000, 0), at(7000, 3000), at(4150, 3000)] };
		const second = expectOk(encloseRoom(beside, first.structure, dimensions, ids('second')));
		expect(second.wallIds[3]).toBe(first.wallIds[1]); expect(second.createdIds).toHaveLength(3);
	});
	it('keeps walls already centred on every edge rather than adding a second ring outside them', () => {
		const result = expectOk(encloseRoom(room, enclosed, dimensions, ids('ring')));
		expect(result.createdIds).toEqual([]); expect(result.structure.walls).toEqual(walls);
	});
	it('refuses a straight corner where a shared edge would meet an outside one', () => {
		const long = { id: 'long', points: [at(0, 0), at(2000, 0), at(4000, 0), at(4000, 3000), at(0, 3000)] };
		const above = { id: 'above', points: [at(2000, 0), at(0, 0), at(0, -2000), at(2000, -2000)] };
		expect(encloseRoom(long, EMPTY_STRUCTURE, dimensions, ids('long'), [above])).toMatchObject({ ok: false, error: { code: 'spatial.wall-offset' } });
	});
});

describe('roomInsideWalls', () => {
	it('puts the Room of a closed wall loop on the walls\' inner faces', () => {
		const inside = expectOk(roomInsideWalls(walls));
		expect(inside.points).toEqual([at(75, 75), at(3925, 75), at(3925, 2925), at(75, 2925)]);
		expect(enclosedByBoundary({ id: room.id, ...inside }, enclosed)).toBe(true);
	});
	it('refuses a loop whose inner faces have no corner to meet at', () => {
		const bay = [{ ...wall('bay', at(0, 0), at(200, 0)), bulge: 1 }, wall('b', at(200, 0), at(200, 3000)), wall('c', at(200, 3000), at(0, 3000)), wall('d', at(0, 3000), at(0, 0))];
		expect(roomInsideWalls(bay.map(value => ({ ...value, thickness: 300 })))).toMatchObject({ ok: false, error: { code: 'spatial.wall-offset' } });
	});
});

describe('enclosedByBoundary', () => {
	it('holds while every edge runs exactly along a wall its boundary lists', () => {
		expect(enclosedByBoundary(room, enclosed)).toBe(true);
	});
	it('lets go once one boundary wall moves off its edge, inward included', () => {
		const moved = (x: number) => ({ ...enclosed, walls: walls.map(value => value.id === 'wall-west' ? { ...value, start: at(x, 3000), end: at(x, 0) } : value) });
		expect(enclosedByBoundary(room, moved(-200))).toBe(false);
		expect(enclosedByBoundary(room, moved(75))).toBe(false);
	});
	it('lets go when the boundary names walls that no longer exist', () => {
		expect(enclosedByBoundary(room, { ...enclosed, walls: [] })).toBe(false);
	});
	it('never holds for a room with no boundary, even with walls on every edge', () => {
		expect(enclosedByBoundary(room, { ...enclosed, boundaries: [] })).toBe(false);
	});
});
