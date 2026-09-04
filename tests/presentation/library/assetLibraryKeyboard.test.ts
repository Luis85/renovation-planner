/**
 * @vitest-environment jsdom
 *
 * §6.2's keyboard and §6.1's narrow-search rule, over the WHOLE mounted surface — the shelves,
 * the inspector Task 16a first mounts, and the toolbar the two hand focus back and forth to.
 *
 * **Mounted into `document.body`, and the reason is the instrument rather than tidiness.**
 * `focus()` on a detached element does nothing, and `getComputedStyle` only resolves a
 * STYLESHEET rule for an element actually in the document. Both matter here: §7's narrow
 * composition is a container query, which this jsdom does not evaluate at all, so `narrow()`
 * below installs the shipped rule's own selector WITHOUT its `@container` wrapper and the
 * surface is then hidden by the same attribute production hides it by.
 *
 * **What that stands in for and what it cannot**: the SELECTOR, the attribute it keys on and
 * every behaviour hanging off the resulting layout are real here; whether the container query
 * fires at 560px in a vault is not, and `tests/build/styles.test.ts` pins that rule's text
 * while Task 17's 460px capture is the first eye on it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { VueWrapper } from '@vue/test-utils';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { installObsidianDom } from '../../helpers/dom';
import { settle } from '../../helpers/async';
import { anEntry, definite, mountRoot } from '../../helpers/assetLibraryRootHarness';

installObsidianDom();

const mounted: VueWrapper[] = [];
const installed: HTMLStyleElement[] = [];

afterEach(() => {
	for (const wrapper of mounted.splice(0)) wrapper.unmount();
	for (const style of installed.splice(0)) style.remove();
});

/**
 * §7's third rung, minus the `@container` wrapper this jsdom cannot evaluate: the shell hides
 * `.rp-al-body` once something is selected, and the inspector withdraws when it is resting or
 * standing aside for a search. Both selectors are copied from the shipped partials rather than
 * invented — `styles/asset-library.css` and `styles/asset-library-inspector.css`.
 */
function narrow(): void {
	const style = document.createElement('style');
	style.textContent = `
		.renovation-asset-library[data-selected-asset-id]:not([data-selected-asset-id='']) .rp-al-body { display: none; }
		.rp-al-inspector--rest, .rp-al-inspector--away { display: none; }
	`;
	document.head.append(style);
	installed.push(style);
}

const ALDER = anEntry({ assetId: createAssetId(), category: 'material', name: 'Alder plank' });
const BIRCH = anEntry({ assetId: createAssetId(), category: 'material', name: 'Birch plank' });
const SOFA = anEntry({ assetId: createAssetId(), category: 'furniture', name: 'Sofa' });

async function mountLibrary(expanded: readonly string[] = ['material', 'furniture']): Promise<VueWrapper> {
	const root = await mountRoot({ entries: [ALDER, BIRCH, SOFA], expanded: undefined, attach: true });
	mounted.push(root);
	for (const category of expanded) {
		const head = root
			.findAll('button.rp-al-shelf__head')
			.find((el) => el.text().includes(category === 'material' ? 'Material' : 'Furniture'));
		await head?.trigger('click');
	}
	await settle();
	return root;
}

const active = (): Element | null => document.activeElement;

describe('the arrow keys over the shelves region', () => {
	it('moves between the stops of one region and wraps into the next shelf header', async () => {
		const root = await mountLibrary();
		const stops = root.findAll('.rp-al-shelves button');
		const birch = definite(stops.find((el) => el.text().includes('Birch plank')));
		(birch.element as HTMLElement).focus();

		await root.get('.rp-al-shelves').trigger('keydown', { key: 'ArrowDown' });

		expect(active()?.textContent).toContain('Furniture');

		await root.get('.rp-al-shelves').trigger('keydown', { key: 'ArrowUp' });

		expect(active()?.textContent).toContain('Birch plank');
	});

	/**
	 * The refusal half: with focus somewhere the region does not own, the keys are left to
	 * whatever Obsidian binds them to rather than teleporting the caret into the list.
	 */
	it('does nothing when focus is not on one of the region\'s own stops', async () => {
		const root = await mountLibrary();
		const search = root.get('.rp-al-search__input').element as HTMLElement;
		search.focus();

		await root.get('.rp-al-shelves').trigger('keydown', { key: 'ArrowDown' });

		expect(active()).toBe(search);
	});
});

describe('the narrow composition\'s focus handoff', () => {
	/**
	 * §6.2: below 35rem the row the user just activated is inside a `display: none` subtree, so
	 * focus would land on a hidden element or reset to the document and the next Tab would start
	 * from the top. The swap moves focus to the inspector's back control.
	 */
	it('moves focus to the back control when the narrow composition swaps', async () => {
		narrow();
		const root = await mountLibrary();

		await root.get(`[data-asset-id="${ALDER.assetId}"]`).trigger('click');
		await settle();

		expect(active()?.classList.contains('rp-al-inspector__back')).toBe(true);
	});

	/**
	 * And the mirror. Read BEFORE the state changes, which is why the case matters: `Back to
	 * library` REVEALS the shelves, so a build asking the DOM afterwards would find them laid
	 * out, conclude no swap had happened and skip the return every time, in every layout.
	 */
	it('returns focus to the row it came from', async () => {
		narrow();
		const root = await mountLibrary();
		await root.get(`[data-asset-id="${ALDER.assetId}"]`).trigger('click');
		await settle();

		await root.get('.rp-al-inspector__back').trigger('click');
		await settle();

		expect((active() as HTMLElement | null)?.dataset['assetId']).toBe(ALDER.assetId);
	});

	/**
	 * The same gesture in a WIDE pane moves nothing: the shelves are laid out beside the rail,
	 * the row the user clicked is still on screen, and stealing focus off it would be the
	 * defect this handoff exists to avoid rather than the fix. Without `narrow()` the shipped
	 * rule cannot match, which is exactly the layout being modelled.
	 */
	it('leaves focus where it was when the shelves stay laid out', async () => {
		const root = await mountLibrary();
		const row = root.get(`[data-asset-id="${ALDER.assetId}"]`).element as HTMLElement;
		row.focus();

		await root.get(`[data-asset-id="${ALDER.assetId}"]`).trigger('click');
		await settle();

		expect(active()).toBe(row);
	});

	/**
	 * §6.2's own reason for the reveal: a selection outlives its shelf being open, so returning
	 * focus to a row inside a collapsed shelf would focus nothing at all with the inspector
	 * already gone. Back expands the shelf it is returning to.
	 */
	it('reveals a collapsed shelf rather than returning focus to a row nobody can see', async () => {
		narrow();
		const root = await mountLibrary([]);
		// Selected through the view state, since with every shelf shut there is no row to click.
		await root.get('button.rp-al-shelf__head').trigger('click');
		await root.get(`[data-asset-id="${ALDER.assetId}"]`).trigger('click');
		await settle();
		await root.get('button.rp-al-shelf__head').trigger('click');
		await settle();

		await root.get('.rp-al-inspector__back').trigger('click');
		await settle();

		expect((active() as HTMLElement | null)?.dataset['assetId']).toBe(ALDER.assetId);
	});

	/**
	 * Back with nothing selected is a real gesture rather than a defensive arm: the control is
	 * drawn in every panel state, §3.5's resting one included, so a user can reach it with no row
	 * ever having been clicked. There is no row to return to and nothing to deselect.
	 */
	it('does nothing when there is no selection to leave', async () => {
		narrow();
		const root = await mountLibrary();
		const search = root.get('.rp-al-search__input').element as HTMLElement;
		search.focus();

		await root.get('.rp-al-inspector__back').trigger('click');
		await settle();

		expect(root.attributes('data-selected-asset-id')).toBe('');
		expect(active()).toBe(search);
	});
});

describe('searching, in the narrow composition', () => {
	/**
	 * §6.1: with the pane given to a selected asset, a user typing into the search field
	 * filtered a list they could not see and the surface appeared to ignore them. The pane
	 * returns to the shelves — which IS emptying the attribute the shipped rule keys on — and
	 * the rail stands aside with it, while the SELECTION itself is untouched.
	 */
	it('returns the narrow composition to the shelves when the user types', async () => {
		narrow();
		const root = await mountLibrary();
		await root.get(`[data-asset-id="${ALDER.assetId}"]`).trigger('click');
		await settle();

		await root.get('.rp-al-search__input').setValue('plank');
		await settle();

		expect(root.attributes('data-selected-asset-id')).toBe('');
		expect(root.get('.rp-al-inspector').classes()).toContain('rp-al-inspector--away');
		expect(root.find('.rp-al-row--on').exists()).toBe(true);
	});

	/**
	 * §6.1: the expansion state is the user's. While a search is running the row is drawn in the
	 * flat Results list whatever its shelf is doing, so Back must NOT expand the shelf it would
	 * otherwise reveal — that would silently rewrite an arrangement the user set, visible only
	 * later, when they clear the search and find a category open that they had closed.
	 */
	it('does not reveal a shelf while a search is running', async () => {
		const root = await mountLibrary([]);
		await root.get('button.rp-al-shelf__head').trigger('click');
		await root.get(`[data-asset-id="${ALDER.assetId}"]`).trigger('click');
		await root.get('button.rp-al-shelf__head').trigger('click');
		await settle();
		expect(root.attributes('data-expanded-categories')).toBe('');

		await root.get('.rp-al-search__input').setValue('plank');
		await settle();
		await root.get('.rp-al-inspector__back').trigger('click');
		await settle();

		expect(root.attributes('data-expanded-categories')).toBe('');
	});

	/** And clearing the field gives the pane back to the asset the user never deselected. */
	it('returns to the selection when the field is emptied', async () => {
		narrow();
		const root = await mountLibrary();
		await root.get(`[data-asset-id="${ALDER.assetId}"]`).trigger('click');
		await settle();
		await root.get('.rp-al-search__input').setValue('plank');
		await settle();

		await root.get('.rp-al-search__input').setValue('');
		await settle();

		expect(root.attributes('data-selected-asset-id')).toBe(ALDER.assetId);
		expect(root.get('.rp-al-inspector').classes()).not.toContain('rp-al-inspector--away');
	});
});

describe('Escape, at its two scopes', () => {
	/**
	 * §6.2's last two rows, asserted together because the whole point is that one key means two
	 * different things at two scopes — in the search field it clears the field; in an inspector
	 * field it resyncs that ONE field through `useFieldCommit.onCancel`, exactly as the Plan
	 * editor's Inspector already behaves. The second half is only reachable at all because this
	 * task mounts the panel.
	 */
	it('clears the search on Escape and resyncs one inspector field on Escape', async () => {
		const root = await mountLibrary();
		await root.get('.rp-al-search__input').setValue('plank');
		await settle();

		await root.get('.rp-al-search__input').trigger('keydown.esc');
		await settle();

		expect((root.get('.rp-al-search__input').element as HTMLInputElement).value).toBe('');

		await root.get(`[data-asset-id="${ALDER.assetId}"]`).trigger('click');
		await settle();
		const name = root.get('[data-field="name"]');
		await name.setValue('Something else');
		expect((name.element as HTMLInputElement).value).toBe('Something else');

		await name.trigger('keydown.esc');
		await settle();

		expect((root.get('[data-field="name"]').element as HTMLInputElement).value).toBe(ALDER.name);
		// ONE field, never the panel: the heading beside it is drawn from the catalogue entry and
		// was never a draft, so a build that resynced the whole panel would read the same here —
		// which is why the discriminating assertion is the input's own value above.
		expect(root.get('.rp-al-inspector__name').text()).toBe(ALDER.name);
	});
});
