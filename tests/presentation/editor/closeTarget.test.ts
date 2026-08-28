import { describe, expect, it } from 'vitest';
import { screenPoint } from '../../../src/presentation/editor/viewport/Viewport';
import { closesPolygon, POLYGON_MIN_VERTICES } from '../../../src/presentation/editor/closeTarget';
import { POLYGON_CLOSE_GRAB_RADIUS_PX } from '../../../src/presentation/editor/handleMetrics';

/**
 * The one predicate behind both halves of closing a polygon: the click that acts
 * (`DrawPolygonTool`) and the mark that promises it (`InteractionLayer`'s close target).
 *
 * It is asked in SCREEN pixels, which is what lets both callers share it — the tool projects
 * its world click through the camera it holds, the layer asks it of projections it has
 * already made — and it is a function rather than a stored flag, so no camera change can
 * leave the mark saying something the click will not do.
 */
describe('closesPolygon', () => {
	const first = screenPoint(100, 100);

	it('refuses a buffer too small to enclose anything, however close the pointer', () => {
		for (let count = 0; count < POLYGON_MIN_VERTICES; count += 1) {
			expect(closesPolygon(count, first, first)).toBe(false);
		}
	});

	it('accepts a pointer inside the grab radius and refuses one outside it', () => {
		const inside = screenPoint(first.x + POLYGON_CLOSE_GRAB_RADIUS_PX - 1, first.y);
		const outside = screenPoint(first.x + POLYGON_CLOSE_GRAB_RADIUS_PX + 1, first.y);

		expect(closesPolygon(POLYGON_MIN_VERTICES, inside, first)).toBe(true);
		expect(closesPolygon(POLYGON_MIN_VERTICES, outside, first)).toBe(false);
	});

	it('accepts the boundary itself, so the mark and the click agree at the edge', () => {
		// Exactly on the radius, and diagonal rather than axis-aligned: the rule is a
		// distance, not a bounding box, and a 3-4-5 triangle says so without rounding.
		const onTheEdge = screenPoint(
			first.x + POLYGON_CLOSE_GRAB_RADIUS_PX * 0.6,
			first.y + POLYGON_CLOSE_GRAB_RADIUS_PX * 0.8,
		);

		expect(closesPolygon(POLYGON_MIN_VERTICES, onTheEdge, first)).toBe(true);
	});
});
