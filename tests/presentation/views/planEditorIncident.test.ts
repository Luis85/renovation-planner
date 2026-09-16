/**
 * @vitest-environment jsdom
 *
 * **Who owns an unrecovered-write incident, now that it is not the mount.**
 *
 * The incident is raised by `withSaveStateTracking` — the ONE caller of `markUnrecovered`,
 * `grep -rn "markUnrecovered(" src/` on 2026-09-16 printing that call and the store's own
 * definition and nothing else — when a refused dispatch `leftWritesBehind`. Every case below
 * that raises one raises it that way, through the leaf's real dispatcher with a command whose
 * refusal carries the real `markUncompensated` stamp, rather than by setting the store's
 * boolean: a case that pokes the flag proves the seeding and says nothing about whether the
 * seeding is wired to the thing production sets.
 *
 * `tests/plugin/rootSwapRebind.test.ts` owns the other half — the whole `saveSettings` path,
 * poking the store because its subject is the SWAP. Neither file holds the claim alone.
 *
 * **What no case here can see.** jsdom lays nothing out, so `sizedShellRoot` is what gives the
 * shell a pane width at all; nothing below grades appearance. And the incident's survival of
 * an Obsidian RESTART is a fact about Obsidian persisting `getState()`, which `FakeLeaf`
 * records rather than performs — the round-trip case below drives the two halves this
 * repository owns (what `getState` emits, what `setState` does with it) and stops there.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { err, isErr, ok } from '../../../src/core/result/Result';
import { markUncompensated, type DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import { PlanEditorView, type PlanEditorDeps } from '../../../src/presentation/views/PlanEditorView';
import { EDITOR_RUNTIME, type EditorRuntime } from '../../../src/presentation/editor/runtime';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import { withSaveStateTracking } from '../../../src/presentation/editor/save-state/with-save-state-tracking';
import type { BackgroundVault } from '../../../src/presentation/editor/layers/background/BackgroundRenderModel';
import { unavailablePlanEditorCommands } from '../../../src/presentation/editor/planEditorCommands';
import { createEditorClipboard } from '../../../src/presentation/editor/clipboard/editorClipboard';
import { memoryDeviceStorage } from '../../helpers/deviceStorage';
import { installEditorEnvironment, settle, sizedShellRoot } from '../../helpers/editor';
import { FIXTURE_PLAN, FIXTURE_ZONES, fakeQueries } from '../../helpers/planFixtures';
import { injectedPersistenceError } from '../../helpers/domain';
import { FakeLeaf } from '../../helpers/workspace';
import type { Pinia } from 'pinia';

installEditorEnvironment();

/** No-op subscription doors: no case here counts a listener, so none is counted. */
const noSubscription = () => () => undefined;

function deps(): PlanEditorDeps {
	return {
		queries: fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES),
		// Every write below is dispatched as an ad-hoc command through the leaf's own
		// dispatcher, so the command SERVICES are the refusal set: a case that reached one
		// would be asking this file's question of somebody else's command.
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

/**
 * Every view a case opened, closed automatically afterwards — `Konva.stages` is
 * process-global, so one case that forgets leaves a stage behind for every later one.
 */
const openViews: PlanEditorView[] = [];

afterEach(async () => {
	for (const view of openViews.splice(0)) await view.onClose();
	await settle();
});

async function opened(planId = FIXTURE_PLAN.id): Promise<PlanEditorView> {
	const view = new PlanEditorView(new FakeLeaf() as never, deps());
	openViews.push(view);
	await view.setState({ planId }, {} as never);
	await view.onOpen();
	await settle();
	sizedShellRoot(view.contentEl);
	await settle();
	return view;
}

/** `PlanEditorRoot`'s own instance is where `provide()` put the runtime — `planEditorView.test.ts`'s door. */
function runtimeOfView(view: PlanEditorView): EditorRuntime {
	const app = (view as unknown as { vueApp: { _instance: { provides: Record<symbol, unknown> } } | null }).vueApp;
	if (app === null) throw new Error('expected the view to have mounted a Vue app');
	const runtime = app._instance.provides[EDITOR_RUNTIME as unknown as symbol];
	if (runtime === undefined) throw new Error('expected the mounted tree to have provided an EditorRuntime');
	return runtime as EditorRuntime;
}

/** The same door `rootSwapRebind.test.ts` uses: Pinia's `install` leaves the instance here. */
function piniaOf(view: PlanEditorView): Pinia {
	return (view as unknown as { vueApp: { config: { globalProperties: { $pinia: Pinia } } } }).vueApp.config
		.globalProperties.$pinia;
}

/**
 * The real production route into an incident: a refusal STAMPED by `markUncompensated`, which
 * is what `leftWritesBehind` asks about and what `withSaveStateTracking` turns into
 * `markUnrecovered`. Nothing here sets the flag.
 */
async function failHalfWritten(view: PlanEditorView): Promise<void> {
	const result = await runtimeOfView(view).dispatcher.run({
		execute: () => Promise.resolve(err(markUncompensated(injectedPersistenceError()))),
		undo: () => Promise.resolve(ok('wrote')),
	});
	expect(isErr(result)).toBe(true);
	await settle();
}

/** A write that lands whole, dispatched the way any tool's would be. */
const wrote = (): Promise<DispatchResult> => Promise.resolve(ok('wrote'));

describe('an unrecovered-write incident belongs to the leaf, not to the mount', () => {
	it('raises the incident through the real dispatch path and keeps it across a settings rebind', async () => {
		const view = await opened();
		expect(runtimeOfView(view).writesBlocked.value).toBe(false);

		await failHalfWritten(view);
		expect(useSaveStateStore(piniaOf(view)).unrecoveredWrite).toBe(true);
		const before = piniaOf(view);

		view.rebind(deps());
		await settle();
		sizedShellRoot(view.contentEl);
		await settle();

		// A fresh Pinia — the remount is unchanged — carrying the incident the VIEW held.
		expect(piniaOf(view)).not.toBe(before);
		expect(useSaveStateStore(piniaOf(view)).unrecoveredWrite).toBe(true);
		expect(runtimeOfView(view).writesBlocked.value).toBe(true);
	});

	it('keeps the incident across two settings saves in a row', async () => {
		// Two rebinds, because the second one seeds from a field the FIRST one had to have
		// written back: a fix that seeded the new store and forgot to re-learn from it would
		// survive one save and lose the incident on the next.
		const view = await opened();
		await failHalfWritten(view);

		view.rebind(deps());
		await settle();
		view.rebind(deps());
		await settle();
		sizedShellRoot(view.contentEl);
		await settle();

		expect(useSaveStateStore(piniaOf(view)).unrecoveredWrite).toBe(true);
		expect(runtimeOfView(view).writesBlocked.value).toBe(true);
	});

	it('keeps the incident when the leaf closes and reopens on the same plan', async () => {
		// Obsidian keeps the leaf and REUSES the view (`onClose`'s own docblock), so this is
		// the close-and-reopen a user performs on a tab that stays in the layout. A leaf the
		// user DETACHES is a different thing, and the incident survives it only as far as the
		// view state Obsidian persisted — the round-trip case below is what that rests on.
		const view = await opened();
		await failHalfWritten(view);

		await view.onClose();
		await view.onOpen();
		await settle();
		sizedShellRoot(view.contentEl);
		await settle();

		expect(useSaveStateStore(piniaOf(view)).unrecoveredWrite).toBe(true);
		expect(runtimeOfView(view).writesBlocked.value).toBe(true);
	});

	it('refuses every later write through the leaf’s own dispatcher while the incident stands', async () => {
		const view = await opened();
		await failHalfWritten(view);
		const execute = vi.fn<() => Promise<DispatchResult>>(wrote);

		const result = await runtimeOfView(view).dispatcher.run({ execute, undo: wrote });

		// The gate, not the command: a write that never reached its `execute` is a write that
		// never reached the vault, which is what "affected writes stay blocked" means.
		expect(isErr(result)).toBe(true);
		expect(execute).not.toHaveBeenCalled();
	});

	/**
	 * **R1, at the new owner.** Only a write that actually succeeded may CLEAR a save error,
	 * and nothing clears this flag at all: `resolveOk` fires for any write that lands whole —
	 * an unrelated zone's edit, an undo — and this wrapper can see neither which rows the
	 * incident was about nor whether they are the ones just written. A stale warning is
	 * cheaper than a false all-clear. Asserted here as well as in `saveStateStore.test.ts`'s
	 * exhaustive walk because the VIEW is a second thing that could have cleared it and does
	 * not: it re-learns the flag from each mount and never unlearns it.
	 *
	 * Driven through `withSaveStateTracking` directly rather than through the leaf's own
	 * dispatcher, and the reason is the case above: while the incident stands the gate refuses
	 * the dispatch, so a successful write cannot reach the tracker through that door at all.
	 * This is the same wrapper over the same store, one layer in.
	 */
	it('keeps the incident when an unrelated write reports success through the same tracker', async () => {
		const view = await opened();
		await failHalfWritten(view);
		const save = useSaveStateStore(piniaOf(view));

		await withSaveStateTracking({ run: wrote, undo: wrote, redo: wrote }, save).run({ execute: wrote, undo: wrote });
		await settle();

		expect(save.state).toBe('saved');
		expect(save.unrecoveredWrite).toBe(true);
		view.rebind(deps());
		await settle();
		expect(useSaveStateStore(piniaOf(view)).unrecoveredWrite).toBe(true);
	});

	it('keeps the incident across a successful read', async () => {
		// Reading a half-written vault back does not mend it, so a refresh that succeeds is
		// not evidence of anything — the same rule the store states, asked of the leaf.
		const view = await opened();
		await failHalfWritten(view);

		await runtimeOfView(view).refreshProjection();
		await settle();

		expect(useSaveStateStore(piniaOf(view)).unrecoveredWrite).toBe(true);
		expect(runtimeOfView(view).writesBlocked.value).toBe(true);
	});

	it('leaves a leaf with no incident fully usable across a rebind', async () => {
		// The false-positive arm: nothing about carrying a flag may make an unaffected leaf
		// report one, and the leaf has to still WRITE rather than merely look clear.
		const view = await opened();

		view.rebind(deps());
		await settle();
		sizedShellRoot(view.contentEl);
		await settle();

		const execute = vi.fn<() => Promise<DispatchResult>>(wrote);
		const result = await runtimeOfView(view).dispatcher.run({ execute, undo: wrote });
		expect(isErr(result)).toBe(false);
		expect(execute).toHaveBeenCalledOnce();
		expect(useSaveStateStore(piniaOf(view)).unrecoveredWrite).toBe(false);
		expect(runtimeOfView(view).writesBlocked.value).toBe(false);
		expect(view.getState()).toEqual({ planId: FIXTURE_PLAN.id });
	});

	it('carries the incident in the view state, and no later setState clears it', async () => {
		const view = await opened();
		await failHalfWritten(view);

		// The key is absent until there is something to say, so a leaf with no incident keeps
		// the shape every other case in this repository asserts for `getState`.
		expect(view.getState()).toEqual({ planId: FIXTURE_PLAN.id, unrecoveredWrite: true });

		// `revealPlanEditor` sets `{ planId }` with no flag in it. On a leaf this one created
		// that is the first word; arriving at a leaf that has an incident it must not be an
		// all-clear.
		await view.setState({ planId: FIXTURE_PLAN.id }, {} as never);
		await settle();
		expect(view.getState()).toEqual({ planId: FIXTURE_PLAN.id, unrecoveredWrite: true });
		expect(useSaveStateStore(piniaOf(view)).unrecoveredWrite).toBe(true);
	});

	it('restores the incident from the view state a restored leaf arrives with', async () => {
		// The other half of the round trip, and the reason the flag is validated rather than
		// cast: the workspace layout is a file the user can edit and another version of this
		// plugin wrote, so only a literal `true` is an incident.
		const restored = new PlanEditorView(new FakeLeaf() as never, deps());
		openViews.push(restored);

		await restored.setState({ planId: FIXTURE_PLAN.id, unrecoveredWrite: true }, {} as never);
		await restored.onOpen();
		await settle();
		sizedShellRoot(restored.contentEl);
		await settle();

		expect(useSaveStateStore(piniaOf(restored)).unrecoveredWrite).toBe(true);
		expect(runtimeOfView(restored).writesBlocked.value).toBe(true);
	});

	it('reads anything but a literal true as no incident', async () => {
		const restored = new PlanEditorView(new FakeLeaf() as never, deps());
		openViews.push(restored);

		await restored.setState({ planId: FIXTURE_PLAN.id, unrecoveredWrite: 'true' }, {} as never);
		await restored.onOpen();
		await settle();
		sizedShellRoot(restored.contentEl);
		await settle();

		expect(restored.getState()).toEqual({ planId: FIXTURE_PLAN.id });
		expect(useSaveStateStore(piniaOf(restored)).unrecoveredWrite).toBe(false);
	});
});
