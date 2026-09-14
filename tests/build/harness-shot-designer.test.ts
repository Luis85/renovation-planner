import { describe, expect, it } from 'vitest';
import { query, shot } from '../helpers/harnessShotTable';

/**
 * The asset designer's fixed shots, pinned on what makes each different from a sibling. Split out of
 * `harness-shot.test.ts` — which still holds the whole table in both directions — when these pins
 * pushed that file past the 450-line test budget; both read the one parsed table in
 * `tests/helpers/harnessShotTable.ts`.
 */
describe('the asset designer shots', () => {
	/**
	 * The asset designer's sidebar-width shot (Task B10's own toolbar-overflow fix) — pinned the
	 * same way `project-detail-narrow` is, so a width or route dropped from either shot fails HERE
	 * rather than being noticed only by re-running the ad-hoc capture that found the defect in the
	 * first place. `width: 460` is the property that makes this shot different from
	 * `asset-designer-dark`; losing it would silently photograph the same wide layout twice under
	 * two names, which is the exact failure `resolveShots` refuses for a blank entry argument.
	 */
	it('takes the asset designer at a sidebar width, through the route that opens it', () => {
		expect(shot('asset-designer-narrow')).toMatchObject({ query: '?view=asset-designer', width: 460 });
	});

	it('seeds the designer with a preset through the harness knob', () => {
		expect(shot('asset-designer-preset-toilet')).toMatchObject({ query: '?view=asset-designer&preset=toilet' });
	});

	/**
	 * The selection captures (symbols spec, Testing: "each selection mode"). `&select=` is honoured
	 * only beside `&preset=`, so a shot that lost its preset would photograph an empty designer and
	 * still pass the name check; each shot also waits on a mark that exists only once the knob landed.
	 */
	it('takes each selection mode and the anchor through the knobs that reach them', () => {
		const four = ['asset-designer-select-transform', 'asset-designer-select-points', 'asset-designer-select-bend', 'asset-designer-select-anchor'];

		expect(four.filter((name) => query(name).get('view') === 'asset-designer' && query(name).has('preset'))).toEqual(four);
		expect(query('asset-designer-select-transform').get('select')).toBe('detail-2');
		expect(query('asset-designer-select-transform').get('mode')).toBeNull();
		expect(query('asset-designer-select-points').get('mode')).toBe('points');
		expect(query('asset-designer-select-bend').get('mode')).toBe('bend');
		expect(query('asset-designer-select-bend').get('theme')).toBe('light');
		expect(query('asset-designer-select-anchor').get('select')).toBe('anchor');
	});
});
