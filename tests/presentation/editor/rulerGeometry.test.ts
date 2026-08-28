import { describe, expect, it } from 'vitest';
import { screenPoint, type ScreenPoint } from '../../../src/presentation/editor/viewport/Viewport';
import {
	rulerMarks,
	RULER_END_BAR_HALF_PX,
	RULER_MAJOR_TICK_EVERY,
	RULER_MAJOR_TICK_PX,
	RULER_MAX_TICKS,
	RULER_MINOR_TICK_PX,
	RULER_TICK_SPACING_PX,
} from '../../../src/presentation/editor/layers/rulerGeometry';

/**
 * The calibration segment's ruler marks — end bars and ticks — as pure screen-space
 * geometry, so the shape can be asserted without a canvas. jsdom lays nothing out and draws
 * nothing, so a function that returns coordinates is the only part of "does this look like a
 * ruler" any automated gate here can reach; whether it READS as one is a capture read by eye
 * (`npm run harness`), which is what this project already says about every spacing question.
 *
 * Everything below is in STAGE PIXELS. The marks are deliberately not world-space: the
 * segment is being drawn on a plan that is usually still uncalibrated, so a tick spacing in
 * millimetres would be a measurement nobody has taken yet.
 */

function length(mark: readonly number[]): number {
	return Math.hypot(mark[2] - mark[0], mark[3] - mark[1]);
}

/** The dot product of a mark's direction with the spine's, which is 0 when perpendicular. */
function alignmentWithSpine(mark: readonly number[], from: ScreenPoint, to: ScreenPoint): number {
	const spineLength = Math.hypot(to.x - from.x, to.y - from.y);
	const spine = { x: (to.x - from.x) / spineLength, y: (to.y - from.y) / spineLength };
	const markLength = length(mark);
	return ((mark[2] - mark[0]) * spine.x + (mark[3] - mark[1]) * spine.y) / markLength;
}

describe('rulerMarks', () => {
	it('draws the spine between the two points it is given', () => {
		const marks = rulerMarks(screenPoint(10, 20), screenPoint(110, 20));

		expect(marks.spine).toEqual([10, 20, 110, 20]);
	});

	it('caps each end with a bar perpendicular to the spine, centred on the endpoint', () => {
		const from = screenPoint(0, 0);
		const to = screenPoint(100, 0);

		const marks = rulerMarks(from, to);

		expect(marks.endBars).toHaveLength(2);
		for (const bar of marks.endBars) {
			expect(alignmentWithSpine(bar, from, to)).toBeCloseTo(0);
			expect(length(bar)).toBeCloseTo(RULER_END_BAR_HALF_PX * 2);
		}
		// Centred: the bar's midpoint is the endpoint itself, which is what makes the pair
		// read as the ends of a measurement rather than as two marks beside it.
		expect([(marks.endBars[0][0] + marks.endBars[0][2]) / 2, (marks.endBars[0][1] + marks.endBars[0][3]) / 2])
			.toEqual([from.x, from.y]);
		expect([(marks.endBars[1][0] + marks.endBars[1][2]) / 2, (marks.endBars[1][1] + marks.endBars[1][3]) / 2])
			.toEqual([to.x, to.y]);
	});

	it('keeps the bars perpendicular on a diagonal too', () => {
		const from = screenPoint(0, 0);
		const to = screenPoint(60, 80); // a 3-4-5 triangle: length 100, no rounding to hide behind

		const marks = rulerMarks(from, to);

		for (const bar of marks.endBars) {
			expect(alignmentWithSpine(bar, from, to)).toBeCloseTo(0);
			expect(length(bar)).toBeCloseTo(RULER_END_BAR_HALF_PX * 2);
		}
		for (const tick of marks.ticks) {
			expect(alignmentWithSpine(tick, from, to)).toBeCloseTo(0);
		}
	});

	it('spaces the ticks evenly along the spine and leaves both ends to the bars', () => {
		const marks = rulerMarks(screenPoint(0, 0), screenPoint(RULER_TICK_SPACING_PX * 4, 0));

		// Three interior ticks for four intervals: the ones at 0 and at the far end would sit
		// exactly under the end bars, which is a heavier mark saying the same thing twice.
		expect(marks.ticks.map((tick) => tick[0])).toEqual([
			RULER_TICK_SPACING_PX,
			RULER_TICK_SPACING_PX * 2,
			RULER_TICK_SPACING_PX * 3,
		]);
	});

	it('draws every fifth tick longer, the way a ruler marks its counting unit', () => {
		const spine = RULER_TICK_SPACING_PX * (RULER_MAJOR_TICK_EVERY + 1);
		const marks = rulerMarks(screenPoint(0, 0), screenPoint(spine, 0));

		const lengths = marks.ticks.map((tick) => Math.round(length(tick)));
		expect(lengths.at(RULER_MAJOR_TICK_EVERY - 1)).toBe(RULER_MAJOR_TICK_PX);
		expect(lengths.at(0)).toBe(RULER_MINOR_TICK_PX);
	});

	it('puts the ticks on ONE side of the spine, so the marks read as a rule rather than a fence', () => {
		const marks = rulerMarks(screenPoint(0, 100), screenPoint(200, 100));

		for (const tick of marks.ticks) {
			// Horizontal spine: one end of every tick sits on it, the other on the same side.
			expect(tick[1]).toBe(100);
			expect(tick[3]).toBeGreaterThan(100);
		}
	});

	/**
	 * A long segment at a high zoom is exactly where a per-pixel spacing would emit
	 * thousands of Konva nodes into a layer that redraws on every pointer move. The spacing
	 * doubles instead, which keeps the marks evenly spaced — a ruler whose ticks are simply
	 * worth more — rather than truncating the run half way along the segment.
	 */
	it('doubles the spacing rather than emitting an unbounded number of ticks', () => {
		const marks = rulerMarks(screenPoint(0, 0), screenPoint(RULER_TICK_SPACING_PX * 5000, 0));

		expect(marks.ticks.length).toBeLessThanOrEqual(RULER_MAX_TICKS);
		expect(marks.ticks.length).toBeGreaterThan(0);
		// Still evenly spaced, just coarser: consecutive gaps are equal.
		const gaps = marks.ticks.slice(1).map((tick, index) => tick[0] - marks.ticks[index][0]);
		for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]);
	});

	/**
	 * The first click places a zero-length segment on purpose (`CalibrateTool.pointerDown`),
	 * so the anchor is visible before the pointer has moved anywhere. There is no direction
	 * to be perpendicular to, and a `NaN` here would put the whole layer's node tree into an
	 * unrenderable state rather than merely drawing the wrong thing.
	 */
	it('still draws a bar at a zero-length segment, where there is no direction to take', () => {
		const marks = rulerMarks(screenPoint(40, 50), screenPoint(40, 50));

		expect(marks.ticks).toEqual([]);
		expect(marks.endBars).toHaveLength(2);
		for (const bar of marks.endBars) {
			expect(bar.every((value) => Number.isFinite(value))).toBe(true);
			expect(length(bar)).toBeCloseTo(RULER_END_BAR_HALF_PX * 2);
		}
	});

	/**
	 * The bound is `index * spacing < length`, not a count of whole intervals — the two differ
	 * on every length that is not an exact multiple, and the count version dropped the last
	 * interior tick and left a gap wider than the spacing before the end bar. Reported by a
	 * review bot on the pull request that introduced this module.
	 */
	it('keeps the last interior tick when the length is not a whole number of spacings', () => {
		const spineLength = RULER_TICK_SPACING_PX * 4 + 3; // 35 px at the default spacing
		const marks = rulerMarks(screenPoint(0, 0), screenPoint(spineLength, 0));

		expect(marks.ticks.map((tick) => tick[0])).toEqual([
			RULER_TICK_SPACING_PX,
			RULER_TICK_SPACING_PX * 2,
			RULER_TICK_SPACING_PX * 3,
			RULER_TICK_SPACING_PX * 4,
		]);
	});

	it('gives a segment barely longer than one spacing its one tick', () => {
		const marks = rulerMarks(screenPoint(0, 0), screenPoint(RULER_TICK_SPACING_PX * 2 - 1, 0));

		expect(marks.ticks.map((tick) => tick[0])).toEqual([RULER_TICK_SPACING_PX]);
	});

	it('draws no ticks on a segment shorter than one spacing', () => {
		const marks = rulerMarks(screenPoint(0, 0), screenPoint(RULER_TICK_SPACING_PX - 1, 0));

		expect(marks.ticks).toEqual([]);
	});
});
