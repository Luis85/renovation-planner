import { describe, expect, it } from 'vitest';
import { boundingRectangle, centredFootprint, rectangleCorners } from '../../../../src/presentation/editor/elements/objectShape';

describe('rectangleCorners', () => {
	it('normalises a drag in any direction into clockwise corners from the top-left', () => {
		expect(rectangleCorners({ x: 5000, y: 4000 }, { x: 800, y: 200 })).toEqual([
			{ x: 800, y: 200 }, { x: 5000, y: 200 }, { x: 5000, y: 4000 }, { x: 800, y: 4000 },
		]);
	});

	it.each([[{ x: 10, y: 0 }], [{ x: 0, y: 10 }], [{ x: 0, y: 0 }]])('answers null for a rectangle with no area (%o)', b => {
		expect(rectangleCorners({ x: 0, y: 0 }, b)).toBeNull();
	});
});

describe('boundingRectangle', () => {
	it('boxes an outline', () => {
		expect(boundingRectangle([{ x: 1000, y: 500 }, { x: 3000, y: 2000 }, { x: 2000, y: 2600 }])).toEqual([
			{ x: 1000, y: 500 }, { x: 3000, y: 500 }, { x: 3000, y: 2600 }, { x: 1000, y: 2600 },
		]);
	});

	it.each([[[]], [[{ x: 1, y: 1 }]], [[{ x: 0, y: 0 }, { x: 0, y: 900 }]]])('answers null when there is no area to box (%o)', points => {
		expect(boundingRectangle(points)).toBeNull();
	});
});

describe('centredFootprint', () => {
	it('moves the outline onto its bounding-box middle, so centre plus footprint is the drawn outline', () => {
		const points = [{ x: 1000, y: 1000 }, { x: 2200, y: 1000 }, { x: 2200, y: 1600 }, { x: 1000, y: 1600 }];
		const { centre, footprint } = centredFootprint(points);
		expect(centre).toEqual({ x: 1600, y: 1300 });
		expect(footprint).toEqual([{ x: -600, y: -300 }, { x: 600, y: -300 }, { x: 600, y: 300 }, { x: -600, y: 300 }]);
	});

	it('rounds the middle to whole millimetres and keeps the round trip exact', () => {
		const points = [{ x: 0, y: 0 }, { x: 1001, y: 0 }, { x: 0, y: 3 }];
		const { centre, footprint } = centredFootprint(points);
		expect(Number.isInteger(centre.x) && Number.isInteger(centre.y)).toBe(true);
		expect(footprint.map(point => ({ x: point.x + centre.x, y: point.y + centre.y }))).toEqual(points);
	});
});
