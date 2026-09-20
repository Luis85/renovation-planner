import { describe, expect, it } from 'vitest';
import {
	POLYGON_CLOSE_GRAB_RADIUS_PX,
	POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX,
	POLYGON_CLOSE_TARGET_RADIUS_PX,
	POLYGON_VERTEX_RADIUS_PX,
	ROTATION_CONTROL_SIZE_PX,
	ROTATION_HANDLE_CLEARANCE_PX,
	ROTATION_HANDLE_OFFSET_PX,
	ROTATION_HANDLE_REACH_PX,
	VERTEX_GRAB_RADIUS_PX,
	VERTEX_HANDLE_HIGHLIGHT_RADIUS_PX,
	VERTEX_HANDLE_RADIUS_PX,
} from '../../../src/presentation/editor/handleMetrics';

describe('rotate handle metrics', () => {
	it('stands the rotate target far enough off a side that it never reaches a handle grabbed on that side', () => {
		expect(ROTATION_HANDLE_OFFSET_PX).toBeGreaterThan(ROTATION_CONTROL_SIZE_PX / 2 + VERTEX_GRAB_RADIUS_PX + ROTATION_HANDLE_CLEARANCE_PX);
	});

	it('lets a covered arrow be pushed further out than it starts, or no push could ever succeed', () => {
		expect(ROTATION_HANDLE_REACH_PX).toBeGreaterThan(ROTATION_HANDLE_OFFSET_PX);
	});
});

/**
 * The relationship between the handle a user SEES and the region that GRABS it.
 *
 * Both numbers were previously declared independently — in `select-tool.ts` and in
 * `InteractionLayer.vue`, under the same name `HANDLE_RADIUS_PX`, with the values 8 and 4 —
 * and nothing anywhere pinned either. The comment beside the 8 claimed the handle was
 * "eight screen pixels across" while the code consumed it as a radius, so the drawn dot was
 * 8 px across and the grab region 16.
 */
describe('vertex handle metrics', () => {
	it('keeps every drawn vertex radius inside the region that grabs it', () => {
		// A pointing target is easier to hit than to see; the inequality is the deliberate
		// part. Equality would be acceptable, a grab region SMALLER than the visible dot
		// never is — that is a handle the user can see and cannot pick up.
		//
		// A LIST rather than one comparison, for the reason the polygon family below is one:
		// the chosen-corner highlight is a third DRAWN radius, one pixel under the grab
		// region, and it landed with nothing holding that order. `interactionLayer.test.ts`
		// cannot hold it — it compares the rendered radius to the same constant the renderer
		// read, so it stays green at any value.
		for (const drawn of [VERTEX_HANDLE_RADIUS_PX, VERTEX_HANDLE_HIGHLIGHT_RADIUS_PX]) {
			expect(VERTEX_GRAB_RADIUS_PX).toBeGreaterThanOrEqual(drawn);
		}
	});

	it('draws the chosen corner larger than an unchosen one, rather than smaller', () => {
		// BP-04 action 3's whole content — "highlight only the chosen corner" — is a
		// DIRECTION, and this is the only assertion that states it. Set the highlight below
		// the base and the chosen corner is drawn smaller than its siblings: the highlight
		// inverted, a picture no equality to a constant can tell from the right one.
		expect(VERTEX_HANDLE_HIGHLIGHT_RADIUS_PX).toBeGreaterThan(VERTEX_HANDLE_RADIUS_PX);
	});

	it('keeps all three to positive, finite screen pixels', () => {
		for (const value of [VERTEX_HANDLE_RADIUS_PX, VERTEX_HANDLE_HIGHLIGHT_RADIUS_PX, VERTEX_GRAB_RADIUS_PX]) {
			expect(Number.isFinite(value)).toBe(true);
			expect(value).toBeGreaterThan(0);
		}
	});
});

/**
 * The polygon-drawing tool's own three sizes, and the fourth number they all have to stay
 * under: the distance at which a click actually CLOSES the polygon.
 *
 * That fourth number used to live in `draw-polygon-tool.ts` as `CLOSE_TOLERANCE_PX`, where
 * nothing related it to anything drawn — and until the start vertex was drawn at all, there
 * was nothing to relate. A target the user can see but not hit, or hit but not see, is the
 * same defect this module was created for; the difference here is that the visible mark is
 * what TEACHES the gesture, so it being smaller than its own hit region is the deliberate
 * direction, never the other way round.
 */
describe('polygon close-target metrics', () => {
	it('keeps every drawn radius inside the region that actually closes the polygon', () => {
		for (const drawn of [
			POLYGON_VERTEX_RADIUS_PX,
			POLYGON_CLOSE_TARGET_RADIUS_PX,
			POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX,
		]) {
			expect(POLYGON_CLOSE_GRAB_RADIUS_PX).toBeGreaterThanOrEqual(drawn);
		}
	});

	it('grows the start vertex on hover, and draws it larger than an ordinary vertex at rest', () => {
		// The hover reaction is the whole point of the pair: the mark has to CHANGE, or a
		// user who cannot tell how to close the shape learns nothing by pointing at it.
		expect(POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX).toBeGreaterThan(POLYGON_CLOSE_TARGET_RADIUS_PX);
		// And at rest it is still the one vertex that is different, because it is the only
		// one a click means something special on.
		expect(POLYGON_CLOSE_TARGET_RADIUS_PX).toBeGreaterThan(POLYGON_VERTEX_RADIUS_PX);
	});

	it('keeps all four to positive, finite screen pixels', () => {
		for (const value of [
			POLYGON_VERTEX_RADIUS_PX,
			POLYGON_CLOSE_TARGET_RADIUS_PX,
			POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX,
			POLYGON_CLOSE_GRAB_RADIUS_PX,
		]) {
			expect(Number.isFinite(value)).toBe(true);
			expect(value).toBeGreaterThan(0);
		}
	});
});
