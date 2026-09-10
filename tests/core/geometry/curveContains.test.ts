import { expect, it } from 'vitest';
import { curvedContains } from '../../../src/core/geometry/curveContains';

const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

it('treats an edge missing its own bulge entry as straight rather than throwing', () => {
	// A `bulges` array shorter than `points` leaves every edge past index 0 without an entry;
	// the module still has to answer a real containment question for those edges.
	const shape = { points: square, bulges: [0] };
	expect(curvedContains(shape, { x: 5, y: 5 })).toBe(true);
	expect(curvedContains(shape, { x: 20, y: 20 })).toBe(false);
});
