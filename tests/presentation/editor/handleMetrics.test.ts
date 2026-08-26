import { describe, expect, it } from 'vitest';
import {
	VERTEX_GRAB_RADIUS_PX,
	VERTEX_HANDLE_RADIUS_PX,
} from '../../../src/presentation/editor/handleMetrics';

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
	it('makes the grab region at least as large as the drawn handle', () => {
		// A pointing target is easier to hit than to see; the inequality is the deliberate
		// part. Equality would be acceptable, a grab region SMALLER than the visible dot
		// never is — that is a handle the user can see and cannot pick up.
		expect(VERTEX_GRAB_RADIUS_PX).toBeGreaterThanOrEqual(VERTEX_HANDLE_RADIUS_PX);
	});

	it('keeps both to positive, finite screen pixels', () => {
		for (const value of [VERTEX_HANDLE_RADIUS_PX, VERTEX_GRAB_RADIUS_PX]) {
			expect(Number.isFinite(value)).toBe(true);
			expect(value).toBeGreaterThan(0);
		}
	});
});
