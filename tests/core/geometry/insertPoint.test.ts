import { describe, expect, it } from 'vitest';
import { insertPathPoint, insertRingPoint } from '../../../src/core/geometry/insertPoint';
import { arcPoint } from '../../../src/core/geometry/circularArc';
import type { Point } from '../../../src/core/geometry/Point';
import { expectDefined } from '../../helpers/domain';

const square = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }];
function expectNear(actual: Point, expected: Point): void {
	expect(actual.x).toBeCloseTo(expected.x, 6);
	expect(actual.y).toBeCloseTo(expected.y, 6);
}

describe('insertRingPoint', () => {
	it('adds the projection onto the nearest edge, the closing edge included', () => {
		expect(insertRingPoint({ points: square }, { x: 3900, y: 1000 }, 10)).toEqual({ points: [square[0], square[1], { x: 4000, y: 1000 }, square[2], square[3]] });
		expect(insertRingPoint({ points: square }, { x: -50, y: 1000 }, 10)).toEqual({ points: [...square, { x: 0, y: 1000 }] });
	});
	it('adds nothing within the tolerance of a corner', () => {
		expect(insertRingPoint({ points: square }, { x: 3995, y: 5 }, 10)).toBeNull();
		expect(insertRingPoint({ points: square }, { x: 3900, y: -50 }, 10)).not.toBeNull();
	});
	it('splits a curved edge into two arcs on the same circle and keeps the other edges', () => {
		const edge = { start: square[0], end: square[1], bulge: 0.5 };
		const next = expectDefined(insertRingPoint({ points: square, bulges: [0.5, 0, 0.2, 0] }, arcPoint(edge, 0.25), 10), 'curved ring');
		const { points } = next, bulges = expectDefined(next.bulges, 'bulges');
		expect(points).toHaveLength(5);
		expectNear(points[1], arcPoint(edge, 0.25));
		expect(bulges.slice(2)).toEqual([0, 0.2, 0]);
		expectNear(arcPoint({ start: points[0], end: points[1], bulge: bulges[0] }, 0.5), arcPoint(edge, 0.125));
		expectNear(arcPoint({ start: points[1], end: points[2], bulge: bulges[1] }, 0.5), arcPoint(edge, 0.625));
	});
});

describe('insertPathPoint', () => {
	const path = [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 2000 }];
	it('adds the projection onto the nearest segment and never closes the chain', () => {
		expect(insertPathPoint(path, { x: 1000, y: 100 }, 10)).toEqual([path[0], { x: 1000, y: 0 }, path[1], path[2]]);
		expect(insertPathPoint(path, { x: 1900, y: 1500 }, 10)).toEqual([path[0], path[1], { x: 2000, y: 1500 }, path[2]]);
		expect(insertPathPoint(path, { x: 1000, y: 900 }, 10)).toEqual([path[0], { x: 1000, y: 0 }, path[1], path[2]]);
	});
	it('adds nothing past either end', () => {
		expect(insertPathPoint(path, { x: -500, y: 0 }, 10)).toBeNull();
		expect(insertPathPoint(path, { x: 2000, y: 2600 }, 10)).toBeNull();
	});
});
