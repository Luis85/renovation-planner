/**
 * @vitest-environment jsdom
 *
 * AD18-R18's category sidebar, its funnel and the Grid view's `Create your own` card, through the
 * REAL mounted root. The sidebar FILTERS the shelves in both layouts and manages nothing (§10's
 * *"No category management"*). It lists `All` plus the same derived vocabulary the shelves draw
 * (§3.2), so the two can never disagree about which categories exist.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { ok, type Result } from '../../../src/core/result/Result';
import type { AppError } from '../../../src/core/errors/AppError';
import type { Asset } from '../../../src/domain/asset/Asset';
import type { CreateAssetInput } from '../../../src/application/commands/asset/CreateAsset';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { tr } from '../../../src/presentation/i18n/strings';
import AssetCategoryNav from '../../../src/presentation/library/AssetCategoryNav.vue';
import NewAssetForm from '../../../src/presentation/views/NewAssetForm.vue';
import { isLaidOut } from '../../../src/presentation/library/shelfFocus';
import { unavailableAssetLibraryQueries } from '../../../src/presentation/read-models/assetLibraryQueries';
import { makeAsset } from '../../helpers/entities';
import { installObsidianDom } from '../../helpers/dom';
import { settle } from '../../helpers/async';
import { anEntry, definite, mountRoot } from '../../helpers/assetLibraryRootHarness';
import { installNarrowComposition } from './narrowComposition';

installObsidianDom();

const ALDER = anEntry({ assetId: createAssetId(), category: 'material', name: 'Alder plank' });
const SOFA = anEntry({ assetId: createAssetId(), category: 'furniture', name: 'Sofa' });
const VANITY = anEntry({ assetId: createAssetId(), category: 'fixture', name: 'Vanity' });

const mounted: VueWrapper[] = [];
const installed: HTMLStyleElement[] = [];

afterEach(() => {
	for (const wrapper of mounted.splice(0)) wrapper.unmount();
	for (const style of installed.splice(0)) style.remove();
});

async function mountLibrary(options: Parameters<typeof mountRoot>[0] = {}): Promise<VueWrapper> {
	const root = await mountRoot({ entries: [ALDER, SOFA, VANITY], attach: true, ...options });
	mounted.push(root);
	return root;
}

const funnel = (root: VueWrapper) => root.get('button.rp-al-filter');
const sidebar = (root: VueWrapper) => root.get('.rp-al-categories');
const sidebarShown = (root: VueWrapper): boolean => isLaidOut(sidebar(root).element as HTMLElement, root.element as HTMLElement);
const category = (root: VueWrapper, label: string) =>
	definite(root.findAll('button.rp-al-category').find((el) => el.text() === label));
const layout = async (root: VueWrapper, key: 'grid' | 'list'): Promise<void> => {
	await definite(root.findAll('.rp-al-layout button').find((el) => el.text() === tr(`view.asset-library.layout.${key}`))).trigger('click');
	await settle();
};

describe('the sidebar', () => {
	it('lists All and then every category the shelves draw, each with its icon', async () => {
		const root = await mountLibrary();
		await layout(root, 'grid');
		const buttons = root.findAll('button.rp-al-category');

		expect(buttons.map((el) => el.text())).toEqual([
			tr('view.asset-library.category.all'),
			...['material', 'furniture', 'fixture', 'plant', 'equipment', 'building-element', 'custom'].map((key) =>
				tr(`form.new-asset.category.${key}` as never),
			),
		]);
		expect(buttons.map((el) => el.get('.rp-host-icon').attributes('data-icon'))).toEqual([
			'grid-2x-2', 'layers', 'armchair', 'bath', 'sprout', 'hammer', 'brick-wall', 'pencil',
		]);
		expect(buttons.map((el) => el.get('.rp-host-icon').attributes('data-icon-missing'))).toEqual(Array.from({ length: 8 }, () => undefined));
		expect(category(root, tr('view.asset-library.category.all')).attributes('aria-pressed')).toBe('true');
	});

	/** §3.2's group 2 cannot reach a shelf today, so the `tag` arm is driven at the component. */
	it('marks a category the build does not declare with the tag icon', async () => {
		const nav = mount(AssetCategoryNav, {
			props: { shelves: [{ category: 'insulation', label: 'insulation', entries: [] }], category: '', open: true },
		});
		mounted.push(nav);
		await settle();

		expect(nav.findAll('.rp-host-icon').map((el) => el.attributes('data-icon'))).toEqual(['grid-2x-2', 'tag']);
	});

	it('filters the grid to one category and back to All', async () => {
		const root = await mountLibrary();
		await layout(root, 'grid');

		await category(root, tr('form.new-asset.category.furniture')).trigger('click');
		await settle();

		expect(root.findAll('.rp-al-tile__name').map((el) => el.text())).toEqual(['Sofa']);
		expect(category(root, tr('form.new-asset.category.furniture')).attributes('aria-pressed')).toBe('true');

		await category(root, tr('view.asset-library.category.all')).trigger('click');
		await settle();

		expect(root.findAll('.rp-al-tile__name').map((el) => el.text())).toEqual(['Alder plank', 'Sofa', 'Vanity']);
	});

	it('filters the list to that one shelf', async () => {
		const root = await mountLibrary();
		await funnel(root).trigger('click');

		await category(root, tr('form.new-asset.category.fixture')).trigger('click');
		await settle();

		expect(root.findAll('.rp-al-shelf__name').map((el) => el.text())).toEqual([tr('form.new-asset.category.fixture')]);
	});

	/** The same one focus manager: `↓`/`↑` step through the categories. */
	it('moves through the categories with the arrow keys', async () => {
		const root = await mountLibrary();
		await layout(root, 'grid');
		(category(root, tr('view.asset-library.category.all')).element as HTMLElement).focus();

		await sidebar(root).trigger('keydown', { key: 'ArrowDown' });
		expect(document.activeElement?.textContent).toBe(tr('form.new-asset.category.material'));
		await sidebar(root).trigger('keydown', { key: 'ArrowUp' });
		expect(document.activeElement?.textContent).toBe(tr('view.asset-library.category.all'));
	});

	/** §7 below 35rem: a selection gives the pane to the inspector, and the sidebar leaves with the shelves. */
	it('leaves with the shelves when the narrow pane swaps to the inspector', async () => {
		installed.push(installNarrowComposition());
		const root = await mountLibrary();
		await layout(root, 'grid');
		expect(sidebarShown(root)).toBe(true);

		await definite(root.findAll('button.rp-al-tile').find((el) => el.text().includes('Sofa'))).trigger('click');
		await settle();

		expect(sidebarShown(root)).toBe(false);
	});
});

describe('the funnel', () => {
	/** The List's default is the List as it was, so the sidebar starts closed there and open in Grid. */
	it('starts closed in List and open in Grid', async () => {
		const root = await mountLibrary();

		expect(sidebarShown(root)).toBe(false);
		expect(funnel(root).attributes('aria-expanded')).toBe('false');

		await layout(root, 'grid');

		expect(sidebarShown(root)).toBe(true);
		expect(funnel(root).attributes('aria-expanded')).toBe('true');
	});

	it('toggles the sidebar, and a press holds across a layout change', async () => {
		const root = await mountLibrary();

		await funnel(root).trigger('click');
		expect(sidebarShown(root)).toBe(true);
		await layout(root, 'grid');
		await funnel(root).trigger('click');
		await layout(root, 'list');
		await layout(root, 'grid');

		expect(sidebarShown(root)).toBe(false);
	});

	/** A filter must be visible with the sidebar shut, and not by colour alone. */
	it('names the active category in words beside its own name', async () => {
		const root = await mountLibrary();
		await funnel(root).trigger('click');
		await category(root, tr('form.new-asset.category.plant')).trigger('click');
		await settle();

		expect(funnel(root).text()).toContain(tr('form.new-asset.category.plant'));
		expect(funnel(root).classes()).toContain('rp-al-filter--on');
		expect(funnel(root).text()).toContain(tr('view.asset-library.filter'));
	});
});

/**
 * A catalogue the create command writes into, so the re-read after a creation finds the new
 * asset the way a vault would, which is what the root's post-create filter rule turns on.
 */
function creatingLibrary() {
	const listing = [ALDER, SOFA, VANITY];
	const createAsset = vi.fn<(input: CreateAssetInput) => Promise<Result<Asset, AppError>>>((input) => {
		const asset = makeAsset({ name: input.name, category: input.category });
		listing.push(anEntry({ assetId: asset.id, name: input.name, category: input.category }));
		return Promise.resolve(ok(asset));
	});
	return {
		commands: { createAsset: { execute: createAsset } },
		queries: {
			...unavailableAssetLibraryQueries(),
			listCatalogue: () => Promise.resolve(ok({ entries: [...listing], unreadable: [] })),
		},
	};
}

describe('the Create your own card', () => {
	it('ends the grid, and opens the existing New asset form', async () => {
		const root = await mountLibrary(creatingLibrary());
		await layout(root, 'grid');
		const items = root.get('.rp-al-tiles').element.children;

		expect(items[items.length - 1]?.classList.contains('rp-al-create-card')).toBe(true);
		expect(root.get('.rp-al-create-card').text()).toContain(tr('view.asset-library.create-card.title'));

		await root.get('.rp-al-create-card__action').trigger('click');
		await settle();

		expect(root.findComponent(NewAssetForm).exists()).toBe(true);
	});

	/**
	 * The created asset is selected, so it has to be on screen: a filter to another category is
	 * dropped exactly as the search is, and a filter to the created asset's own category is kept.
	 */
	it.each([
		['drops a filter that would hide the created asset', 'form.new-asset.category.furniture', ''],
		['keeps a filter the created asset is inside', 'form.new-asset.category.material', 'material'],
	])('%s', async (_label, filterKey, expected) => {
		const root = await mountLibrary(creatingLibrary());
		await layout(root, 'grid');
		await category(root, tr(filterKey as never)).trigger('click');
		await settle();

		await root.get('.rp-al-create-card__action').trigger('click');
		await settle();
		const form = root.findComponent(NewAssetForm);
		await form.get('[data-field="name"]').setValue('Walnut plank');
		await form.get('[data-field="unitCostAmount"]').setValue('40.00');
		await form.get('form').trigger('submit');
		await settle();

		const pressed = root.findAll('button.rp-al-category').find((el) => el.attributes('aria-pressed') === 'true');
		const all = tr('view.asset-library.category.all');
		expect(pressed?.text()).toBe(expected === '' ? all : tr('form.new-asset.category.material'));
	});
});
