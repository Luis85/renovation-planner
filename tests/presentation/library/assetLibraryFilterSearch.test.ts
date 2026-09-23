/**
 * @vitest-environment jsdom
 *
 * AD18-R18's category filter meeting §6.1's search and §4's empty states, in both layouts. What
 * is announced and what an empty pane says are both about the DRAWN set, and the drawn set is
 * the search's matches narrowed to the filter's category, not the search's matches alone.
 *
 * Also the funnel's names: Obsidian draws a tooltip from `aria-label` and from nothing else, so
 * an icon-only control needs one (`DesignerHeader.vue` records the same defect fixed once).
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { VueWrapper } from '@vue/test-utils';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { tr } from '../../../src/presentation/i18n/strings';
import { isLaidOut } from '../../../src/presentation/library/shelfFocus';
import { installObsidianDom } from '../../helpers/dom';
import { settle } from '../../helpers/async';
import { anEntry, definite, mountRoot } from '../../helpers/assetLibraryRootHarness';
import { installNarrowComposition } from './narrowComposition';

installObsidianDom();

/** No supplier and no SKU, so a query matches by name alone. */
const bare = { supplier: null, sku: null } as const;
const ALDER = anEntry({ ...bare, assetId: createAssetId(), category: 'material', name: 'Alder plank' });
const SOFA = anEntry({ ...bare, assetId: createAssetId(), category: 'furniture', name: 'Sofa' });
const VANITY = anEntry({ ...bare, assetId: createAssetId(), category: 'fixture', name: 'Vanity' });

const mounted: VueWrapper[] = [];
const installed: HTMLStyleElement[] = [];

afterEach(() => {
	for (const wrapper of mounted.splice(0)) wrapper.unmount();
	for (const style of installed.splice(0)) style.remove();
});

async function mountLibrary(view: 'grid' | 'list'): Promise<VueWrapper> {
	const root = await mountRoot({ entries: [ALDER, SOFA, VANITY], attach: true });
	mounted.push(root);
	await definite(root.findAll('.rp-al-layout button').find((el) => el.attributes('aria-label') === tr(`view.asset-library.layout.${view}`))).trigger('click');
	await settle();
	// The List starts with its sidebar withdrawn; the Grid shows it already.
	if (view === 'list') await root.get('button.rp-al-filter').trigger('click');
	return root;
}

const choose = async (root: VueWrapper, key: string): Promise<void> => {
	await definite(root.findAll('button.rp-al-category').find((el) => el.text() === tr(key as never))).trigger('click');
	await settle();
};
const search = async (root: VueWrapper, query: string): Promise<void> => {
	await root.get('.rp-al-search__input').setValue(query);
	await settle();
};
const headline = (root: VueWrapper): string | undefined => {
	const found = root.find('.rp-empty-state__headline');
	return found.exists() ? found.text() : undefined;
};

describe.each(['grid', 'list'] as const)('a search under a category filter, in %s', (view) => {
	it('announces the count of what is drawn, not of every match', async () => {
		const root = await mountLibrary(view);
		await choose(root, 'form.new-asset.category.furniture');

		await search(root, 'a');

		expect(root.get('.rp-al-results').text()).toBe(tr('view.asset-library.search.results', { count: '1' }));
	});

	/** Matches exist, just none in this category: say so, and offer the way out. */
	it('says no matches in the category, and clears the filter from there', async () => {
		const root = await mountLibrary(view);
		await choose(root, 'form.new-asset.category.furniture');

		await search(root, 'plank');

		expect(headline(root)).toBe(tr('view.asset-library.filtered.no-matches', { category: tr('form.new-asset.category.furniture') }));
		await root.get('.rp-empty-state__action').trigger('click');
		await settle();

		expect(headline(root)).toBeUndefined();
		expect(document.activeElement?.textContent).toBe(tr('view.asset-library.category.all'));
		expect(root.get('.rp-al-results').text()).toBe(tr('view.asset-library.search.results', { count: '1' }));
		expect(root.findAll('button.rp-al-category').find((el) => el.attributes('aria-pressed') === 'true')?.text()).toBe(
			tr('view.asset-library.category.all'),
		);
	});

	/** No search, and a declared category holding nothing: the same honesty, worded for it. */
	it('says a category holds no assets yet', async () => {
		const root = await mountLibrary(view);

		await choose(root, 'form.new-asset.category.plant');

		expect(headline(root)).toBe(tr('view.asset-library.filtered.none', { category: tr('form.new-asset.category.plant') }));
	});
});

describe('the funnel and the switch, named for Obsidian\'s tooltip', () => {
	it('labels Grid and List with their words', async () => {
		const root = await mountLibrary('grid');

		expect(root.findAll('.rp-al-layout button').map((el) => el.attributes('aria-label'))).toEqual([
			tr('view.asset-library.layout.grid'),
			tr('view.asset-library.layout.list'),
		]);
	});

	/** Label-in-name: while a filter holds, the name carries the category word the eye reads. */
	it('names the funnel, with the visible category while a filter holds, and points it at the sidebar', async () => {
		const root = await mountLibrary('grid');
		const funnel = root.get('button.rp-al-filter');

		expect(funnel.attributes('aria-label')).toBe(tr('view.asset-library.filter'));
		expect(funnel.attributes('aria-controls')).toBe(root.get('.rp-al-categories').attributes('id'));

		await choose(root, 'form.new-asset.category.fixture');

		const label = funnel.attributes('aria-label');
		expect(label).toBe(tr('view.asset-library.filter.active', { category: tr('form.new-asset.category.fixture') }));
		expect(label).toContain(funnel.text());
	});

	/** §7 below 35rem: while the inspector owns the pane, a funnel would show nothing, so it leaves. */
	it('leaves the toolbar while a narrow pane shows a selection', async () => {
		installed.push(installNarrowComposition());
		const root = await mountLibrary('grid');
		const funnel = root.get('button.rp-al-filter').element as HTMLElement;
		expect(isLaidOut(funnel, root.element as HTMLElement)).toBe(true);

		await definite(root.findAll('button.rp-al-tile').find((el) => el.text().includes('Sofa'))).trigger('click');
		await settle();

		expect(isLaidOut(funnel, root.element as HTMLElement)).toBe(false);
	});
});
