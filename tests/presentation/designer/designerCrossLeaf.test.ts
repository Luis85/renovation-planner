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
import Konva from 'konva';
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
import { connectedObservers, installResizeObserver } from '../../helpers/layout';
import { recorder } from '../../helpers/logger';
import { settle } from '../../helpers/async';
import { FakeLeaf } from '../../helpers/workspace';
import { unwiredPlanUsage } from '../../helpers/designerQueries';

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

/** How many open/close cycles the lifecycle case below drives; its docblock revises §6's fifty with evidence. */
const CYCLES = 10;

/** One bundle for every leaf in a case, so two leaves really do share one composed bus. */
function leafDeps(bus: ReturnType<typeof createEventBus>, reads: string[]): AssetDesignerDeps {
	return {
		queries: {
			getAssetDesign: (assetId) => {
				reads.push(assetId);
				return Promise.resolve(ok(assetDesign({ assetId: createAssetId() })));
			},
			listPlansUsingAsset: unwiredPlanUsage,
		},
		commands: unavailableAssetDesignerCommands(),
		logger: recorder,
		picker: null,
		// Empty: no case here reads a raster, and `assetDesign`'s own default reference names a
		// file no fixture wrote — so the layer answers `unavailable` and draws nothing, which is
		// exactly what a suite about the BUS wants the canvas to be doing.
		vault: emptyBackgroundVault(),
		onDesignChanged: createAssetDesignChangeSource(bus),
		onThemeChange: () => () => undefined,
		// A source that never fires, rather than one omitted: the member is required precisely so
		// no surface can forget to answer the question, and this suite's cases are not about a file
		// moving under the surface. `backgroundInEditor.test.ts` is where that door is driven.
		onVaultFileChanged: () => () => undefined,
		indexScanCompleted: () => true,
	};
}

/**
 * At MODULE scope rather than inside the first `describe`, since the lifecycle block below opens
 * leaves the same way and a rig reachable from one block only is the reason the next block builds
 * a second one. `onClose` is idempotent, so a case that closes its own leaves is closed twice and
 * neither call is wasted — the existing closed-leaf cases already relied on that.
 */
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

describe('two designer leaves and one bus', () => {
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

/**
 * ONE leaf, opened and closed over and over — its own block because every case above needs two
 * leaves at once and this one needs exactly one, and a case read at its `describe` is how this
 * package misread AD15's T07 for a whole round.
 *
 * `scene.test.ts`'s `the editor own lifecycle` is the same subject for the plan editor, and this
 * block deliberately takes its case name and its idiom rather than inventing a second spelling.
 */
describe('the designer’s own lifecycle', () => {
	/**
	 * **What §6 asks for, quoted rather than paraphrased**: *"No monotonic retained-listener/
	 * observer growth"*, over *"50 repeated open/close cycles after warm-up"*. Listeners and
	 * observers, which are both countable here — so all three resources this view acquires are
	 * asserted, none of them waived:
	 *
	 * - the bus's SUBSCRIPTIONS, through the vault read a still-subscribed closed leaf would
	 *   issue. Asserted on the query and never on a disposer having run, for the reason the block
	 *   above states: a disposer that unsubscribes nothing satisfies the second and leaves the
	 *   defect standing.
	 * - `Konva.stages`, the module-level registry a mounted stage joins and a destroyed one
	 *   leaves.
	 * - `connectedObservers()`, the `ResizeObserver` count — `EditorSurface` constructs one at
	 *   mount unconditionally and disconnects it at unmount, and `tests/helpers/layout.ts` calls
	 *   that count "the leak check for a repeated mount" in as many words.
	 *
	 * **What is measured is a COUNT, not a heap**, and that is the honest limit rather than a
	 * reason to drop a metric: nothing here can see a detached DOM subtree still referenced, a
	 * closure retained by a timer, or bytes. §6 names listeners and observers, which is exactly
	 * what is counted; it does not name bytes, and an earlier revision of this docblock said it
	 * did — corrected against the table itself.
	 *
	 * **Ten cycles rather than fifty, revised with evidence** as §6's own preamble asks. A
	 * per-cycle leak is linear in the cycles, so ten discriminates it exactly as fifty would; ten
	 * costs ~0.7 s of a 5 s case budget on this machine and fifty would spend most of that budget
	 * on a slower leg for no extra discrimination. The three assertions are what §6 asks for; only
	 * the cycle count is revised. (`scene.test.ts`'s equivalent runs three.)
	 *
	 * **The deltas are against this FILE's siblings, not against the scheduler.** The `suite`
	 * project is per-file isolated, so an absolute zero would work today — `scene.test.ts` uses
	 * one. It is a delta because the cases ABOVE run first in this same file and a leak of theirs
	 * would otherwise be charged here: watch 4's mutation made that concrete, reddening this case
	 * `expected 17 to be 7` where the seven were the earlier cases' own leaked stages. CLAUDE.md's
	 * `--no-isolate` warning names `Konva.stages` and names case titles of exactly this shape; the
	 * delta is also what would keep this honest if that isolation ever changed.
	 *
	 * **The in-loop expectations are the found-something-at-all half.** Without them a rig that
	 * stopped mounting a canvas — or a `ResizeObserver` fake that stopped registering — would make
	 * every assertion below a comparison of zero against zero, green and vacuous.
	 * `scene.test.ts:the editor own lifecycle` pins `stagesBefore + 1` while mounted for the same
	 * reason.
	 *
	 * Watched failing under two mutations, each reaching a different arm:
	 *
	 * - `AssetDesignerView.unmount` skipping `this.vueApp?.unmount()` after the first close →
	 *   twenty leaked reads here, and two in each of the two closed-leaf cases above. So the
	 *   subscription arm is NOT this case's alone; what repetition adds is that the leak
	 *   ACCUMULATES, which one cycle cannot tell from a fixed cost.
	 * - a stage built imperatively in `DesignerCanvas` and never destroyed → `expected 17 to be
	 *   7`, this case alone. Other designer suites SELECT a stage (`Konva.stages.at(-1)`); this is
	 *   the only one under `tests/presentation/designer/` that COUNTS them, which is why the
	 *   mutation reached nothing else there.
	 */
	it('stacks nothing across repeated open and close cycles', async () => {
		const bus = createEventBus(() => undefined);
		const reads: string[] = [];
		const bundle = leafDeps(bus, reads);
		const stagesBefore = Konva.stages.length;
		const observersBefore = connectedObservers();

		for (let cycle = 0; cycle < CYCLES; cycle++) {
			const view = await open(bundle, THE_ASSET);
			// This rig really does acquire both, so neither delta below can pass by measuring nothing.
			expect(Konva.stages.length).toBe(stagesBefore + 1);
			expect(connectedObservers()).toBe(observersBefore + 1);
			await view.onClose();
		}
		await settle();
		reads.length = 0;

		await bus.publish(assetDesignChanged({ assetId: THE_ASSET }));
		await bus.publish(projectIndexRebuilt());
		await settle();

		expect(reads).toEqual([]);
		expect(Konva.stages.length).toBe(stagesBefore);
		expect(connectedObservers()).toBe(observersBefore);
	});
});
