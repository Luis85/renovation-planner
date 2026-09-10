import { expect, it } from 'vitest';
import { curveMoments, curvedCentroid } from '../../../src/core/geometry/curveMeasures';

/**
 * `validateBulges` refuses a list that is not one value per edge, so everything reaching these
 * two through `operations` carries a complete one. Both are exported, and a caller arriving
 * directly gets the straight-edge fallback for an edge with no value of its own rather than a
 * NaN measurement propagated through the whole contour.
 */
const SQUARE = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];

it('measures an edge with no bulge value of its own as straight rather than as NaN', () => {
	const short = curveMoments({ points: SQUARE, bulges: [0.5] });
	expect(short).toEqual(curveMoments({ points: SQUARE, bulges: [0.5, 0, 0, 0] }));
	for (const value of Object.values(short)) expect(Number.isFinite(value)).toBe(true);
	// The described edge still bends, so the fallback is not simply ignoring every bulge.
	expect(short.area).not.toBe(curveMoments({ points: SQUARE }).area);
});

it('centres a partially described contour on the same point as its fully described equal', () => {
	const centre = curvedCentroid({ points: SQUARE, bulges: [0.5] });
	expect(centre).toEqual(curvedCentroid({ points: SQUARE, bulges: [0.5, 0, 0, 0] }));
	expect(Number.isFinite(centre.x) && Number.isFinite(centre.y)).toBe(true);
});
