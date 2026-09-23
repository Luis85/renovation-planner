/**
 * @vitest-environment jsdom
 *
 * AD18-R18's view state, through the REAL `AssetLibraryView` on a fake leaf, the way
 * `assetLibraryViewState.test.ts` drives §6.3's `assetId` and `expanded`. The chosen layout lives
 * in Obsidian's own view state beside the expanded categories, per §6.3, and a change to it is
 * not a navigation.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { ok } from '../../../src/core/result/Result';
import type { AssetLibraryView } from '../../../src/presentation/library/AssetLibraryView';
import { unavailableAssetLibraryQueries } from '../../../src/presentation/read-models/assetLibraryQueries';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { tr } from '../../../src/presentation/i18n/strings';
import { installObsidianDom } from '../../helpers/dom';
import { settle } from '../../helpers/async';
import { anEntry } from '../../helpers/assetLibraryRootHarness';
import { defaultAssetLibraryDeps, makeAssetLibraryView } from '../../helpers/makeAssetLibraryView';
import { FakeLeaf } from '../../helpers/workspace';

installObsidianDom();

const ALDER = anEntry({ assetId: createAssetId(), category: 'material', name: 'Alder plank' });
const SOFA = anEntry({ assetId: createAssetId(), category: 'furniture', name: 'Sofa' });

const openViews: AssetLibraryView[] = [];

afterEach(async () => {
	for (const view of openViews.splice(0)) await view.onClose();
	await settle();
});

async function openLibrary(): Promise<AssetLibraryView> {
	const leaf = new FakeLeaf();
	const queries = {
		...unavailableAssetLibraryQueries(),
		listCatalogue: () => Promise.resolve(ok({ entries: [ALDER, SOFA], unreadable: [] })),
	};
	const view = makeAssetLibraryView(defaultAssetLibraryDeps({ queries }), leaf);
	openViews.push(view);
	leaf.view = view;
	await view.onOpen();
	await settle();
	return view;
}

function button(view: AssetLibraryView, label: string): HTMLElement {
	const found = [...view.contentEl.querySelectorAll<HTMLElement>('button')].find((el) => el.textContent?.trim() === label);
	if (found === undefined) throw new Error(`no button labelled ${label}`);
	return found;
}

describe('the layout in Obsidian\'s view state', () => {
	it('carries a switch to Grid into getState, and drops the key again back on List', async () => {
		const view = await openLibrary();

		button(view, tr('view.asset-library.layout.grid')).click();
		await settle();
		expect(view.getState()).toEqual({ assetId: '', expanded: [], layout: 'grid' });

		button(view, tr('view.asset-library.layout.list')).click();
		await settle();
		expect(view.getState()).toEqual({ assetId: '', expanded: [] });
	});

	it('keeps the layout beside a selection made after it', async () => {
		const view = await openLibrary();
		button(view, tr('view.asset-library.layout.grid')).click();
		await settle();

		view.contentEl.querySelector<HTMLElement>(`[data-asset-id="${ALDER.assetId}"]`)?.click();
		await settle();

		expect(view.getState()).toEqual({ assetId: ALDER.assetId, expanded: [], layout: 'grid' });
	});

	/** A restored leaf opens in the layout it was saved with, drawn in place rather than remounted. */
	it('draws the grid for a restored layout, in place', async () => {
		const view = await openLibrary();
		const shell = view.contentEl.querySelector('.renovation-asset-library');

		await view.setState({ assetId: '', layout: 'grid' }, {} as never);
		await settle();

		expect(view.contentEl.querySelectorAll('.rp-al-tile')).toHaveLength(2);
		expect(view.contentEl.querySelector('.renovation-asset-library')).toBe(shell);
	});

	it('never records a layout or a category change as a navigation', async () => {
		const view = await openLibrary();
		const result = {} as never as { history?: boolean };

		await view.setState({ assetId: '', layout: 'grid', category: 'furniture' }, result as never);

		expect(result.history).toBeFalsy();
		expect(view.getState()).toEqual({ assetId: '', expanded: [], layout: 'grid', category: 'furniture' });
	});
});
