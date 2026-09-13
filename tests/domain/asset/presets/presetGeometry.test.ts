import { describe, expect, it } from 'vitest';
import { createCurvedPolygon, type CurvedPolygon } from '../../../../src/core/geometry/CurvedPolygon';
import { area, boundingBoxOf } from '../../../../src/core/geometry/operations';
import { circle, ringSector, roundFront, stadium } from '../../../../src/domain/asset/presets/presetGeometry';
import { expectOk } from '../../../helpers/domain';

/**
 * Areas are the instrument for bulge SIGNS: an arc bowed the wrong way still has the right bounding
 * box in some shapes, but never the right area.
 */
const size = (outline: CurvedPolygon) => {
	const box = expectOk(boundingBoxOf(outline));
	return [box.max.x - box.min.x, box.max.y - box.min.y];
};
const areaOf = (outline: CurvedPolygon) => Math.abs(expectOk(area(expectOk(createCurvedPolygon(outline)))));

describe('preset geometry', () => {
	it('draws a circle whose arcs bow outward', () => {
		expect(size(circle(900))[0]).toBeCloseTo(900, 9);
		expect(areaOf(circle(900))).toBeCloseTo(Math.PI * 450 ** 2, 6);
	});

	it('draws a stadium along its longer side, exactly', () => {
		expect(size(stadium(1800, 1000)).map((value) => Math.round(value))).toEqual([1800, 1000]);
		expect(size(stadium(400, 900)).map((value) => Math.round(value))).toEqual([400, 900]);
		expect(areaOf(stadium(1800, 1000))).toBeCloseTo(800 * 1000 + Math.PI * 500 ** 2, 6);
	});

	it('draws a toilet silhouette: a rectangle with a semicircular front', () => {
		expect(size(roundFront(380, 700)).map((value) => Math.round(value))).toEqual([380, 700]);
		expect(areaOf(roundFront(380, 700))).toBeCloseTo(380 * (700 - 190) + (Math.PI * 190 ** 2) / 2, 6);
	});

	it('draws a ring sector with a convex outer and a concave inner arc, centred on the origin', () => {
		const sector = ringSector(1500, 600, 90);
		const box = expectOk(boundingBoxOf(sector));
		expect(box.min.y + box.max.y).toBeCloseTo(0, 6);
		expect(areaOf(sector)).toBeCloseTo((Math.PI / 4) * (1500 ** 2 - 900 ** 2), 4);
	});
});
