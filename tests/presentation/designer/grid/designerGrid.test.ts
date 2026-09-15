import { describe, expect, it } from 'vitest';
import { designerGrid } from '../../../../src/presentation/designer/grid/designerGrid';
import { editableShape } from '../../../helpers/assetShapes';

/** Asset designer snapping spec 2026-09-15, §2.4: a step the screen can afford, counted from the footprint's corner. */
describe('designerGrid', () => {
	it.each([
		[0.05, 1],
		[0.25, 5],
		[0.5, 10],
		[1, 50],
		[5, 100],
		[10, 500],
		[100, 5000], // MIN_ZOOM's camera
		[1000, 5000], // past the series, the coarsest step is kept
	])('at %f mm per pixel the step is %i mm — the smallest of the series at least 12 px wide', (worldPerPixel, step) => {
		expect(designerGrid(null, worldPerPixel).step).toBe(step);
	});

	it('counts from the footprint’s top-left corner, so an offset from an edge is a whole number of steps', () => {
		expect(designerGrid(editableShape(), 1).origin).toEqual({ x: -500, y: -300 });
	});

	it('counts from the world origin before there is a footprint', () => {
		expect(designerGrid(null, 1).origin).toEqual({ x: 0, y: 0 });
	});
});
