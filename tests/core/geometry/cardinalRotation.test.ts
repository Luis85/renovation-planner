import { expect, it } from 'vitest';
import { rotate } from '../../../src/core/geometry/operations';

it.each([
	[Math.PI / 2, { x: -2, y: 6 }], [Math.PI, { x: -1, y: -1 }], [3 * Math.PI / 2, { x: 6, y: 0 }],
	[-Math.PI / 2, { x: 6, y: 0 }], [2 * Math.PI, { x: 5, y: 7 }], [-2 * Math.PI, { x: 5, y: 7 }],
] as const)('rotates a point exactly through cardinal angle %s about its fixed origin', (radians, expected) => {
	expect(rotate({ x: 5, y: 7 }, radians, { x: 2, y: 3 })).toEqual(expected);
});
it('retains arbitrary-angle trigonometry and nonfinite propagation', () => {
	const point = rotate({ x: 5, y: 7 }, Math.PI / 4, { x: 2, y: 3 });
	expect(point.x).toBeCloseTo(2 - 1 / Math.sqrt(2), 12); expect(point.y).toBeCloseTo(3 + 7 / Math.sqrt(2), 12);
	expect(Number.isNaN(rotate({ x: 5, y: 7 }, Infinity, { x: 2, y: 3 }).x)).toBe(true);
});
