// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import AssetLibrary from '../../src/prototypes/AssetLibrary.vue';
import type * as FixtureModuleNs from '../../src/prototypes/assetLibraryFixture';
import { settle } from '../helpers/editor';
import { ASSETS, markPath } from '../../src/prototypes/assetLibraryFixture';
import { shapeDimensions } from '../../src/prototypes/assetShapeFields';

type FixtureModule = typeof FixtureModuleNs;

/**
 * One fixture id replaced with a hostile one, and everything else real.
 *
 * The mock spreads over the ACTUAL module, so every rule under test — the shelves, the rows,
 * the marks — is the one the browser draws, and only the id this case is about is planted.
 */
const { HOSTILE_ID, SPACED_ID } = vi.hoisted(() => ({
	HOSTILE_ID: 'quote"and\\backslash',
	SPACED_ID: 'wall tile 600',
}));

vi.mock('../../src/prototypes/assetLibraryFixture', async (importOriginal) => {
	const real = await importOriginal<FixtureModule>();
	const [first, second, ...rest] = real.ASSETS;
	return {
		...real,
		ASSETS: [{ ...first, id: HOSTILE_ID }, { ...second, id: SPACED_ID }, ...rest],
	};
});

/**
 * The asset library mock's FOCUS chain, and the only instrument this repository has for it.
 *
 * Five review rounds each found one more direction of one gesture — the forward swap, the
 * reverse swap, a destination hidden inside a collapsed shelf, a destination that had been
 * deleted, and clearing a no-match search — and each fix shipped under a paragraph arguing it
 * was general. The fifth round then found that the chain's LAST LINK had never been reachable:
 * it queried the search input from `bodyEl`, and the input is in the toolbar, which is
 * `.rp-al-body`'s SIBLING. Every one of those paragraphs was an argument about a mechanism
 * rather than a test of it, and there was a running prototype the whole time.
 *
 * **jsdom is the right instrument here for the reason it is usually the wrong one.** It lays
 * nothing out, so `offsetParent` is `null` for every element — which is exactly the state the
 * fallback exists for. A capture cannot show focus and the browser harness draws no keyboard;
 * jsdom cannot see WHICH of the two targets a laid-out browser would pick, and it can see, every
 * time, that the fallback resolves to something rather than to nothing. That is the half that
 * was broken.
 *
 * Watched failing: restoring the `bodyEl.querySelector('.rp-al-search__input')` spelling turns
 * both fallback cases red at their assertions, and dropping `CSS.escape` turns the last one red
 * with the `SyntaxError` `querySelector` really throws.
 */

const searchInput = (wrapper: VueWrapper): Element | null =>
	wrapper.element.querySelector('.rp-al-search__input');

/** Mounted into a real `document.body`, because `activeElement` is a document-level fact. */
function mountLibrary(): VueWrapper {
	return mount(AssetLibrary, { attachTo: document.body });
}

describe('the asset library mock’s derived geometry', () => {
	it('fits a mark without emitting NaN for an overflowing extent', () => {
		// Finite vertices, an infinite SPAN: `validateAssetShape` accepts this whenever the
		// shoelace sum stays finite, and the scale it produces is `0` rather than `Infinity`,
		// so the guard that catches a degenerate extent passes it straight through. Watched
		// failing: without the extent guard this returns a path of `NaN` coordinates.
		const overflowing = [
			{ x: -1e308, y: 0 },
			{ x: 1e308, y: 0 },
			{ x: 1e308, y: 1e-300 },
			{ x: -1e308, y: 1e-300 },
		];
		const path = markPath(overflowing, 20, 2);
		expect(path).not.toMatch(/NaN/);
		expect(path).toBe('');
	});

	it('withholds an overflowing extent rather than printing Infinity', () => {
		// The mark got this guard first and the dimensions beside it did not, so the row drew
		// nothing while the inspector printed `Infinity × … mm` as a measurement.
		const overflowing = { ...ASSETS[0], outline: [
			{ x: -1e308, y: 0 }, { x: 1e308, y: 0 },
			{ x: 1e308, y: 1e-300 }, { x: -1e308, y: 1e-300 },
		] };
		expect(shapeDimensions(overflowing)).toBeNull();
	});

	it('never prints a positive extent as zero, at any scale', () => {
		const tiny = { ...ASSETS[0], outline: [
			{ x: 0, y: 0 }, { x: 1e-6, y: 0 }, { x: 1e-6, y: 1e-6 }, { x: 0, y: 1e-6 },
		] };
		// `Math.round` said `0 × 0 mm` here, and so did `toFixed(3)` — a smaller threshold and
		// the identical falsehood, which is what the round before this one shipped.
		const shown = shapeDimensions(tiny);
		expect(shown).not.toMatch(/(^|[^.\d])0 /);
		expect(shown).toBe('0.0000010 × 0.0000010 mm');
	});

	it('scans a very long outline rather than spreading it', () => {
		// No schema and no validator bounds a vertex count, and `Math.min(...xs)` throws
		// `RangeError: Maximum call stack size exceeded` around 125k arguments — while a
		// VISIBLE ROW renders, so the library would throw rather than drop one mark.
		const many = Array.from({ length: 200_000 }, (_, i) => ({ x: i % 997, y: (i * 7) % 991 }));
		expect(() => markPath(many, 20, 2)).not.toThrow();
		expect(() => shapeDimensions({ ...ASSETS[0], outline: many })).not.toThrow();
	});

	it('announces the shape as well as the state', () => {
		// A measured tile and a measured radiator both said "Measured footprint" until the
		// extent was added — the outline that tells them apart is inside the `aria-hidden` SVG,
		// so browsing by screen reader gave one sentence for every measured asset.
		const wrapper = mountLibrary();
		const spoken = [...wrapper.element.querySelectorAll('.rp-al-row__mark-words')]
			.map((el) => el.textContent);
		const measured = spoken.filter((t) => t?.startsWith('Measured footprint'));
		expect(measured.length).toBeGreaterThan(1);
		expect(new Set(measured).size).toBe(measured.length);

		// And the description is REFERENCED from OUTSIDE the button. This assertion used to
		// require the opposite — it looked the element up INSIDE the row and so encoded the
		// very containment that mangles the accessible name, which is a fix written down as a
		// test. The containment itself is asserted in its own case below.
		const row = wrapper.element.querySelector('.rp-al-row');
		const described = row?.getAttribute('aria-describedby') ?? '';
		expect(described).toBeTruthy();
		expect(document.getElementById(described)).not.toBeNull();
		wrapper.unmount();
	});

	it('keeps a fractional extent out of the whole-millimetre trap', () => {
		const asset = { ...ASSETS[0], outline: [
			{ x: 0, y: 0 }, { x: 1200.4, y: 0 }, { x: 1200.4, y: 189.6 }, { x: 0, y: 189.6 },
		] };
		expect(shapeDimensions(asset)).toBe('1200.4 × 189.6 mm');

		// The half-millimetre footprint `Math.round` reported as `0 mm`.
		const tiny = { ...asset, outline: [
			{ x: 0, y: 0 }, { x: 0.4, y: 0 }, { x: 0.4, y: 0.4 }, { x: 0, y: 0.4 },
		] };
		expect(shapeDimensions(tiny)).toBe('0.4 × 0.4 mm');

		// And the ordinary whole-millimetre case still reads as whole millimetres.
		expect(shapeDimensions(ASSETS[0])).toMatch(/^\d+ × \d+ mm$/);
	});
});

describe('the asset library mock’s focus chain', () => {
	it('falls back to the search field when the primary target is not laid out', async () => {
		const wrapper = mountLibrary();
		// The resting mock has a selection, so the inspector is drawn and `back()` runs its
		// swap branch. In jsdom the row it aims at reports no `offsetParent`, which is the
		// fallback's own condition.
		await wrapper.find('.rp-al-inspector__back').trigger('click');
		await settle();

		expect(document.activeElement).toBe(searchInput(wrapper));
		wrapper.unmount();
	});

	it('focuses something rather than nothing after clearing a no-match search', async () => {
		const wrapper = mountLibrary();
		const input = wrapper.find('.rp-al-search__input');
		await input.setValue('a string no asset in the fixture contains');

		const clear = wrapper.find('.rp-al-nothing__action');
		expect(clear.exists()).toBe(true);
		await clear.trigger('click');
		await settle();

		// The gesture removes the control the user pressed, so `<body>` is the failure this
		// asserts against — the state the fallback was written to prevent and did not.
		expect(document.activeElement).not.toBe(document.body);
		expect(document.activeElement).toBe(searchInput(wrapper));
		wrapper.unmount();
	});

	it('builds a row selector that survives an id holding selector syntax', async () => {
		// `AssetFrontmatterSchemaV1` validates an id as `z.string().min(1)`, so this is a note a
		// user can really write, and this surface exists to show the notes people wrote. Driven
		// through the real `back()` rather than asserted about `CSS.escape` in isolation: the
		// first version of this case tested the standard library, passed with the escape
		// removed, and pinned nothing — which is this repository's own "a test that passes in
		// both worlds" defect, in the file written to stop exactly that.
		const wrapper = mountLibrary();
		const row = wrapper.find(`[data-asset-id="${CSS.escape(HOSTILE_ID)}"]`);
		expect(row.exists()).toBe(true);

		await row.trigger('click');
		// Unescaped, the selector `back()` builds is invalid and `querySelector` THROWS rather
		// than missing — taking the click handler with it, so the assertion is that this
		// resolves at all.
		await expect(wrapper.find('.rp-al-inspector__back').trigger('click')).resolves.toBeUndefined();
		await settle();

		expect(document.activeElement).toBe(searchInput(wrapper));
		wrapper.unmount();
	});
});

/**
 * The row's hidden mark description, which is TWO relationships and only one of them is added.
 *
 * `aria-describedby` names a description; it does not remove a descendant from the button's
 * accessible NAME, which is computed from content. So the round that added the attribute left
 * the span inside the button and the row went on being announced "Measured footprint,
 * 1200 × 190 mm Oak plank floor" — now with the same sentence repeated as its description.
 * Only moving the element out of the button separates the two, and only the first of these
 * cases can see that: an `aria-describedby` assertion passes in both worlds.
 *
 * Watched failing: moving the span back inside the button reddens the first case at its
 * assertion, and minting the id from `asset.id` again reddens the second — jsdom resolves an
 * IDREF list the same way a browser does, so the spaced id really does reference nothing.
 */
describe('the asset library mock’s row description', () => {
	it('keeps the mark description out of the row button', () => {
		const wrapper = mountLibrary();
		const row = wrapper.element.querySelector('.rp-al-row');
		expect(row).not.toBeNull();
		// Name-from-content walks descendants, so the question is containment rather than
		// whether the description exists — it exists in both worlds.
		expect(row?.querySelector('.rp-al-row__mark-words')).toBeNull();
		wrapper.unmount();
	});

	it('resolves the description for an id holding whitespace', () => {
		const wrapper = mountLibrary();
		const row = wrapper.element.querySelector(`[data-asset-id="${CSS.escape(SPACED_ID)}"]`);
		expect(row).not.toBeNull();

		const described = row?.getAttribute('aria-describedby') ?? '';
		// An IDREF LIST: whitespace separates references, so an id spelled with a space names
		// two elements that do not exist rather than one that does. Nothing errors either way.
		expect(described).not.toContain(' ');
		expect(document.getElementById(described)?.textContent ?? '').not.toBe('');
		wrapper.unmount();
	});
});
