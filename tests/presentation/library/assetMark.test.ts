/**
 * @vitest-environment jsdom
 *
 * The Asset library's geometry mark (design "Asset library overview" §3.4): five states that
 * differ in KIND, drawn from Task 6's `AssetOutline`.
 *
 * jsdom resolves no CSS, so nothing here can settle whether the five states are visually
 * distinct at 20px — that is Task 17's capture, and an eye in a vault. What the cases in the
 * first `describe` assert is what jsdom CAN see: which elements are drawn, their attributes,
 * and the path data. The second `describe` block closes the one gap that leaves open (review
 * round 1): `measured` and `unscaled` draw the identical `<path>` with the identical `d` — see
 * "draws the SAME outline" below — so the ONLY thing telling them apart on screen is a CSS
 * declaration nothing above this line can see, and it is checked directly rather than assumed.
 */
import { readFileSync } from 'node:fs';
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
	it('draws five states under five distinct classes', () => {
		// This is a CLASS-distinctness assertion and no wider: `measured` and `unscaled` draw
		// the identical element (a `<path>` with the identical `d`, per the case below), told
		// apart on screen by a CSS rule this assertion cannot see at all — that is what the
		// second `describe` block in this file checks instead. What this DOES catch is a build
		// that renders two states under the SAME class, which is unreachable from the CSS check
		// (a rule keyed on a class nothing ever applies proves nothing).
		const drawn = FIVE_STATES.map((o) => shallowMount(AssetMark, { props: { outline: o } }).html());
		expect(new Set(drawn).size).toBe(5);
	});

	it('renders the mark column even when there is no shape', () => {
		// The grid-shift rule (§3.4): the 20px `<svg>` renders in every state, or the grid
		// pulls every later slot in the row one column left.
		const wrapper = shallowMount(AssetMark, { props: { outline: NONE } });
		const svg = wrapper.get('svg.rp-al-mark');
		expect(svg.classes()).toContain('rp-al-mark--none');
		expect(svg.element.children).toHaveLength(0);
	});

	it('draws nothing for the "not yet read" state but still renders the column', () => {
		const wrapper = shallowMount(AssetMark, { props: { outline: null } });
		expect(wrapper.get('svg.rp-al-mark').classes()).toContain('rp-al-mark--pending');
	});

	it('is aria-hidden in every state', () => {
		for (const outline of FIVE_STATES) {
			const wrapper = shallowMount(AssetMark, { props: { outline } });
			expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true');
		}
	});

	it('draws three centred dots for "not yet read", and nothing else', () => {
		const wrapper = shallowMount(AssetMark, { props: { outline: null } });
		const dots = wrapper.findAll('circle.rp-al-mark__dot');
		expect(dots).toHaveLength(3);
		expect(wrapper.find('path').exists()).toBe(false);
		expect(wrapper.find('rect').exists()).toBe(false);
	});

	it('draws a struck box for "unreadable", and only that state draws a box at all', () => {
		const wrapper = shallowMount(AssetMark, { props: { outline: REFUSED } });
		expect(wrapper.find('rect').exists()).toBe(true);
		// The cross: two diagonals in one `<path>`, plus the outline path being absent — a
		// struck box never also draws the polygon outline path.
		expect(wrapper.findAll('path')).toHaveLength(1);
		expect(wrapper.get('path').attributes('d')).toContain('M5.5 5.5');

		for (const other of [MEASURED, UNSCALED, NONE, null]) {
			expect(shallowMount(AssetMark, { props: { outline: other } }).find('rect').exists()).toBe(false);
		}
	});

	it('draws the fitted outline for a measured footprint, solid', () => {
		const wrapper = shallowMount(AssetMark, { props: { outline: MEASURED } });
		const path = wrapper.get('path');
		expect(path.attributes('d')).toMatch(/^M.*Z$/);
		expect(wrapper.get('svg').classes()).toContain('rp-al-mark--measured');
	});

	it('draws the SAME outline for an unscaled footprint, under a different class', () => {
		const measured = shallowMount(AssetMark, { props: { outline: MEASURED } });
		const unscaled = shallowMount(AssetMark, { props: { outline: UNSCALED } });
		// Real proportions in both — only the SCALE is provisional, which the dashed stroke
		// (a CSS rule keyed on `rp-al-mark--unscaled`, checked below rather than assumed) says.
		expect(unscaled.get('path').attributes('d')).toBe(measured.get('path').attributes('d'));
		expect(unscaled.get('svg').classes()).toContain('rp-al-mark--unscaled');
		expect(unscaled.get('svg').classes()).not.toContain('rp-al-mark--measured');
	});

	it('fits a long, thin footprint inside the 20px box at its true aspect ratio', () => {
		// 1200 × 190 is a 6.3:1 ratio; the fit divides both axes by the SAME scale, so the
		// drawn shape's own width-to-height ratio survives the fit rather than being
		// stretched to fill a square.
		const wrapper = shallowMount(AssetMark, { props: { outline: MEASURED } });
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
		const wrapper = shallowMount(AssetMark, { props: { outline: degenerate } });
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
		const wrapper = shallowMount(AssetMark, { props: { outline: flat } });
		const d = wrapper.get('path').attributes('d') ?? '';
		expect(d).not.toBe('');
		expect(d).not.toContain('NaN');
		expect(d).not.toContain('Infinity');
	});
});

/**
 * **The one hole no jsdom-driven case above can catch, closed here** (review round 1).
 * `measured` and `unscaled` render the byte-identical `<path>` — same tag, same `d` — so the
 * ENTIRE distinction between the two rests on `.rp-al-mark--unscaled`'s `stroke-dasharray`
 * declaration in `styles/asset-mark.css`, which is exactly §3.4's own recorded historical
 * defect ("a measured tile, an unscaled cabinet and a not-yet-read cabinet… separated by
 * stroke pattern in one case and by COLOUR alone in the other"). Deleting that one declaration
 * left 407 other tests green, because nothing was asking the stylesheet a direct question.
 *
 * Mirrors `saveStateIndicator.test.ts`'s own remedy for the identical shape
 * (`rp-save-state-error` shipped once against a template emitting
 * `rp-save-state-save-error`, invisible until the selector was BUILT from the same expression
 * the template interpolates rather than transcribed): the class name here is read out of
 * `AssetMark.vue`'s own `` `rp-al-mark--${kind}` `` source text, not retyped, so a renamed
 * state breaks this test rather than leaving it quietly unable to match anything.
 */
describe('the one pair of states told apart only by a CSS rule', () => {
	const componentSource = readFileSync('src/presentation/library/AssetMark.vue', 'utf8');
	const css = readFileSync('styles/asset-mark.css', 'utf8');

	it('is measured by a selector this test does not transcribe by hand', () => {
		// If `AssetMark.vue` stops interpolating the class this way, this fails here rather
		// than silently asking the stylesheet about a class nothing renders. Built through a
		// `$` variable rather than written as a literal `${`, because `no-template-curly-in-
		// string` reads that sequence in an ordinary string as a forgotten template literal —
		// right for ordinary JavaScript, wrong for a string this test means to search FOR.
		const $ = '$';
		const interpolation = `\`rp-al-mark--${$}{kind}\``;
		expect(componentSource).toContain(interpolation);
	});

	it('declares .rp-al-mark--unscaled with the ONE property that distinguishes it from measured', () => {
		const rule = /\.rp-al-mark--unscaled\s*\{([^}]*)\}/.exec(css);
		expect(rule).not.toBeNull();
		expect(rule?.[1] ?? '').toContain('stroke-dasharray');
	});

	it('declares no rule of its own for .rp-al-mark--measured, which is the undecorated baseline', () => {
		// `measured` draws the plain, solid `.rp-al-mark` stroke with no override — so a rule
		// reappearing here would be a second place the two states could drift out of sync with
		// what this test asserts they must differ by.
		expect(css).not.toMatch(/\.rp-al-mark--measured\s*\{/);
	});
});
