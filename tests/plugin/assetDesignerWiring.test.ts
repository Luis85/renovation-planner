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
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver } from '../helpers/layout';
import { loadedPlugin } from '../helpers/plugin';
import { expectOk } from '../helpers/domain';
import { makeAsset } from '../helpers/entities';
import { settle } from '../helpers/async';
import { FakeLeaf } from '../helpers/workspace';

installObsidianDom();
/**
 * The designer draws a Konva stage since Task B4, and this file mounts the REAL view through
 * the composed plugin: jsdom implements no 2D context and no `ResizeObserver`, and
 * `EditorSurface` constructs the second unconditionally at mount.
 */
installCanvas();
installResizeObserver();

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

	/**
	 * PR 43's idle-sheet finding, at the seam the composition root owns.
	 *
	 * `AssetDesignerDeps.onVaultFileChanged` is REQUIRED, so a root that passes nothing fails to
	 * build — and a root that passes a fresh no-op compiles, passes every other case here, and
	 * leaves the designer deaf to the file it is drawing. This drives Obsidian's own `delete`
	 * through the plugin's registered listeners, so what is asserted is the whole chain: the root's
	 * `createVaultFileChangeSource(app.vault)`, the deps member, the view's pass-through, the
	 * context, `DesignerCanvas`'s prop and the layer's filter. `designerBackground.test.ts` proves
	 * the designer's context member reaches the layer; only this proves the ROOT fills it.
	 *
	 * The observable is the missing-sheet notice, which is what the user sees. Registering a
	 * background at all takes a real `getResourcePath`, so this asserts on the notice the layer
	 * emits rather than on a raster this stub could never decode.
	 */
	it('tells an open designer that its spec sheet was deleted from the vault', async () => {
		const { stack, assetId } = await vaultWithOneAsset();
		const { plugin, workspace, triggerVault } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();
		// A sheet that IS there when the leaf opens, so the layer has something to lose.
		const sheet = 'Specs/oven.png';
		// The FOLDER first: `FakeVault.create` refuses a path whose parent does not exist, exactly
		// as Obsidian does — the fake-not-kinder rule this repository already paid 86 tests for.
		await stack.vault.createFolder('Specs');
		await stack.vault.create(sheet, 'not really a png');
		stack.metadataCache.catchUp();
		const loaded = expectOk(await stack.assets.getById(assetId));
		if (loaded === null) throw new Error('expected the seeded asset to be readable');
		expectOk(
			await stack.assets.save(
				expectOk(loaded.entity.withChanges({ background: { path: sheet, kind: 'image', page: null } })),
				loaded.version,
			),
		);
		stack.metadataCache.catchUp();
		const view = designerOn(plugin);
		await view.setState({ assetId }, {} as never);
		await view.onOpen();
		await settle();

		// The user deletes the sheet in Obsidian's file explorer. Nothing re-reads the asset.
		const file = stack.vault.getAbstractFileByPath(sheet);
		await stack.vault.delete(file as never);
		triggerVault('delete', file as never);
		await settle();

		expect(view.contentEl.textContent).toContain(t('en', 'designer.background-missing'));

		await view.onClose();
	});
});
