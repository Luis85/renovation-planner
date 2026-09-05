/**
 * @vitest-environment jsdom
 *
 * §6.3's WRITE half, through the REAL `AssetLibraryView` on a real (fake) leaf — Task 13 shipped
 * the read half alone and said so, and this is what closes it.
 *
 * Every case here drives the whole loop rather than the callback: a row clicked in the Vue tree
 * reaches `context.publishViewState`, which writes the view's own refs and asks Obsidian to
 * record the state, which comes back through `setState`. Asserting on `getState()` is what makes
 * the case about the LEAF's memory rather than about a function having been called.
 *
 * `leaf.view = view` is what makes the round trip happen at all: `FakeLeaf.setViewState` calls
 * `view.setState` exactly as Obsidian does, and only for a view it has been told about — which
 * is also the one thing the bare `mountRoot` harness cannot model, and the reason this file
 * exists beside `assetLibraryRoot.test.ts` rather than inside it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ok } from '../../../src/core/result/Result';
import type { AssetLibraryView } from '../../../src/presentation/library/AssetLibraryView';
import { unavailableAssetLibraryQueries } from '../../../src/presentation/read-models/assetLibraryQueries';
import type { AssetLibraryQueryServices } from '../../../src/presentation/read-models/assetLibraryQueries';
import { createAssetId } from '../../../src/domain/asset/AssetId';
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

function answering(): AssetLibraryQueryServices {
	return {
		...unavailableAssetLibraryQueries(),
		listCatalogue: () => Promise.resolve(ok({ entries: [ALDER, SOFA], unreadable: [] })),
	};
}

async function openLibrary(): Promise<{ view: AssetLibraryView; leaf: FakeLeaf }> {
	const leaf = new FakeLeaf();
	const view = makeAssetLibraryView(defaultAssetLibraryDeps({ queries: answering() }), leaf);
	openViews.push(view);
	// Obsidian sets this after calling a registered factory; `FakeLeaf` says so in its own
	// header and never sets it itself, which is what leaves the round trip un-modelled without
	// this line.
	leaf.view = view;
	await view.onOpen();
	await settle();
	return { view, leaf };
}

const shell = (view: AssetLibraryView): HTMLElement => {
	const el = view.contentEl.querySelector('.renovation-asset-library');
	if (el === null) throw new Error('the library did not mount');
	return el as HTMLElement;
};

const click = async (view: AssetLibraryView, selector: string): Promise<void> => {
	shell(view).querySelector<HTMLElement>(selector)?.click();
	await settle();
};

describe('a gesture made in this session reaches Obsidian\'s view state', () => {
	/** The headline: Task 13's own recorded gap, closed. */
	it('carries a row click into getState', async () => {
		const { view } = await openLibrary();
		expect(view.getState().assetId).toBe('');

		await click(view, `[data-asset-id="${ALDER.assetId}"]`);

		expect(view.getState().assetId).toBe(ALDER.assetId);
	});

	/**
	 * The expansion half, which is the one a build could forget while the selection worked:
	 * `publishViewState` takes BOTH values on every call precisely so a toggle cannot publish a
	 * selection and leave the expanded set behind.
	 */
	it('carries a shelf toggle into getState, with the selection beside it', async () => {
		const { view } = await openLibrary();

		await click(view, 'button.rp-al-shelf__head');
		await click(view, `[data-asset-id="${ALDER.assetId}"]`);

		expect(view.getState()).toEqual({ assetId: ALDER.assetId, expanded: ['material'] });
	});

	/** And `Back to library` publishes the DESELECTION rather than only redrawing one. */
	it('preserves selection when returning to the list', async () => {
		const { view } = await openLibrary();
		await click(view, 'button.rp-al-shelf__head');
		await click(view, `[data-asset-id="${ALDER.assetId}"]`);

		await click(view, '.rp-al-inspector__back');

		expect(view.getState().assetId).toBe(ALDER.assetId);
	});

	/**
	 * The round trip really is Obsidian's, not a direct write dressed up as one: the state the
	 * leaf was asked to record is the state the view reports, under this view's own type.
	 */
	it('asks the leaf to record the state it reports', async () => {
		const { view, leaf } = await openLibrary();

		await click(view, `[data-asset-id="${ALDER.assetId}"]`);

		expect(leaf.state?.type).toBe(view.getViewType());
		expect(leaf.state?.state).toEqual(view.getState());
	});
});

describe('the publish does not fight the watch it wakes', () => {
	/**
	 * **The re-entrancy the brief names, ASSERTED rather than assumed.** `AssetLibraryRoot`
	 * watches `context.assetId` and assigns `selectedId` from it, so publishing on select makes
	 * that watch fire with the value it already holds. A publish that re-entered would be an
	 * infinite loop no type can see, and the mechanism that stops it is ordering: the view
	 * writes its refs BEFORE the round trip, so `setState` assigns them their own values and a
	 * ref assigned its own value triggers nothing.
	 *
	 * Counted at `setViewState`, which is the one place a second lap would have to show up —
	 * a loop through the watch would publish again, and again.
	 */
	it('publishes exactly once per gesture', async () => {
		const { view, leaf } = await openLibrary();
		const asked = vi.spyOn(leaf, 'setViewState');

		await click(view, `[data-asset-id="${ALDER.assetId}"]`);

		expect(asked).toHaveBeenCalledTimes(1);
	});

	/**
	 * And the tree agrees with the state afterwards: the round trip's `setState` writes the same
	 * values back, so the marked row is still the clicked one rather than flickering off.
	 */
	it('leaves the clicked row marked after the round trip', async () => {
		const { view } = await openLibrary();

		await click(view, `[data-asset-id="${ALDER.assetId}"]`);

		expect(shell(view).getAttribute('data-selected-asset-id')).toBe(ALDER.assetId);
		expect(shell(view).querySelectorAll('.rp-al-row--on')).toHaveLength(1);
	});
});

describe('a settings save that replaces the composition root', () => {
	/**
	 * **The case the round-1 probe on Task 13 used**, and the one that would redden if a later
	 * author moved `assetIdRef`/`expandedRef` back inside `mount()`: a `rebind` REMOUNTS the
	 * tree, and a selection made in this session — never through `setState` — has to survive it.
	 * That is the `ProjectDetailState` lesson, and the reason those refs are the VIEW's own
	 * fields, constructed once.
	 */
	it('preserves a selection made before the rebind', async () => {
		const { view } = await openLibrary();
		await click(view, `[data-asset-id="${ALDER.assetId}"]`);

		view.rebind(defaultAssetLibraryDeps({ queries: answering() }));
		await settle();

		expect(view.getState().assetId).toBe(ALDER.assetId);
		expect(shell(view).querySelectorAll('.rp-al-row--on')).toHaveLength(1);
	});
});
