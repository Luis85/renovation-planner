/**
 * @vitest-environment jsdom
 *
 * That the COMPOSED plugin gives a designer leaf the root's own event bus and the plugin's own
 * index-scan flag — the restored-leaf sequence, end to end.
 *
 * The same shape as `slice10CascadeWiring.test.ts` and `libraryOverlapWiring.test.ts`, and it
 * exists for the reason those do: a composition that hands over a FRESH `createEventBus()`
 * compiles, passes every unit test in `tests/presentation/designer`, and announces into an
 * object nothing has subscribed to. The compiler owns "a bus was passed"; only a case that
 * publishes on the ROOT's bus and watches a leaf react owns "the right one".
 *
 * **The sequence, not the subscription.** A case asserting a handler was registered is
 * satisfied by a handler wired to nothing. So the leaf is opened BEFORE `layoutReady()` — which
 * is where Obsidian really puts it, since it restores its leaves before the workspace is ready
 * and the index scan runs from `onLayoutReady` — and what is asserted is what the pane DRAWS,
 * first while the index is empty and then once the scan has landed.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { ASSET_DESIGNER_VIEW, AssetDesignerView } from '../../src/presentation/designer/AssetDesignerView';
import { assetDesignChanged } from '../../src/domain/asset/Asset.events';
import { createAssetId, type AssetId } from '../../src/domain/asset/AssetId';
import { t } from '../../src/presentation/i18n/strings';
import { createRepositoryStack, type RepositoryStack } from '../helpers/vault';
import { installObsidianDom } from '../helpers/dom';
import { loadedPlugin } from '../helpers/plugin';
import { expectOk } from '../helpers/domain';
import { makeAsset } from '../helpers/entities';
import { settle } from '../helpers/async';
import { FakeLeaf } from '../helpers/workspace';

installObsidianDom();

/** One catalogue note in the configured library folder, and nothing else. */
async function vaultWithOneAsset(): Promise<{ stack: RepositoryStack; assetId: AssetId }> {
	const stack = createRepositoryStack(DEFAULT_SETTINGS.projectFolder, DEFAULT_SETTINGS.libraryFolder);
	const assetId = createAssetId();
	expectOk(await stack.assets.save(makeAsset({ id: assetId, name: 'Base cabinet 600' }), 'absent'));
	stack.metadataCache.catchUp();
	return { stack, assetId };
}

/**
 * The view built by the PLUGIN's own registered factory, so the deps under test are the ones
 * the plugin assembles rather than any this file could spell. `instanceof` rather than a cast:
 * the factory's declared return is the base `View`, and narrowing by the real class is what
 * makes the members below type-check honestly.
 */
function designerOn(plugin: { views: Map<string, (leaf: never) => unknown> }): AssetDesignerView {
	const built = plugin.views.get(ASSET_DESIGNER_VIEW)?.(new FakeLeaf() as never);
	if (!(built instanceof AssetDesignerView)) {
		throw new Error('expected the plugin to register an asset designer view');
	}
	return built;
}

describe('a designer leaf restored by the composed plugin', () => {
	/**
	 * The whole sequence. Before the scan the index is empty, so `GetAssetDesign` refuses with
	 * `asset.not-found` about a note sitting on disk — and the leaf holds its loading line
	 * rather than flashing a failure it is about to retract. The rebuild `startPersistence`
	 * publishes is what re-reads.
	 *
	 * Both halves in one case, because they are one behaviour: a build that only held the line
	 * never draws, and a build that only recovered shows a false failure screen on every restore.
	 */
	it('holds its loading line against an empty index, then draws the asset once the scan lands', async () => {
		const { stack, assetId } = await vaultWithOneAsset();
		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		const view = designerOn(plugin);

		await view.setState({ assetId }, {} as never);
		await view.onOpen();
		await settle();

		expect(view.contentEl.querySelector('.rp-view-failure')).toBeNull();
		expect(view.contentEl.textContent).toContain(t('en', 'designer.loading'));

		workspace.layoutReady();
		await settle();

		expect(view.contentEl.querySelector('.rp-view-failure')).toBeNull();
		expect(view.contentEl.textContent).not.toContain(t('en', 'designer.loading'));

		await view.onClose();
	});

	/**
	 * And the design-change arm reaches the leaf on the ROOT's bus. Asserted through a read that
	 * ANSWERS DIFFERENTLY — the asset is deleted between the two reads — because "a handler was
	 * registered" is exactly what a subscription wired to a fresh bus also satisfies. The delete
	 * stands for what a peer leaf's write, or a synced note, does to this one; the SHELL draws no
	 * asset name today (Task B8's inspector is what will), so a failure the read did not report
	 * a moment ago is the observable this surface actually has.
	 */
	it('re-reads on a design change published by the root', async () => {
		const { stack, assetId } = await vaultWithOneAsset();
		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();
		const view = designerOn(plugin);
		await view.setState({ assetId }, {} as never);
		await view.onOpen();
		await settle();
		expect(view.contentEl.querySelector('.rp-view-failure')).toBeNull();

		const loaded = expectOk(await stack.assets.getById(assetId));
		if (loaded === null) throw new Error('expected the seeded asset to be readable');
		expectOk(await stack.assets.delete(assetId, loaded.version));
		stack.metadataCache.catchUp();
		await plugin.root.eventBus.publish(assetDesignChanged({ assetId }));
		await settle();

		expect(view.contentEl.querySelector('.rp-view-failure')).not.toBeNull();

		await view.onClose();
	});
});
