import { describe, expect, it } from 'vitest';
import { BOX_HANDLE_COUNT, boxHandlePoint, boxResize } from '../../../src/core/geometry/boxHandles';

const box = { min: { x: 0, y: 0 }, max: { x: 400, y: 200 } };

describe('box handles', () => {
	it('places eight handles clockwise from the top-left', () => {
		expect(Array.from({ length: BOX_HANDLE_COUNT }, (_, index) => boxHandlePoint(box, index))).toEqual([
			{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 100 },
			{ x: 400, y: 200 }, { x: 200, y: 200 }, { x: 0, y: 200 }, { x: 0, y: 100 },
		]);
	});

	it('resizes from a corner about the opposite corner', () => {
		expect(boxResize(box, 4, { x: 800, y: 300 }, false)).toEqual({ factors: { sx: 2, sy: 1.5 }, origin: { x: 0, y: 0 } });
	});

	it('holds a side handle’s other axis at exactly 1', () => {
		expect(boxResize(box, 3, { x: 600, y: 999 }, false)).toEqual({ factors: { sx: 1.5, sy: 1 }, origin: { x: 0, y: 100 } });
	});

	it('keeps proportions with Shift, taking whichever factor strays further from 1', () => {
		expect(boxResize(box, 4, { x: 800, y: 300 }, true).factors).toEqual({ sx: 2, sy: 2 });
		expect(boxResize(box, 3, { x: 600, y: 100 }, true).factors).toEqual({ sx: 1.5, sy: 1.5 });
	});

	it('answers a non-positive factor when dragged past the fixed side', () => {
		expect(boxResize(box, 4, { x: -100, y: 200 }, false).factors.sx).toBeLessThan(0);
	});
});
