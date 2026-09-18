/**
 * @vitest-environment jsdom
 *
 * **A settings rebind does not hand a Plan Editor its write doors back.** Lifecycle contract
 * rule 3 (`docs/releases/first-beta-readiness/04-lifecycle-contract.md`), row F2.
 *
 * `rebind()` is `unmount(); sync()` with a fresh `createPinia()`, so an active stale read-back
 * refusal is destroyed with the store that held it, and the fresh hydrate cannot re-derive it:
 * `handleFailedRead` sets `stale` only while `status === 'ready'`, and a fresh store starts
 * `'idle'`, so the identical refusing read routes to `fail()` instead. Both terminal states are
 * safe — a failure screen, or a legitimately current canvas. What was NOT safe was the transit
 * between them, one whole vault read wide, and this file pins it shut.
 *
 * What it asserts: `writesBlocked` is true from the rebind until the fresh read makes the canvas
 * current again, a command dispatched into the window is REFUSED rather than executed, and the
 * one user-reachable write door open in that window — the reference/background control, the Add
 * menu and the canvas being absent — stays `aria-disabled` across it.
 *
 * What it does NOT assert: anything about Obsidian. `FakeLeaf` records asks rather than behaving,
 * and `view.rebind(deps())` stands in for the `saveSettings` chain that calls it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { err, isErr, ok } from '../../../src/core/result/Result';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import { PlanEditorView, type PlanEditorDeps } from '../../../src/presentation/views/PlanEditorView';
import { EDITOR_RUNTIME, type EditorRuntime } from '../../../src/presentation/editor/runtime';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import type { BackgroundVault } from '../../../src/presentation/editor/layers/background/BackgroundRenderModel';
import { unavailablePlanEditorCommands } from '../../../src/presentation/editor/planEditorCommands';
import { createEditorClipboard } from '../../../src/presentation/editor/clipboard/editorClipboard';
import { memoryDeviceStorage } from '../../helpers/deviceStorage';
import { installEditorEnvironment, settle, sizedShellRoot } from '../../helpers/editor';
import { FIXTURE_PLAN, FIXTURE_ZONES, fakeQueries } from '../../helpers/planFixtures';
import { injectedPersistenceError } from '../../helpers/domain';
import { FakeLeaf } from '../../helpers/workspace';
import { installQuietWriteIncidents } from '../../helpers/writeIncidents';
import type { PlanEditorQueryServices } from '../../../src/presentation/read-models/planEditorQueries';
import type { Pinia } from 'pinia';

installEditorEnvironment();

const noSubscription = () => () => undefined;

/** One refusal switch shared by every `deps()` a case builds, so the vault is still refusing at rebind time. */
let failing = false;

function flakyQueries(): PlanEditorQueryServices {
	const base = fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES);
	return { ...base, getPlan: (planId) => (failing ? Promise.resolve(err(injectedPersistenceError())) : base.getPlan(planId)) };
}

function deps(): PlanEditorDeps {
	return {
		queries: flakyQueries(),
		commands: unavailablePlanEditorCommands(),
		openNote: vi.fn<(entityId: string) => Promise<'opened' | 'missing' | 'failed'>>().mockResolvedValue('opened'),
		vault: {
			getAbstractFileByPath: () => null,
			getResourcePath: () => '',
			readBinary: () => Promise.resolve(new ArrayBuffer(0)),
		} as unknown as BackgroundVault,
		clipboard: createEditorClipboard(),
		panelLayout: memoryDeviceStorage(),
		onThemeChange: noSubscription,
		onPlanChanged: noSubscription,
		onProjectPlansChanged: noSubscription,
		onCatalogueChanged: noSubscription,
		onProjectPricesChanged: noSubscription,
		onRequirementFiguresChanged: noSubscription,
		onVaultFileChanged: noSubscription,
	};
}

const openViews: PlanEditorView[] = [];

afterEach(async () => {
	for (const view of openViews.splice(0)) await view.onClose();
	await settle();
	failing = false;
});

async function opened(): Promise<PlanEditorView> {
	const view = new PlanEditorView(new FakeLeaf() as never, deps());
	openViews.push(view);
	await view.setState({ planId: FIXTURE_PLAN.id }, {} as never);
	await view.onOpen();
	await settle();
	sizedShellRoot(view.contentEl);
	await settle();
	return view;
}

function runtimeOfView(view: PlanEditorView): EditorRuntime {
	const app = (view as unknown as { vueApp: { _instance: { provides: Record<symbol, unknown> } } | null }).vueApp;
	if (app === null) throw new Error('expected the view to have mounted a Vue app');
	return app._instance.provides[EDITOR_RUNTIME as unknown as symbol] as EditorRuntime;
}

function piniaOf(view: PlanEditorView): Pinia {
	return (view as unknown as { vueApp: { config: { globalProperties: { $pinia: Pinia } } } }).vueApp.config
		.globalProperties.$pinia;
}

/** `writesBlocked` beside the two store fields that decide it, read through the live view. */
function reading(view: PlanEditorView): { blocked: boolean; stale: boolean; status: string } {
	const store = useProjectStore(piniaOf(view));
	return { blocked: runtimeOfView(view).writesBlocked.value, stale: store.stale, status: store.status };
}

const referenceDisabled = (view: PlanEditorView): string | null | undefined =>
	view.contentEl.querySelector('[data-rp-action="reference"]')?.getAttribute('aria-disabled');

const wrote = (): Promise<DispatchResult> => Promise.resolve(ok('wrote'));

describe('Plan Editor write refusal across a settings rebind', () => {
	it('keeps refusing from the rebind until the fresh read makes the canvas current again', async () => {
		installQuietWriteIncidents();
		const view = await opened();
		expect(reading(view)).toEqual({ blocked: false, stale: false, status: 'ready' });

		// A write that LANDS, whose read-back then refuses: the production route into `stale`.
		failing = true;
		await runtimeOfView(view).dispatcher.run({ execute: wrote, undo: wrote });
		await settle();
		const stale = reading(view);

		// The settings rebind, on the leaf, while the refusal stands. The fresh Pinia loses
		// `stale` — nothing here pretends otherwise; the refusal has to come from elsewhere.
		view.rebind(deps());
		const remounted = reading(view);

		// The fresh mount's hydrate, allowed to complete against a vault that still refuses.
		await settle();
		sizedShellRoot(view.contentEl);
		await settle();
		const hydrated = reading(view);

		// And the same again with the vault healed, which is what legitimately retires it.
		failing = false;
		await runtimeOfView(view).refreshProjection();
		await settle();
		const healed = reading(view);

		expect([stale.blocked, remounted.blocked, hydrated.blocked, healed.blocked]).toEqual([true, true, true, false]);
		// `stale` is gone from the rebind onwards and never comes back: the refusal that holds
		// readings two and three is the status, not a surviving flag.
		expect([stale.stale, remounted.stale, hydrated.stale, healed.stale]).toEqual([true, false, false, false]);
		expect([stale.status, remounted.status, hydrated.status, healed.status]).toEqual(['ready', 'idle', 'failed', 'ready']);
	});

	it('refuses a command dispatched into the window between the remount and the fresh hydrate', async () => {
		installQuietWriteIncidents();
		const view = await opened();

		failing = true;
		await runtimeOfView(view).dispatcher.run({ execute: wrote, undo: wrote });
		await settle();
		expect(reading(view)).toEqual({ blocked: true, stale: true, status: 'ready' });
		const whileStale = referenceDisabled(view);

		// The fresh mount's `getPlan` never settles until this case says so, so the window is
		// as wide as a slow vault would make it.
		let release!: () => void;
		const held = new Promise<void>((resolve) => { release = resolve; });
		const heldDeps: PlanEditorDeps = {
			...deps(),
			queries: { ...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES), getPlan: async (planId) => { await held; return ok(FIXTURE_PLAN.id === planId ? FIXTURE_PLAN : null); } },
		};

		view.rebind(heldDeps);
		await settle();
		sizedShellRoot(view.contentEl);
		await settle();
		const inWindow = reading(view);

		// A write dispatched into the window, the way a tool dispatches one: detached, because
		// an UNREFUSED one never settles here — its post-command refresh queues behind the held
		// read — and `await` would report that as an anonymous case timeout instead of as the
		// two assertions below, which say what actually went wrong.
		const landed = vi.fn<() => Promise<DispatchResult>>(wrote);
		let refused = false;
		void runtimeOfView(view).dispatcher.run({ execute: landed, undo: wrote }).then((outcome) => { refused = isErr(outcome); return outcome; });
		await settle();
		const inWindowReference = referenceDisabled(view);

		release();
		await settle();
		const after = reading(view);

		expect([inWindow.blocked, inWindow.status]).toEqual([true, 'loading']);
		// Refused, not merely un-awaited: the dispatch settled, and it settled to an error.
		expect([landed.mock.calls.length, refused]).toEqual([0, true]);
		// The reference control is the one user-reachable write door the window leaves drawn —
		// the Add menu, the canvas and the selection are all absent — and it does not change state.
		expect([whileStale, inWindowReference]).toEqual(['true', 'true']);
		expect([after.blocked, after.status]).toEqual([false, 'ready']);
	}, 20000);
});
