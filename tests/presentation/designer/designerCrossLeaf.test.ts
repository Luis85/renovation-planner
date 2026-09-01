/**
 * @vitest-environment jsdom
 *
 * Task B3a's cross-leaf half: two designer leaves, one bus, and what survives a leaf closing.
 *
 * Driven through the REAL view lifecycle and a REAL bus, because that is what the section is
 * about — a component harness would let the disposal be tested against a fake that never
 * registered anything, and a `RecordingEventBus` would deliver nothing to either leaf.
 *
 * **Its own file since the background render landed**, split out of `designerRefresh.test.ts`
 * rather than squeezed back under that file's 450-line cap: this repository's own rule is that
 * a budget bought back by reformatting is a budget already spent, and the answer is an
 * extraction. The seam is a real one — everything left in `designerRefresh.test.ts` mounts a
 * bare component around `provideDesignerRuntime` and is about the dispatcher, the store and
 * the ticket, while every case here constructs `AssetDesignerView` and asks what the BUS
 * delivered.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { ok } from '../../../src/core/result/Result';
import { createEventBus } from '../../../src/core/events/EventBus';
import { createAssetDesignChangeSource } from '../../../src/application/events/assetDesignChangeSource';
import { assetDesignChanged } from '../../../src/domain/asset/Asset.events';
import { projectIndexRebuilt } from '../../../src/application/events/projectIndex.events';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import type { AssetDesignerDeps } from '../../../src/presentation/designer/AssetDesignerContext';
import { AssetDesignerView } from '../../../src/presentation/designer/AssetDesignerView';
import { unavailableAssetDesignerCommands } from '../../../src/presentation/designer/designerCommands';
import { assetDesign } from '../../helpers/assetDesign';
import { emptyBackgroundVault } from '../../helpers/background';
import { installCanvas } from '../../helpers/canvas';
import { installObsidianDom } from '../../helpers/dom';
import { installResizeObserver } from '../../helpers/layout';
import { recorder } from '../../helpers/logger';
import { settle } from '../../helpers/async';
import { FakeLeaf } from '../../helpers/workspace';

installObsidianDom();
/**
 * The leaves below are REAL views, so each mounts a Konva stage: jsdom implements no 2D
 * context and no `ResizeObserver`, and `EditorSurface` constructs the second unconditionally
 * at mount.
 */
installCanvas();
installResizeObserver();

const THE_ASSET = createAssetId();
const OTHER_ASSET = createAssetId();

/** One bundle for every leaf in a case, so two leaves really do share one composed bus. */
function leafDeps(bus: ReturnType<typeof createEventBus>, reads: string[]): AssetDesignerDeps {
	return {
		queries: {
			getAssetDesign: (assetId) => {
				reads.push(assetId);
				return Promise.resolve(ok(assetDesign({ assetId: createAssetId() })));
			},
		},
		commands: unavailableAssetDesignerCommands(),
		logger: recorder,
		picker: null,
		// Empty: no case here reads a raster, and `assetDesign`'s own default reference names a
		// file no fixture wrote — so the layer answers `unavailable` and draws nothing, which is
		// exactly what a suite about the BUS wants the canvas to be doing.
		vault: emptyBackgroundVault(),
		onDesignChanged: createAssetDesignChangeSource(bus),
		indexScanCompleted: () => true,
	};
}

describe('two designer leaves and one bus', () => {
	const openViews: AssetDesignerView[] = [];

	async function open(bundle: AssetDesignerDeps, assetId: string): Promise<AssetDesignerView> {
		const view = new AssetDesignerView(new FakeLeaf() as never, bundle);
		openViews.push(view);
		await view.setState({ assetId }, {} as never);
		await view.onOpen();
		await settle();
		return view;
	}

	afterEach(async () => {
		for (const view of openViews.splice(0)) await view.onClose();
		await settle();
	});

	/**
	 * A change reaches every leaf showing that asset, not only the one that dispatched: the
	 * refresh decorator covers the dispatching leaf alone, which is every leaf right up until
	 * something else writes — a split pane on the same asset, or a synced note.
	 *
	 * ONE event for every command, so this holds for `SetAssetHeight` — which changes a field
	 * the designer draws and touches no geometry — exactly as it does for a footprint edit.
	 */
	it('refreshes a second leaf on the same asset', async () => {
		const bus = createEventBus(() => undefined);
		const reads: string[] = [];
		const bundle = leafDeps(bus, reads);
		await open(bundle, THE_ASSET);
		await open(bundle, THE_ASSET);
		reads.length = 0;

		await bus.publish(assetDesignChanged({ assetId: THE_ASSET }));
		await settle();

		expect(reads).toEqual([THE_ASSET, THE_ASSET]);
	});

	/** And a leaf on a different asset pays nothing, which is what makes one event per command affordable. */
	it('leaves a leaf on a different asset alone', async () => {
		const bus = createEventBus(() => undefined);
		const reads: string[] = [];
		const bundle = leafDeps(bus, reads);
		await open(bundle, THE_ASSET);
		await open(bundle, OTHER_ASSET);
		reads.length = 0;

		await bus.publish(assetDesignChanged({ assetId: THE_ASSET }));
		await settle();

		expect(reads).toEqual([THE_ASSET]);
	});

	/**
	 * **A CLOSED leaf is not refreshed** — asserted on the query, never on a disposer having
	 * been called, because a disposer that unsubscribes nothing satisfies the second and leaves
	 * the defect standing.
	 *
	 * The bus is the composition root's and outlives every leaf; `EventBus.subscribe` removes a
	 * handler on `dispose` and by no other mechanism. So an undisposed subscription keeps the
	 * closed leaf's whole Pinia store reachable from the root for the rest of the session and
	 * issues a vault read from it on every later design edit — one more per designer the user
	 * has ever opened.
	 */
	it('does not refresh a leaf that has been closed', async () => {
		const bus = createEventBus(() => undefined);
		const reads: string[] = [];
		const bundle = leafDeps(bus, reads);
		const closing = await open(bundle, THE_ASSET);
		await open(bundle, THE_ASSET);
		await closing.onClose();
		reads.length = 0;

		await bus.publish(assetDesignChanged({ assetId: THE_ASSET }));
		await settle();

		expect(reads).toEqual([THE_ASSET]);
	});

	/**
	 * Closing every leaf leaves the bus with nothing at all to deliver to — the same assertion
	 * one step further, and the one that discriminates a disposer releasing only the FIRST of
	 * this source's three arms.
	 */
	it('leaves nothing subscribed once every leaf is closed', async () => {
		const bus = createEventBus(() => undefined);
		const reads: string[] = [];
		const bundle = leafDeps(bus, reads);
		const view = await open(bundle, THE_ASSET);
		await view.onClose();
		reads.length = 0;

		await bus.publish(assetDesignChanged({ assetId: THE_ASSET }));
		await bus.publish(projectIndexRebuilt());
		await settle();

		expect(reads).toEqual([]);
	});
});
