import { describe, expect, it } from 'vitest';
import { createCurvedPolygon, type CurvedPolygon } from '../../../../src/core/geometry/CurvedPolygon';
import { area, boundingBoxOf } from '../../../../src/core/geometry/operations';
import { circle, ringSector, roundFront, roundedRect, stadium } from '../../../../src/domain/asset/presets/presetGeometry';
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

/** A quarter circle's bulge — `tan(90°/4)`, the value a circle's four edges already carry. */
const QUARTER = Math.tan(Math.PI / 8);

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

	it('draws a stadium with equal sides as the circle it is', () => {
		expect(stadium(500, 500)).toEqual(circle(500));
	});

	it('draws a toilet silhouette: a rectangle with a semicircular front', () => {
		expect(size(roundFront(380, 700)).map((value) => Math.round(value))).toEqual([380, 700]);
		expect(areaOf(roundFront(380, 700))).toBeCloseTo(380 * (700 - 190) + (Math.PI * 190 ** 2) / 2, 6);
	});

	/**
	 * Area is the instrument, for this file's own stated reason: a rounded rectangle whose corner
	 * arcs bow INWARD has the identical bounding box and loses 4r² − πr² of area instead of gaining
	 * it. The expected figure is the rectangle less the four square corners plus the circle those
	 * quarters make — which is only the right number if every corner really is a quarter circle.
	 */
	it('draws a rectangle with four exact quarter-circle corners, bowed outward', () => {
		const rounded = roundedRect(1000, 600, 150);

		expect(size(rounded).map((value) => Math.round(value))).toEqual([1000, 600]);
		expect(areaOf(rounded)).toBeCloseTo(1000 * 600 - 4 * 150 ** 2 + Math.PI * 150 ** 2, 6);
	});

	it('gives every corner the same arc and every straight edge none', () => {
		expect(roundedRect(1000, 600, 150).bulges).toEqual([0, QUARTER, 0, QUARTER, 0, QUARTER, 0, QUARTER]);
	});

	it('centres on the point it is given', () => {
		const box = expectOk(boundingBoxOf(roundedRect(400, 400, 100, 250, -80)));
		expect([(box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2]).toEqual([250, -80]);
	});

	/**
	 * The ceiling the derived radius stays under. At exactly half the shorter side two of the eight
	 * points coincide, which is a zero-length edge; above it the outline crosses itself. Neither is
	 * guarded in `roundedRect` — `roundedRectOutline` derives a quarter of the shorter side, so
	 * neither is reachable from the product — and this case is what says the refusal is the
	 * constructor's rather than absent.
	 */
	it('is refused by the constructor above the half-side ceiling, rather than drawn wrong', () => {
		expect(expectOk(createCurvedPolygon(roundedRect(1000, 600, 299))).points).toHaveLength(8);
		expect(createCurvedPolygon(roundedRect(1000, 600, 400)).ok).toBe(false);
	});

	it('draws a ring sector with a convex outer and a concave inner arc, centred on the origin', () => {
		const sector = ringSector(1500, 600, 90);
		const box = expectOk(boundingBoxOf(sector));
		expect(box.min.y + box.max.y).toBeCloseTo(0, 6);
		expect(areaOf(sector)).toBeCloseTo((Math.PI / 4) * (1500 ** 2 - 900 ** 2), 4);
	});
});
