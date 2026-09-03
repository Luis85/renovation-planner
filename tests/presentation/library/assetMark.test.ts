/**
 * @vitest-environment jsdom
 *
 * The Asset library's geometry mark (design "Asset library overview" §3.4): five states that
 * differ in KIND, drawn from Task 6's `AssetOutline`.
 *
 * jsdom resolves no CSS, so nothing here can settle whether the five states are visually
 * distinct at 20px — that is Task 17's capture, and an eye in a vault. What this file asserts
 * instead is what jsdom CAN see: which elements are drawn, their attributes, and the path data
 * — so a build that collapses two states down to one stroke variation (the exact defect the
 * prototype's own header records shipping once) fails at an element-shape assertion here
 * rather than in a photograph nobody takes.
 */
import { describe, expect, it } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import AssetMark from '../../../src/presentation/library/AssetMark.vue';
import type { AssetOutline } from '../../../src/application/queries/ListAssetOutlines';

/** A plain rectangle, real millimetres, long and thin — a radiator's own proportions (§3.4). */
const RADIATOR = [
	{ x: 0, y: 0 },
	{ x: 1200, y: 0 },
	{ x: 1200, y: 190 },
	{ x: 0, y: 190 },
];

const MEASURED: AssetOutline = { kind: 'measured', points: RADIATOR, extent: { width: 1200, depth: 190 } };
const UNSCALED: AssetOutline = { kind: 'unscaled', points: RADIATOR, extent: { width: 1200, depth: 190 } };
const NONE: AssetOutline = { kind: 'none' };
const REFUSED: AssetOutline = {
	kind: 'refused',
	code: 'asset-geometry.unreadable',
	sidecarPath: 'Renovation/Library/Geometry/lintel-precast.rpgeo',
};

/** §3.4's fifth state — `null`, the query has not answered for this asset yet. */
const FIVE_STATES: readonly (AssetOutline | null)[] = [MEASURED, UNSCALED, NONE, REFUSED, null];

describe('AssetMark', () => {
	it('draws five visibly distinct marks', () => {
		// Distinctness is settled by an eye in Task 17's capture. What this asserts is that the
		// five render different ELEMENT SHAPES, so a build collapsing two into one stroke
		// variation fails here rather than in a photograph nobody takes.
		const drawn = FIVE_STATES.map((o) => shallowMount(AssetMark, { props: { outline: o, ordinal: 1 } }).html());
		expect(new Set(drawn).size).toBe(5);
	});

	it('renders the mark column even when there is no shape', () => {
		// The grid-shift rule (§3.4): the 20px `<svg>` renders in every state, or the grid
		// pulls every later slot in the row one column left.
		const wrapper = shallowMount(AssetMark, { props: { outline: NONE, ordinal: 1 } });
		const svg = wrapper.get('svg.rp-al-mark');
		expect(svg.classes()).toContain('rp-al-mark--none');
		expect(svg.element.children).toHaveLength(0);
	});

	it('draws nothing for the "not yet read" state but still renders the column', () => {
		const wrapper = shallowMount(AssetMark, { props: { outline: null, ordinal: 1 } });
		expect(wrapper.get('svg.rp-al-mark').classes()).toContain('rp-al-mark--pending');
	});

	it('is aria-hidden in every state', () => {
		for (const outline of FIVE_STATES) {
			const wrapper = shallowMount(AssetMark, { props: { outline, ordinal: 1 } });
			expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true');
		}
	});

	it('draws three centred dots for "not yet read", and nothing else', () => {
		const wrapper = shallowMount(AssetMark, { props: { outline: null, ordinal: 1 } });
		const dots = wrapper.findAll('circle.rp-al-mark__dot');
		expect(dots).toHaveLength(3);
		expect(wrapper.find('path').exists()).toBe(false);
		expect(wrapper.find('rect').exists()).toBe(false);
	});

	it('draws a struck box for "unreadable", and only that state draws a box at all', () => {
		const wrapper = shallowMount(AssetMark, { props: { outline: REFUSED, ordinal: 1 } });
		expect(wrapper.find('rect').exists()).toBe(true);
		// The cross: two diagonals in one `<path>`, plus the outline path being absent — a
		// struck box never also draws the polygon outline path.
		expect(wrapper.findAll('path')).toHaveLength(1);
		expect(wrapper.get('path').attributes('d')).toContain('M5.5 5.5');

		for (const other of [MEASURED, UNSCALED, NONE, null]) {
			expect(shallowMount(AssetMark, { props: { outline: other, ordinal: 1 } }).find('rect').exists()).toBe(false);
		}
	});

	it('draws the fitted outline for a measured footprint, solid', () => {
		const wrapper = shallowMount(AssetMark, { props: { outline: MEASURED, ordinal: 1 } });
		const path = wrapper.get('path');
		expect(path.attributes('d')).toMatch(/^M.*Z$/);
		expect(wrapper.get('svg').classes()).toContain('rp-al-mark--measured');
	});

	it('draws the SAME outline for an unscaled footprint, under a different class', () => {
		const measured = shallowMount(AssetMark, { props: { outline: MEASURED, ordinal: 1 } });
		const unscaled = shallowMount(AssetMark, { props: { outline: UNSCALED, ordinal: 1 } });
		// Real proportions in both — only the SCALE is provisional, which the dashed stroke
		// (a CSS rule keyed on `rp-al-mark--unscaled`, unreachable from jsdom) says.
		expect(unscaled.get('path').attributes('d')).toBe(measured.get('path').attributes('d'));
		expect(unscaled.get('svg').classes()).toContain('rp-al-mark--unscaled');
		expect(unscaled.get('svg').classes()).not.toContain('rp-al-mark--measured');
	});

	it('fits a long, thin footprint inside the 20px box at its true aspect ratio', () => {
		// 1200 × 190 is a 6.3:1 ratio; the fit divides both axes by the SAME scale, so the
		// drawn shape's own width-to-height ratio survives the fit rather than being
		// stretched to fill a square.
		const wrapper = shallowMount(AssetMark, { props: { outline: MEASURED, ordinal: 1 } });
		const d = wrapper.get('path').attributes('d') ?? '';
		const numbers = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
		const xs = numbers.filter((_, i) => i % 2 === 0);
		const ys = numbers.filter((_, i) => i % 2 === 1);
		const drawnWidth = Math.max(...xs) - Math.min(...xs);
		const drawnHeight = Math.max(...ys) - Math.min(...ys);
		expect(drawnWidth).toBeCloseTo(16, 0);
		expect(drawnHeight / drawnWidth).toBeCloseTo(190 / 1200, 2);
	});

	it('draws nothing rather than a malformed path for a degenerate (single-point) extent', () => {
		// Both axes zero: the scale is `Infinity` either way, `Number.isFinite` refuses it, and
		// the mark draws no path rather than a string full of `NaN`.
		const point = [{ x: 5, y: 5 }];
		const degenerate: AssetOutline = { kind: 'measured', points: point, extent: { width: 0, depth: 0 } };
		const wrapper = shallowMount(AssetMark, { props: { outline: degenerate, ordinal: 1 } });
		expect(wrapper.get('path').attributes('d')).toBe('');
	});

	it('scales a flat (single-axis) extent from its one real dimension, never divides by zero', () => {
		// A perfectly horizontal footprint: depth is 0, width is real. The zero axis must not
		// poison the fit through a division by zero.
		const flat: AssetOutline = {
			kind: 'measured',
			points: [{ x: 0, y: 10 }, { x: 100, y: 10 }],
			extent: { width: 100, depth: 0 },
		};
		const wrapper = shallowMount(AssetMark, { props: { outline: flat, ordinal: 1 } });
		const d = wrapper.get('path').attributes('d') ?? '';
		expect(d).not.toBe('');
		expect(d).not.toContain('NaN');
		expect(d).not.toContain('Infinity');
	});
});
