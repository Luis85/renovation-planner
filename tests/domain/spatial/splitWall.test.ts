import { describe, expect, it } from 'vitest';
import { alongWall, wallLength, type Structure, type Wall } from '../../../src/domain/spatial/Structure';
import { splitWall } from '../../../src/domain/spatial/splitWall';
import { validateStructure } from '../../../src/domain/spatial/structureGeometry';
import { expectErr, expectOk } from '../../helpers/domain';

const wall: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 150 };
const other: Wall = { id: 'wall-b', start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 }, height: 2400, thickness: 150 };
const door = { id: 'opening-door', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 900, height: 2100, sill: 0 };
const pane = { id: 'opening-pane', kind: 'window' as const, hostId: 'wall-a', offset: 2500, width: 900, height: 1200, sill: 900 };
const structure: Structure = { walls: [wall, other], openings: [door, pane], boundaries: [{ roomId: 'room-a', wallIds: ['wall-b', 'wall-a', 'wall-x'] }] };

describe('splitWall', () => {
	it('cuts a straight wall into two joined halves and keeps every opening where it is on the plan', () => {
		const { structure: split, point } = expectOk(splitWall(structure, 'wall-a', 2000, 'wall-new'));
		expect(point).toEqual({ x: 2000, y: 0 });
		expect(split.walls).toEqual([{ ...wall, end: point }, { ...wall, id: 'wall-new', start: point }, other]);
		expect(split.openings).toEqual([door, { ...pane, hostId: 'wall-new', offset: 500 }]);
		expect(split.boundaries).toEqual([{ roomId: 'room-a', wallIds: ['wall-b', 'wall-a', 'wall-new', 'wall-x'] }]);
	});

	it('lets a new wall join at the cut, which the uncut wall refuses as a T junction', () => {
		const branch: Wall = { id: 'wall-branch', start: { x: 2000, y: 0 }, end: { x: 2000, y: 1500 }, height: 2400, thickness: 150 };
		const plain = { ...structure, boundaries: [] };
		expect(expectErr(validateStructure({ ...plain, walls: [...plain.walls, branch] }, [])).code).toBe('spatial.intersection');
		const { structure: split } = expectOk(splitWall(plain, 'wall-a', 2000, 'wall-new'));
		expect(validateStructure({ ...split, walls: [...split.walls, branch] }, []).ok).toBe(true);
	});

	it('refuses a cut through an opening and leaves an opening that ends or starts at the cut alone', () => {
		expect(expectErr(splitWall(structure, 'wall-a', 900, 'wall-new')).code).toBe('spatial.opening-split');
		expect(expectOk(splitWall(structure, 'wall-a', 1400, 'wall-new')).structure.openings[0]).toEqual(door);
		expect(expectOk(splitWall(structure, 'wall-a', 2500, 'wall-new')).structure.openings[1]).toEqual({ ...pane, hostId: 'wall-new', offset: 0 });
	});

	it('cuts nothing at either end and answers that end', () => {
		expect(expectOk(splitWall(structure, 'wall-a', 0, 'wall-new'))).toEqual({ structure, point: wall.start });
		expect(expectOk(splitWall(structure, 'wall-a', 4000, 'wall-new'))).toEqual({ structure, point: wall.end });
	});

	it('refuses a wall that is not there', () => {
		expect(expectErr(splitWall(structure, 'wall-missing', 100, 'wall-new')).code).toBe('spatial.host-missing');
	});

	it('splits a curved wall into two arcs of the same circle', () => {
		const curved: Wall = { ...wall, bulge: 0.4 }, length = wallLength(curved), cut = length / 3;
		const { structure: split, point } = expectOk(splitWall({ walls: [curved], openings: [], boundaries: [] }, 'wall-a', cut, 'wall-new'));
		const [first, second] = split.walls;
		expect(point).toEqual(alongWall(curved, cut));
		expect(wallLength(first)).toBeCloseTo(cut, 6); expect(wallLength(second)).toBeCloseTo(length - cut, 6);
		const onFirst = alongWall(first, cut / 2), onCurve = alongWall(curved, cut / 2);
		expect(onFirst.x).toBeCloseTo(onCurve.x, 6); expect(onFirst.y).toBeCloseTo(onCurve.y, 6);
		const onSecond = alongWall(second, cut), onCurveLater = alongWall(curved, 2 * cut);
		expect(onSecond.x).toBeCloseTo(onCurveLater.x, 6); expect(onSecond.y).toBeCloseTo(onCurveLater.y, 6);
		expect(validateStructure(split, []).ok).toBe(true);
	});
});
