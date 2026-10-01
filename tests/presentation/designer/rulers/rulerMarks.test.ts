/**
 * Where a designer ruler puts its NUMBERS (asset designer snapping spec 2026-09-15, §0 increment 3).
 *
 * A node test: the answer is arithmetic over the step `designerGrid` already chose, and nothing here
 * touches a camera, a store or a `.vue` file. The mounted half — that those values reach the strips at
 * the right pixel — is `designerRulers.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { rulerLabels } from '../../../../src/presentation/designer/rulers/rulerMarks';

describe('the labelled marks of a designer ruler', () => {
	it('numbers every fifth step, counted from the grid’s own origin', () => {
		expect(rulerLabels(10, 0, 200)).toEqual([0, 50, 100, 150, 200]);
	});

	it('counts backwards through zero, so the footprint’s corner is where the ruler reads 0', () => {
		expect(rulerLabels(10, -120, 60)).toEqual([-100, -50, 0, 50]);
	});

	it('includes a span’s own ends rather than stopping inside them', () => {
		expect(rulerLabels(100, 500, 1000)).toEqual([500, 1000]);
	});

	it('answers nothing for a span no labelled mark falls in', () => {
		expect(rulerLabels(10, 1, 49)).toEqual([]);
	});

	/**
	 * `designerGrid`'s largest step, at a camera far enough out to make its labelled spacing
	 * 25 metres: the values stay exact integers rather than drifting by repeated addition.
	 */
	it('keeps the values exact at the widest step', () => {
		expect(rulerLabels(5000, -25_000, 50_000)).toEqual([-25_000, 0, 25_000, 50_000]);
	});
});
