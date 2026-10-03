/**
 * @vitest-environment jsdom
 *
 * **Owner ruling 72: the standing warning names the ROOM a half-written room write left behind.**
 * "Make the standing warning show the specific sentence naming the room's note … it falls back to
 * the generic sentence when a tab is restored. No new notice, no double report."
 *
 * Driven at the VIEW, because the claim spans three owners: `withSaveStateTracking` hands the
 * stamped refusal to the store, `editorWarnings` picks the sentence and the door, and
 * `PlanEditorView` binds that door to `deps.openNote`. The refusal is the one
 * `ObsidianZoneRepository.compensateFailedSidecarWrite` stamps — its code and its `[zone, plan]`
 * entities, which `errorPaths.test.ts` pins at the repository — dispatched through the leaf's own
 * dispatcher, so nothing here sets the store by hand.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pinia } from 'pinia';
import { err, ok } from '../../../src/core/result/Result';
import { markUncompensated } from '../../../src/application/commands/DispatchOutcome';
import { persistenceError } from '../../../src/application/errors';
import { PlanEditorView, type PlanEditorDeps } from '../../../src/presentation/views/PlanEditorView';
import { EDITOR_RUNTIME, type EditorRuntime } from '../../../src/presentation/editor/runtime';
import type { UndoableCommand } from '../../../src/presentation/editor/tools/undoable-command';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import type { BackgroundVault } from '../../../src/presentation/editor/layers/background/BackgroundRenderModel';
import { unavailablePlanEditorCommands } from '../../../src/presentation/editor/planEditorCommands';
import { createEditorClipboard } from '../../../src/presentation/editor/clipboard/editorClipboard';
import { t } from '../../../src/presentation/i18n/strings';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { memoryDeviceStorage } from '../../helpers/deviceStorage';
import { installEditorEnvironment, settle, sizedShellRoot } from '../../helpers/editor';
import { FIXTURE_PLAN, FIXTURE_ZONES, fakeQueries } from '../../helpers/planFixtures';
// Mock-only surface, imported BY NAME, as `planEditorView.test.ts` does.
import { Notice } from '../../helpers/obsidian-mock';
import { FakeLeaf } from '../../helpers/workspace';

installEditorEnvironment();

const ROOM = FIXTURE_ZONES[0].id;
const noSubscription = () => () => undefined;
type Outcome = 'opened' | 'missing' | 'failed';

function deps(openNote: (entityId: string) => Promise<Outcome>): PlanEditorDeps {
	return {
		queries: fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES),
		commands: unavailablePlanEditorCommands(),
		openDiagnosticsReport: () => undefined,
		openNote,
		vault: { getAbstractFileByPath: () => null, getResourcePath: () => '', readBinary: () => Promise.resolve(new ArrayBuffer(0)) } as unknown as BackgroundVault,
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
// Activated, or a notice would never reach `Notice.shown` and "no notice" would hold vacuously —
// the `missing` case below is what proves this instrument sees one.
beforeEach(() => {
	activateNotices();
});
afterEach(async () => {
	for (const view of openViews.splice(0)) await view.onClose();
	await settle();
});

async function opened(state: Record<string, unknown>, openNote = vi.fn<(entityId: string) => Promise<Outcome>>().mockResolvedValue('opened')) {
	const view = new PlanEditorView(new FakeLeaf() as never, deps(openNote));
	openViews.push(view);
	await view.setState({ planId: FIXTURE_PLAN.id, ...state }, {} as never);
	await view.onOpen();
	await settle();
	sizedShellRoot(view.contentEl);
	await settle();
	return { view, openNote };
}

function runtimeOfView(view: PlanEditorView): EditorRuntime {
	const app = (view as unknown as { vueApp: { _instance: { provides: Record<symbol, unknown> } } }).vueApp;
	return app._instance.provides[EDITOR_RUNTIME as unknown as symbol] as EditorRuntime;
}

const piniaOf = (view: PlanEditorView): Pinia =>
	(view as unknown as { vueApp: { config: { globalProperties: { $pinia: Pinia } } } }).vueApp.config.globalProperties.$pinia;

const stampedRoom = (code: string, room: string) =>
	markUncompensated(persistenceError(code, 'injected'), [
		{ entityKind: 'zone', entityId: room },
		{ entityKind: 'plan', entityId: FIXTURE_PLAN.id },
	]);

/** The room insert whose sidecar write and compensating removal both refused — notices step 17a. */
async function leaveRoomHalfWritten(view: PlanEditorView): Promise<void> {
	const stamped = stampedRoom('zone.sidecar-insert-uncompensated', ROOM);
	await runtimeOfView(view).dispatcher.run({ execute: () => Promise.resolve(err(stamped)), undo: () => Promise.resolve(ok('wrote')) });
	await settle();
}

const row = (view: PlanEditorView): HTMLElement => {
	const found = view.contentEl.querySelector<HTMLElement>('[data-rp-warning="unrecovered"]');
	if (found === null) throw new Error('expected the unrecovered row');
	return found;
};

/**
 * Owner ruling 73: the visually hidden sentence a PAUSED control's `aria-describedby` points at,
 * reached through a control that actually points at it — so the case reads what a screen reader
 * reads, not merely the element the root mints.
 */
function pausedReasonText(view: PlanEditorView): string {
	const id = runtimeOfView(view).pausedReasonId;
	if (view.contentEl.querySelector(`[aria-describedby~="${id}"]`) === null) throw new Error('expected a paused control described by the reason');
	return view.contentEl.querySelector(`[id="${id}"]`)?.textContent?.trim() ?? '';
}

async function pressOpenSourceNote(view: PlanEditorView): Promise<void> {
	row(view).querySelector<HTMLButtonElement>('[data-rp-action="open-source-note"]')?.click();
	await settle();
}

describe('the standing unrecovered-write warning, owner ruling 72', () => {
	/**
	 * "No notice" here means the route THIS case dispatches through, `runtime.dispatcher`, which
	 * never reaches `reportDispatchFailure`. That a refusal through the failure report does not
	 * toast either is held elsewhere in `tests/presentation/editor` (the autosave sink's cases).
	 */
	it("names the room's note and opens it, with no notice and the badge on Save error", async () => {
		const { view, openNote } = await opened({});
		const before = Notice.shown.length;

		await leaveRoomHalfWritten(view);

		expect(row(view).textContent).toContain(t('en', 'zone.sidecar-insert-uncompensated'));
		expect(row(view).textContent).not.toContain(t('en', 'editor.unrecovered'));
		expect(useSaveStateStore(piniaOf(view)).state).toBe('save-error');
		expect(Notice.shown.length).toBe(before);

		await pressOpenSourceNote(view);
		expect(openNote.mock.calls).toEqual([[ROOM]]);
		expect(Notice.shown.length).toBe(before);
	});

	it('keeps the room across a settings rebind, which is not a restore', async () => {
		const { view } = await opened({});
		await leaveRoomHalfWritten(view);
		const openNote = vi.fn<(entityId: string) => Promise<Outcome>>().mockResolvedValue('opened');

		view.rebind(deps(openNote));
		await settle();
		sizedShellRoot(view.contentEl);
		await settle();

		expect(row(view).textContent).toContain(t('en', 'zone.sidecar-insert-uncompensated'));
		await pressOpenSourceNote(view);
		expect(openNote.mock.calls).toEqual([[ROOM]]);
	});

	it('falls back to the generic sentence and the plan note on a restored tab, which carries only the flag', async () => {
		const { view, openNote } = await opened({ unrecoveredWrite: true });

		expect(row(view).textContent).toContain(t('en', 'editor.unrecovered'));
		expect(pausedReasonText(view)).toBe(t('en', 'editor.unrecovered'));
		await pressOpenSourceNote(view);
		expect(openNote.mock.calls).toEqual([[FIXTURE_PLAN.id]]);
		expect(view.getState()).toEqual({ planId: FIXTURE_PLAN.id, unrecoveredWrite: true });
	});

	it("owner ruling 73: a paused control's hidden reason names the room's note, as the strip does", async () => {
		const { view } = await opened({});
		await leaveRoomHalfWritten(view);

		expect(pausedReasonText(view)).toBe(t('en', 'zone.sidecar-insert-uncompensated'));
	});

	/**
	 * `PlanEditorView.mount` watches the cause BESIDE the flag because a second refusal on an
	 * already-marked leaf moves only the cause; the rebind must seed THAT one, not the first. A
	 * paused leaf refuses a NEW dispatch at the gate, so the second refusal is a write already in
	 * flight when the first one lands — both are started before either settles.
	 */
	it('a second refusal updates the cause a rebind seeds', async () => {
		const { view } = await opened({});
		const second = FIXTURE_ZONES[1].id;
		const dispatcher = runtimeOfView(view).dispatcher;
		// Each held refusal lands when its release is called, in dispatch order.
		const releases: (() => void)[] = [];
		const held = (code: string, room: string): UndoableCommand => {
			const refused = err(stampedRoom(code, room));
			return {
				execute: () =>
					new Promise<typeof refused>((resolve) => {
						releases.push(() => resolve(refused));
					}),
				undo: () => Promise.resolve(ok('wrote')),
			};
		};
		const runs = [
			dispatcher.run(held('zone.sidecar-insert-uncompensated', ROOM)),
			dispatcher.run(held('zone.sidecar-update-uncompensated', second)),
		];
		await settle();
		releases[0]();
		await settle();
		releases[1]();
		await Promise.all(runs);
		await settle();
		expect(row(view).textContent).toContain(t('en', 'zone.sidecar-update-uncompensated'));
		const openNote = vi.fn<(entityId: string) => Promise<Outcome>>().mockResolvedValue('opened');

		view.rebind(deps(openNote));
		await settle();
		sizedShellRoot(view.contentEl);
		await settle();

		expect(row(view).textContent).toContain(t('en', 'zone.sidecar-update-uncompensated'));
		await pressOpenSourceNote(view);
		expect(openNote.mock.calls).toEqual([[second]]);
	});

	it("says the source note could not be found when the room's note is gone", async () => {
		const { view } = await opened({}, vi.fn<(entityId: string) => Promise<Outcome>>().mockResolvedValue('missing'));
		await leaveRoomHalfWritten(view);
		const before = Notice.shown.length;

		await pressOpenSourceNote(view);

		expect(Notice.shown.slice(before)).toEqual([t('en', 'project.source-note-missing')]);
	});
});
