/**
 * @vitest-environment jsdom
 *
 * AD18-R18's Grid view, through the REAL mounted root: the `Grid | List` switch, one tile per
 * asset, and a tile selecting into the same inspector a row does. List stays the default, and
 * every list case in this folder runs unchanged beside this file.
 *
 * Attached to `document.body` for the reason `assetLibraryKeyboard.test.ts` gives: `focus()` on a
 * detached element does nothing.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { ok } from '../../../src/core/result/Result';
import { createAssetId, type AssetId } from '../../../src/domain/asset/AssetId';
import type { AssetOutline } from '../../../src/application/queries/ListAssetOutlines';
import { unavailableAssetLibraryQueries } from '../../../src/presentation/read-models/assetLibraryQueries';
import { tr } from '../../../src/presentation/i18n/strings';
import { installObsidianDom } from '../../helpers/dom';
import { settle } from '../../helpers/async';
import { anEntry, definite, mountRoot } from '../../helpers/assetLibraryRootHarness';
import { installNarrowComposition } from './narrowComposition';
import AssetGrid from '../../../src/presentation/library/AssetGrid.vue';
import { focusRowAt, rowPositionOf } from '../../../src/presentation/library/shelfFocus';

installObsidianDom();

const ALDER = anEntry({ assetId: createAssetId(), category: 'material', name: 'Alder plank' });
const BIRCH = anEntry({ assetId: createAssetId(), category: 'material', name: 'Birch plank' });
const SOFA = anEntry({ assetId: createAssetId(), category: 'furniture', name: 'Sofa' });
const TABLE = anEntry({ assetId: createAssetId(), category: 'furniture', name: 'Table' });
const VANITY = anEntry({ assetId: createAssetId(), category: 'fixture', name: 'Vanity' });

const OUTLINES = new Map<AssetId, AssetOutline>([
	[ALDER.assetId, { kind: 'measured', points: [{ x: 0, y: 0 }, { x: 800, y: 0 }, { x: 800, y: 450 }], extent: { width: 800, depth: 450 } }],
	[BIRCH.assetId, { kind: 'unscaled', points: [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 45 }], extent: { width: 60, depth: 45 } }],
]);

const mounted: VueWrapper[] = [];
const installed: HTMLStyleElement[] = [];

afterEach(() => {
	for (const wrapper of mounted.splice(0)) wrapper.unmount();
	for (const style of installed.splice(0)) style.remove();
});

async function mountLibrary(): Promise<VueWrapper> {
	const entries = [ALDER, BIRCH, SOFA, TABLE, VANITY];
	const root = await mountRoot({
		attach: true,
		queries: {
			...unavailableAssetLibraryQueries(),
			listCatalogue: () => Promise.resolve(ok({ entries, unreadable: [] })),
			listOutlines: (ids) => Promise.resolve(new Map(ids.map((id) => [id, OUTLINES.get(id) ?? { kind: 'none' as const }]))),
		},
	});
	mounted.push(root);
	return root;
}

const layoutButton = (root: VueWrapper, key: 'grid' | 'list') =>
	definite(root.findAll('.rp-al-layout button').find((el) => el.text() === tr(`view.asset-library.layout.${key}`)));

async function showGrid(root: VueWrapper): Promise<void> {
	await layoutButton(root, 'grid').trigger('click');
	await settle();
}

const tileNamed = (root: VueWrapper, name: string) =>
	definite(root.findAll('button.rp-al-tile').find((el) => el.get('.rp-al-tile__name').text() === name));

describe('the Grid | List switch', () => {
	it('draws the list by default and says so', async () => {
		const root = await mountLibrary();

		expect(layoutButton(root, 'list').attributes('aria-pressed')).toBe('true');
		expect(layoutButton(root, 'grid').attributes('aria-pressed')).toBe('false');
		expect(root.find('.rp-al-tiles').exists()).toBe(false);
		expect(root.find('.rp-al-shelf').exists()).toBe(true);
	});

	it('swaps the shelves for one tile per asset, in name order, and back', async () => {
		const root = await mountLibrary();

		await showGrid(root);

		expect(layoutButton(root, 'grid').attributes('aria-pressed')).toBe('true');
		expect(root.find('.rp-al-shelf').exists()).toBe(false);
		expect(root.findAll('.rp-al-tile__name').map((el) => el.text())).toEqual([
			'Alder plank', 'Birch plank', 'Sofa', 'Table', 'Vanity',
		]);

		await layoutButton(root, 'list').trigger('click');
		await settle();

		expect(root.find('.rp-al-tiles').exists()).toBe(false);
		expect(root.find('.rp-al-shelf').exists()).toBe(true);
	});
});

describe('a tile', () => {
	/** The row's own wording: `800 × 450 mm` measured, the unit withheld for an unscaled outline. */
	it('prints the measured size in the row\'s wording and nothing for an asset with no shape', async () => {
		const root = await mountLibrary();
		await showGrid(root);

		expect(tileNamed(root, 'Alder plank').get('.rp-al-tile__size').text()).toBe('800 × 450 mm');
		expect(tileNamed(root, 'Birch plank').get('.rp-al-tile__size').text()).toBe('60 × 45');
		expect(tileNamed(root, 'Sofa').get('.rp-al-tile__size').text()).toBe('');
	});

	/** §3.4's words, held OUTSIDE the button so they describe the tile rather than joining its name. */
	it('describes its mark in words from outside the button', async () => {
		const root = await mountLibrary();
		await showGrid(root);
		const tile = tileNamed(root, 'Alder plank');
		const words = document.getElementById(definite(tile.attributes('aria-describedby')));

		expect(words?.textContent).toBe(`${tr('view.asset-library.shape.measured')}, 800 × 450 mm`);
		expect(tile.element.contains(words)).toBe(false);
		expect(tile.get('.rp-al-mark').classes()).toContain('rp-al-mark--measured');
	});

	it('selects into the same inspector a row does, marked by aria-current', async () => {
		const root = await mountLibrary();
		await showGrid(root);

		await tileNamed(root, 'Sofa').trigger('click');
		await settle();

		expect(root.attributes('data-selected-asset-id')).toBe(SOFA.assetId);
		expect(tileNamed(root, 'Sofa').attributes('aria-current')).toBe('true');
		expect(tileNamed(root, 'Table').attributes('aria-current')).toBeUndefined();
		expect(root.get('.rp-al-inspector').text()).toContain('Sofa');
	});

	/** §7 below 35rem: the grid's scroll box is the shelves region, so the same swap moves focus. */
	it('hands focus to Back to library when the narrow pane swaps to the inspector', async () => {
		installed.push(installNarrowComposition());
		const root = await mountLibrary();
		await showGrid(root);

		await tileNamed(root, 'Sofa').trigger('click');
		await settle();

		expect(document.activeElement?.classList.contains('rp-al-inspector__back')).toBe(true);
	});
});

/** A grid of three column tracks, resolved the way a browser reports them. */
async function gridOfThree(): Promise<VueWrapper> {
	const root = await mountLibrary();
	await showGrid(root);
	(root.get('.rp-al-tiles').element as HTMLElement).style.gridTemplateColumns = '120px 120px 120px';
	return root;
}

const press = async (root: VueWrapper, key: string): Promise<void> => {
	await root.get('.rp-al-tiles').trigger('keydown', { key });
};
const focusedName = (): string | undefined =>
	document.activeElement?.querySelector('.rp-al-tile__name')?.textContent ?? undefined;

describe('the arrow keys over the grid', () => {
	it('moves one stop sideways and one row of tracks up and down', async () => {
		const root = await gridOfThree();
		(tileNamed(root, 'Alder plank').element as HTMLElement).focus();

		await press(root, 'ArrowRight');
		expect(focusedName()).toBe('Birch plank');
		await press(root, 'ArrowDown');
		expect(focusedName()).toBe('Vanity');
		await press(root, 'ArrowLeft');
		expect(focusedName()).toBe('Table');
		await press(root, 'ArrowUp');
		expect(focusedName()).toBe('Alder plank');
	});

	it('stops at the top edge rather than wrapping', async () => {
		const root = await gridOfThree();
		(tileNamed(root, 'Birch plank').element as HTMLElement).focus();

		await press(root, 'ArrowUp');

		expect(focusedName()).toBe('Birch plank');
	});

	/**
	 * A column with no tile below lands on the last stop, so the short last row is reachable. At
	 * the last stop the key is left to the browser, as `moveFocus` leaves it at either end, so the
	 * scroll box can still scroll.
	 */
	it('lands on the last stop when the row below is short, then leaves the key alone', async () => {
		const root = await gridOfThree();
		(tileNamed(root, 'Sofa').element as HTMLElement).focus();

		await press(root, 'ArrowDown');
		const last = document.activeElement;
		const again = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
		last?.dispatchEvent(again);

		expect(document.activeElement).toBe(last);
		expect(last).not.toBe(tileNamed(root, 'Sofa').element);
		expect(again.defaultPrevented).toBe(false);
	});

	/** The card spans the row under a short last row, so `↑` lands on that row's first tile. */
	it('rises from the full-width Create card into the short last row, not past it', async () => {
		const root = await gridOfThree();
		(root.get('.rp-al-create-card__action').element as HTMLElement).focus();

		await press(root, 'ArrowUp');

		expect(focusedName()).toBe('Table');
	});

	/**
	 * jsdom answers the SPECIFIED track list, `repeat(auto-fill, …)`, where a browser answers the
	 * used one. That string splits into three words, and only lengths count as tracks, so a grid
	 * nobody measured steps by one stop rather than by three.
	 */
	it('steps by one stop when the grid reports no resolved tracks', async () => {
		const style = document.createElement('style');
		style.textContent = '.rp-al-tiles { grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr)); }';
		document.head.append(style);
		installed.push(style);
		const root = await mountLibrary();
		await showGrid(root);
		(tileNamed(root, 'Alder plank').element as HTMLElement).focus();

		await press(root, 'ArrowDown');

		expect(focusedName()).toBe('Birch plank');
	});
});

/**
 * §3.5's post-deletion rule over tiles: the tile that now holds the deleted one's index, found
 * by the same `rowPositionOf`/`focusRowAt` pair the shelves use, so a delete from the Grid view
 * does not drop the caret on the search field while a neighbour is on screen.
 */
describe('the post-deletion focus over the grid', () => {
	it('finds the position of a tile and focuses the tile that takes it', async () => {
		const grid = mount(AssetGrid, {
			attachTo: document.body,
			props: { entries: [ALDER, BIRCH, SOFA], selectedId: null, outlineFor: () => null },
		});
		mounted.push(grid);
		const position = rowPositionOf(grid.element as HTMLElement, BIRCH.assetId);

		expect(position?.index).toBe(1);
		await grid.setProps({ entries: [ALDER, SOFA] });
		focusRowAt(position, null);

		expect(focusedName()).toBe('Sofa');
	});
});
