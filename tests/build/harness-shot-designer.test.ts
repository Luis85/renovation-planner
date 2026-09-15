import { describe, expect, it } from 'vitest';
import { query, shot, shots } from '../helpers/harnessShotFixtures';

/**
 * The asset designer's fixed shots, pinned on what makes each different from a sibling. Split out of
 * `harness-shot.test.ts` — which still holds the whole table in both directions — when these pins
 * pushed that file past the 450-line test budget; both read the one parsed table in
 * `tests/helpers/harnessShotFixtures.ts`.
 */
const READY = '[data-rp-harness-ready]';
const designerShots = (): string[] => [...shots.keys()].filter((name) => name.startsWith('asset-designer-'));

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

	/**
	 * The view element is attached at MOUNT, before the harness has framed, selected or drawn anything,
	 * so a preset shot waiting on it alone photographed the unframed designer — which the four preset
	 * shots did (selection polish, follow-up A5). Every shot that opens a preset waits on the mark
	 * `driveHarness` sets last.
	 */
	it('waits on the harness-ready mark in every shot that opens a preset', () => {
		const presets = designerShots().filter((name) => query(name).has('preset'));
		expect(presets.length).toBeGreaterThan(0);
		expect(presets.filter((name) => ![shot(name).selector].flat().includes(READY))).toEqual([]);
	});

	/**
	 * The capture-and-critique pass's states (selection polish, Task 1), each pinned on the knobs that make
	 * it differ from a sibling: a shot that lost its `theme`, `lang`, `camera`, `pending` or `draw` would
	 * photograph a sibling's state under its own name and exit 0. `null` pins a knob ABSENT.
	 */
	it.each([
		['asset-designer-select-transform-light', { select: 'detail-2', mode: null, theme: 'light' }],
		['asset-designer-select-points-light', { select: 'footprint', mode: 'points', theme: 'light' }],
		['asset-designer-select-bend-dark', { preset: 'curved-table', select: 'footprint', mode: 'bend', theme: null }],
		['asset-designer-select-anchor-light', { select: 'anchor', theme: 'light' }],
		['asset-designer-select-footprint', { select: 'footprint', mode: null, theme: null }],
		['asset-designer-select-footprint-light', { select: 'footprint', mode: null, theme: 'light' }],
		['asset-designer-select-clearance', { select: 'clearance', theme: null }],
		['asset-designer-select-clearance-light', { select: 'clearance', theme: 'light' }],
		['asset-designer-select-facing', { select: 'facing', theme: null }],
		['asset-designer-select-facing-light', { select: 'facing', theme: 'light' }],
		['asset-designer-select-narrow', { select: 'detail-2', lang: null }],
		['asset-designer-select-narrow-de', { select: 'detail-2', lang: 'de' }],
		['asset-designer-select-transform-unframed', { select: 'detail-2', camera: 'default' }],
		['asset-designer-pending', { select: 'detail-2', pending: '' }],
		['asset-designer-pending-anchor-light', { select: 'anchor', pending: '', theme: 'light' }],
		['asset-designer-draw-rect', { draw: 'draw-rect', select: null, theme: null }],
		['asset-designer-draw-rect-light', { draw: 'draw-rect', select: null, theme: 'light' }],
		['asset-designer-draw-circle', { draw: 'draw-circle', select: null }],
		['asset-designer-draw-trace-detail', { draw: 'trace-detail', select: null }],
		['asset-designer-grid', { grid: '', theme: null }],
		['asset-designer-grid-light', { grid: '', theme: 'light' }],
		['asset-designer-view-menu-narrow', { 'view-menu': '', theme: null }],
	] as const)('reaches %s through the knobs %o', (name, knobs) => {
		const asked = query(name);
		expect(asked.get('view')).toBe('asset-designer');
		expect(asked.has('preset')).toBe(true);
		for (const [knob, value] of Object.entries(knobs)) expect(asked.get(knob), `${name} ${knob}`).toBe(value);
	});

	it('takes exactly the two selected-inspector shots at a sidebar width', () => {
		expect(designerShots().filter((name) => name.startsWith('asset-designer-select') && shot(name).width === 460)).toEqual(['asset-designer-select-narrow', 'asset-designer-select-narrow-de']);
	});

	/** The readout shares the status row with the save state, which a sidebar's width is what can crowd. */
	it('takes the light grid shot at a sidebar width and the dark one at the default', () => {
		expect(shot('asset-designer-grid-light').width).toBe(460);
		expect(shot('asset-designer-grid').width).toBeUndefined();
	});

	/**
	 * F1's own instrument: the View menu used to open off-screen below 900px container width because
	 * the designer had no positioned ancestor for it at that width — a sidebar leaf's own 460px is
	 * exactly where the defect showed. `width: 460` is what makes this shot different from a resting
	 * one; losing it would silently photograph the menu at the width it never broke at.
	 */
	it('takes the View menu open at a sidebar width', () => {
		expect(shot('asset-designer-view-menu-narrow').width).toBe(460);
	});
});
