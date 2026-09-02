import { describe, expect, it } from 'vitest';
import {
	measurementScreenMarks,
	sketchScreenGeometry,
	type ToScreen,
} from '../../../src/presentation/editor/layers/gestureGeometry';
import { screenPoint } from '../../../src/presentation/editor/viewport/Viewport';

/**
 * A camera that doubles every coordinate: enough to prove the projection is applied.
 *
 * Through `screenPoint` rather than an object literal, because `ScreenPoint` is BRANDED and
 * that function is its only minting door — a stand-in returning a bare `{ x, y }` does not
 * compile, which is the point of the brand.
 */
const doubled: ToScreen = (point) => screenPoint(point.x * 2, point.y * 2);

describe('sketchScreenGeometry', () => {
	it('answers null for no sketch', () => {
		expect(sketchScreenGeometry(null, doubled)).toBeNull();
	});

	it('projects the placed vertices and appends the loose next vertex to the outline', () => {
		const geometry = sketchScreenGeometry(
			{ vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }], pointer: { x: 10, y: 10 }, nextVertex: { x: 10, y: 10 } },
			doubled,
		);
		expect(geometry?.vertices).toEqual([{ x: 0, y: 0 }, { x: 20, y: 0 }]);
		expect(geometry?.outlineFlat).toEqual([0, 0, 20, 0, 20, 20]);
		expect(geometry?.closeArmed).toBe(false);
	});

	it('has no outline under two points and never arms the close target under three vertices', () => {
		const geometry = sketchScreenGeometry(
			{ vertices: [{ x: 0, y: 0 }], pointer: { x: 0, y: 0 }, nextVertex: null },
			doubled,
		);
		expect(geometry?.outlineFlat).toBeNull();
		expect(geometry?.closeArmed).toBe(false);
	});

	/**
	 * The two arms the mounted surfaces only reach incidentally, asked of the arithmetic
	 * directly so they are pinned rather than inherited.
	 *
	 * A `null` pointer is a REAL state: `DrawPolygonTool.pointerDown` publishes
	 * `(null, null)` the moment a close click lands, so the band comes down while the
	 * dispatch runs. Empty `vertices` is not a state any tool produces — `pointerMove`
	 * returns on an empty buffer and every `publishSketch` call has one vertex at least — but
	 * `PolygonSketch.vertices` admits it, and the `first !== undefined` guard is what narrows
	 * `.at(0)` for `closesPolygon`. Asked here because a guard that is only a type narrowing
	 * still has a behaviour, and this is the end that can state it.
	 */
	it('arms nothing without a pointer, and nothing for a sketch with no placed vertices', () => {
		const placed = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
		expect(sketchScreenGeometry({ vertices: placed, pointer: null, nextVertex: null }, doubled)?.closeArmed).toBe(
			false,
		);
		expect(
			sketchScreenGeometry({ vertices: [], pointer: { x: 0, y: 0 }, nextVertex: null }, doubled),
		).toEqual({ vertices: [], outlineFlat: null, closeArmed: false });
	});

	it('arms the close target when the POINTER is within reach of the first vertex on screen', () => {
		const sketch = {
			vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
			pointer: { x: 3, y: 0 },
			nextVertex: { x: 3, y: 0 },
		};
		// 3 world units doubled is 6 screen pixels: inside the twelve a close click takes.
		expect(sketchScreenGeometry(sketch, doubled)?.closeArmed).toBe(true);
		// 10 world units doubled is 20 screen pixels: outside it.
		expect(sketchScreenGeometry({ ...sketch, pointer: { x: 10, y: 0 } }, doubled)?.closeArmed).toBe(false);
	});
});

describe('measurementScreenMarks', () => {
	it('answers null for no measurement, and ruler marks between the projected ends otherwise', () => {
		expect(measurementScreenMarks(null, doubled)).toBeNull();
		const marks = measurementScreenMarks({ start: { x: 0, y: 0 }, end: { x: 50, y: 0 } }, doubled);
		expect(marks?.spine).toEqual([0, 0, 100, 0]);
	});
});
