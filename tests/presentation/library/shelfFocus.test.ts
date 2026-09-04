/**
 * @vitest-environment jsdom
 *
 * §6.2's arrow-key manager over the shelves region, driven through the REAL `AssetShelves.vue`
 * rather than through hand-built markup: the whole claim is that "the next focusable thing in
 * this region" is already the right answer because headers and rows alternate in DOM order, and
 * a fixture that arranged them by hand would be asserting its own arrangement.
 *
 * `attachTo: document.body` throughout, and it is not a formality: `focus()` on a detached
 * element does nothing, so a suite mounting free-floating would read `document.activeElement`
 * as `<body>` for every case and pass the ones asserting a REFUSAL to move while failing to
 * discriminate anything.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import AssetShelves from '../../../src/presentation/library/AssetShelves.vue';
import {
	focusStops,
	focusWithin,
	isLaidOut,
	shelvesWithdrawn,
} from '../../../src/presentation/library/shelfFocus';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { installObsidianDom } from '../../helpers/dom';
import { anEntry, definite } from '../../helpers/assetLibraryRootHarness';

installObsidianDom();

const mounted: VueWrapper[] = [];

afterEach(() => {
	for (const wrapper of mounted.splice(0)) wrapper.unmount();
});

/**
 * Two POPULATED shelves plus every empty declared one `AssetShelves` draws on its own — which
 * is what makes the empty-shelf case below a statement about the real derivation rather than
 * about a fixture that happened to omit them.
 */
function mountShelves(expanded: readonly string[]): VueWrapper {
	const entries = [
		anEntry({ assetId: createAssetId(), category: 'material', name: 'Alder plank' }),
		anEntry({ assetId: createAssetId(), category: 'material', name: 'Birch plank' }),
		anEntry({ assetId: createAssetId(), category: 'furniture', name: 'Sofa' }),
	];
	const wrapper = mount(AssetShelves, {
		attachTo: document.body,
		props: { entries, searching: false, expanded: new Set(expanded) },
	});
	mounted.push(wrapper);
	return wrapper;
}

const region = (wrapper: VueWrapper): HTMLElement => wrapper.get('.rp-al-shelves').element as HTMLElement;

/**
 * The NAME a stop carries, never its whole `textContent` — a row button also holds its mark,
 * its price, its waste factor and its supplier, concatenated with no separator, so a first
 * draft comparing full text matched nothing and reported the rows as missing rather than as
 * differently spelled. Both a header and a row nest exactly one name span.
 */
const labelsOf = (stops: readonly HTMLElement[]): string[] =>
	stops.map((el) => el.querySelector('.rp-al-row__name, .rp-al-shelf__name')?.textContent?.trim() ?? '');

describe('the focus stops of one shelves region', () => {
	/**
	 * §6.2's wrap, and the whole argument for one manager rather than a handler per shelf: the
	 * stop after `Birch plank` — the last row of the material shelf — is the FURNITURE header,
	 * with nothing in this module knowing that the two shelves are siblings.
	 *
	 * Asserted on the ORDER rather than by driving a keypress, because the order is the claim;
	 * `assetLibraryKeyboard.test.ts` drives the keys over the same region.
	 */
	it('wraps from the last row of a shelf into the next focusable header', () => {
		const wrapper = mountShelves(['material', 'furniture']);

		const labels = labelsOf(focusStops(region(wrapper)));
		const lastMaterialRow = labels.indexOf('Birch plank');

		expect(lastMaterialRow).toBeGreaterThan(-1);
		expect(labels[lastMaterialRow + 1]).toContain('Furniture');
	});

	/**
	 * §3.2 draws an empty declared shelf as a NON-INTERACTIVE `<h3>` — there is nothing to
	 * expand — so it is not a tab stop and §6.2's own table says the arrow keys skip it. Nothing
	 * in `shelfFocus.ts` knows that: it looks for `button` elements, and an empty shelf has none.
	 *
	 * The positive half is what makes this discriminate. Asserting only that no empty label
	 * appears would pass against a manager that found nothing at all.
	 */
	it('skips an empty shelf, which has no header to focus', () => {
		const wrapper = mountShelves(['material', 'furniture']);
		const empties = wrapper.findAll('.rp-al-shelf__static--empty .rp-al-shelf__name');

		const labels = labelsOf(focusStops(region(wrapper)));

		expect(empties.length).toBeGreaterThan(0);
		for (const empty of empties) expect(labels).not.toContain(empty.text());
		expect(labels).toContain('Birch plank');
	});

	/**
	 * A collapsed shelf's rows are `v-show`n rather than removed, so §6.1's expansion state
	 * survives a search — and the manager filters them out rather than walking them.
	 *
	 * The assertion is EXACTLY the two collapsible headers, per the brief's own spelling, which
	 * is what makes it fail in both directions: a manager that stopped filtering gains three
	 * rows, and one that filtered too hard loses the headers.
	 */
	it('does not stop on the rows of a collapsed shelf', () => {
		const wrapper = mountShelves([]);

		expect(focusStops(region(wrapper))).toEqual(
			wrapper.findAll('button.rp-al-shelf__head').map((el) => el.element),
		);
	});

	/**
	 * The instrument itself, at the one narrowing two review rounds of the plan produced and
	 * that no case above can tell apart on its own: `v-show` sets its inline `display: none` on
	 * `AssetShelf.vue`'s `<ul>`, never on the `<button>`s inside its `<li>`s, so each stop's own
	 * computed display is unchanged whether its shelf is open or shut. Measured here rather than
	 * asserted, so that the walk's necessity is a fact this file states rather than a claim its
	 * header makes.
	 */
	it('reports a collapsed row as laid out when asked about the row alone', () => {
		const wrapper = mountShelves([]);
		const list = wrapper.get('.rp-al-rows').element as HTMLElement;
		const row = wrapper.get('.rp-al-row').element as HTMLElement;

		expect(getComputedStyle(list).display).toBe('none');
		expect(getComputedStyle(row).display).not.toBe('none');
		expect(isLaidOut(row, region(wrapper))).toBe(false);
	});

	/**
	 * The end of the list, which §6.2's own wording settles: the arrows wrap "into the next
	 * focusable header", never around to the first stop. So the last stop is where the gesture
	 * stops, rather than where it starts over.
	 */
	it('does nothing at the end of the region', () => {
		const wrapper = mountShelves(['material', 'furniture']);
		const stops = focusStops(region(wrapper));
		const last = definite(stops.at(-1));
		last.focus();

		wrapper.get('.rp-al-shelves').element.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
		);

		expect(document.activeElement).toBe(last);
	});
});

/**
 * §6.2's other question, asked of the same walk: has the pane been given to the inspector?
 *
 * Driven directly rather than only through the mounted surface, because both of its refusing
 * arms — no shell at all, and a shell with no shelves region in it — are states the surface
 * genuinely reaches (a template ref before mount; §4's empty and no-matches states, which
 * replace the region outright) and neither is a state a mounted case can hold still.
 */
describe('whether the pane has swapped', () => {
	it('answers no when there is no shell and no when the shell holds no shelves region', () => {
		expect(shelvesWithdrawn(null)).toBe(false);
		expect(shelvesWithdrawn(document.createElement('div'))).toBe(false);
	});

	it('answers yes only once the region is off the layout', () => {
		const wrapper = mountShelves(['material']);
		const shell = definite(region(wrapper).parentElement);

		expect(shelvesWithdrawn(shell)).toBe(false);

		region(wrapper).style.display = 'none';

		expect(shelvesWithdrawn(shell)).toBe(true);
	});
});

/**
 * The handoff's own fallback, and it has two causes rather than one: the target is not there at
 * all, or it is there and not laid out. §6.2 names the second — `Back to library` returns focus
 * to a row that can be inside a shelf the user has since collapsed, and `focus()` on an element
 * that is not laid out silently does nothing, stranding the caret on `<body>` with the inspector
 * already gone.
 */
describe('handing focus to the first laid-out target', () => {
	it('falls back when the target is absent, and when it is present but not laid out', () => {
		const wrapper = mountShelves([]);
		const shell = definite(region(wrapper).parentElement);
		const elsewhere = document.createElement('button');
		document.body.append(elsewhere);

		focusWithin(shell, '.rp-al-nothing-of-the-kind', elsewhere);
		expect(document.activeElement).toBe(elsewhere);

		// A row of a COLLAPSED shelf: in the DOM, and not laid out.
		focusWithin(shell, '.rp-al-row', elsewhere);
		expect(document.activeElement).toBe(elsewhere);

		focusWithin(shell, 'button.rp-al-shelf__head', elsewhere);
		expect(document.activeElement).toBe(wrapper.get('button.rp-al-shelf__head').element);

		elsewhere.remove();
	});
});
