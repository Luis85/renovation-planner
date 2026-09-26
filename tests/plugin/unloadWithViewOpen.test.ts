/**
 * @vitest-environment jsdom
 *
 * `onunload` with a view still mounted — the lifecycle contract's plugin-unload column
 * (`docs/releases/first-beta-readiness/04-lifecycle-contract.md`), and the boundary that had
 * no test at all: no case in the suite both opened a view through the plugin's own registered
 * factory and called `onunload`.
 *
 * **The state driven here is the contract's *unresolved incident*, which its own "where each
 * state lives" table marks "Survives remount: Yes" at all three levels — i.e. the one state the
 * document believed safe.** It was not. `onunload` unmounts no Vue app and detaches no leaf, so
 * every view is still mounted and still dispatching afterwards, while `SessionStores.dispose()`
 * took the write-incident registry off the module global that three readers consult. Rule 3 — a
 * refusal is not cleared by a teardown — was therefore broken at exactly the boundary the
 * contract treats as the safe one.
 *
 * **Both arms, because one does not imply the other.** A forward write is refused by
 * `guardCommand`, which reads `activeWriteIncidentRegistry()` and skips its refusal entirely on
 * `null`. An UNDO is refused by `withIncidentGate`, whose `paused()` answers `false` through its
 * own `?? false` — and `with-incident-gate.ts`'s docblock records why it cannot be covered by
 * the forward arm: an inverse dispatches no command, writing its captured snapshot back through
 * the raw `assets.save` / `sidecar.write` / zone ports, none of which passes `guardCommand`.
 *
 * Driven through the PLUGIN, never through the editor harness: what is under test is which
 * registry `onunload` leaves behind for views the plugin's own factory built, and a harness that
 * hands a view its own dependencies cannot have this bug.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { PLAN_EDITOR_VIEW } from '../../src/presentation/views/PlanEditorView';
import type { PlanEditorDeps } from '../../src/presentation/views/PlanEditorView';
import { activeWriteIncidentRegistry } from '../../src/application/incidents/WriteIncidentRegistry';
import { WRITES_PAUSED_CODE } from '../../src/application/errors/guardAgainstThrowing';
import type { PlanId } from '../../src/domain/plan/PlanId';
import type { UndoableCommand } from '../../src/presentation/editor/tools/undoable-command';
import { loadedPlugin, openViewOnLeaf, type OpenedView } from '../helpers/plugin';
import { createRepositoryStack } from '../helpers/vault';
import { makePlan, makeProject } from '../helpers/entities';
import { expectErr, expectOk } from '../helpers/domain';
import { installEditorEnvironment, runtimeOfPluginView, settle, settleUntil, sizedShellRoot } from '../helpers/editor';
import { slowGuardedSave } from '../helpers/writeIncidents';

installEditorEnvironment();

/** A vault holding one project and one plan, already parsed, as a restart would find it. */
async function vaultWithAPlan() {
	const stack = createRepositoryStack(DEFAULT_SETTINGS.projectFolder);
	const project = makeProject();
	expectOk(await stack.projects.save(project, 'absent'));
	const plan = makePlan({ projectId: project.id, name: 'Ground floor' });
	expectOk(await stack.plans.save(plan, 'absent'));
	stack.metadataCache.catchUp();
	return { stack, planId: plan.id };
}

/**
 * The plugin, loaded over that vault, with a Plan Editor open on the plan — built by the
 * plugin's own `registerView` factory, so its dependencies are the ones the CURRENT root
 * resolved rather than a test's assembly of them.
 */
async function pluginWithAnOpenEditor() {
	const { stack, planId } = await vaultWithAPlan();
	const loaded = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
	loaded.workspace.layoutReady();
	const { view } = await openViewOnLeaf(loaded.plugin, loaded.workspace, PLAN_EDITOR_VIEW, { planId });
	// The pane Obsidian would have laid out: `ResponsiveEditorShell` reads its root's
	// `clientWidth`, jsdom answers 0, and `layoutModeFor(0)` draws the too-narrow notice
	// instead of the canvas the runtime below lives in.
	sizedShellRoot((view as unknown as { contentEl: HTMLElement }).contentEl);
	await settle();
	return { ...loaded, view, planId };
}

/** A zone creation through the view's OWN guarded commands — a real forward write. */
function createZone(view: OpenedView, planId: PlanId, name: string) {
	const deps = view.deps as unknown as PlanEditorDeps;
	return deps.commands.createZone.execute({
		planId,
		name,
		zoneType: 'Room',
		geometry: { points: [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 2000 }, { x: 0, y: 2000 }] },
	});
}

/**
 * Something undoable to put on the history, borrowed from `tests/presentation/editor/
 * runtime.test.ts`: the subject is the DISPATCHER's gate, so the command underneath only has
 * to be reversible and to record whether its body ran.
 */
function noopWriteCommand(ran: string[]): UndoableCommand {
	return {
		label: 'test.write',
		execute: () => { ran.push('execute'); return Promise.resolve({ ok: true, value: 'wrote' } as never); },
		undo: () => { ran.push('undo'); return Promise.resolve({ ok: true, value: 'wrote' } as never); },
	} as never as UndoableCommand;
}

/**
 * Open an incident on the registry THIS PLUGIN installed, never on one of the
 * `tests/helpers/writeIncidents.ts` stand-ins: `dispose()` compares identity before it
 * releases anything, so a registry installed over the plugin's would make every case here pass
 * for the wrong reason — the plugin would simply find a stranger's global and leave it alone.
 */
async function openAnIncident(): Promise<void> {
	await activeWriteIncidentRegistry()?.record({
		category: 'Persistence',
		code: 'zone.write-uncompensated',
		message: 'half-written',
		uncompensatedWrite: [{ entityKind: 'zone', entityId: 'zone-01JAAA' }],
	});
}

describe('plugin unload with a view still mounted, over an unresolved write incident', () => {
	it('still refuses a forward write from the open view', async () => {
		const { plugin, view, planId } = await pluginWithAnOpenEditor();
		await openAnIncident();

		expect(expectErr(await createZone(view, planId, 'BeforeUnload')).code).toBe(WRITES_PAUSED_CODE);

		plugin.onunload();

		// The identical dispatch. It used to answer `ok` here and put a note in the vault.
		expect(expectErr(await createZone(view, planId, 'AfterUnload')).code).toBe(WRITES_PAUSED_CODE);
		expect((view as unknown as { vueApp: unknown }).vueApp).not.toBeNull();
	});

	/**
	 * The undo arm, which the forward one cannot stand in for. The sequence is forced rather
	 * than chosen: an incident open while the editor mounts seeds `vaultPaused`, which makes
	 * `writesBlocked` refuse `run` as well, so nothing could ever reach the history. The only
	 * reachable state with both a filled history and a paused vault is this one — the leaf works
	 * while the vault is clean, the vault is paused behind it, and the user reaches for Undo.
	 */
	it('still refuses an undo from the open view', async () => {
		const { plugin, view } = await pluginWithAnOpenEditor();
		const runtime = runtimeOfPluginView(view);
		const ran: string[] = [];
		expect(expectOk(await runtime.dispatcher.run(noopWriteCommand(ran)))).toBe('wrote');
		await settleUntil(() => runtime.canUndo.value, 'the gesture to reach the history');

		await openAnIncident();
		expect(expectErr(await runtime.dispatcher.undo()).code).toBe(WRITES_PAUSED_CODE);

		plugin.onunload();

		// It used to resolve `ok` here, and the inverse's body used to run.
		expect(expectErr(await runtime.dispatcher.undo()).code).toBe(WRITES_PAUSED_CODE);
		expect(ran).toEqual(['execute']);
	});

	/**
	 * The control, and the half that keeps the removal rule true: a session with nothing open
	 * still takes its global back off, so this fix is a narrowing of `dispose()` rather than its
	 * deletion. Without this case the fix would read identically to "never release".
	 */
	it('still releases the registry when the session has nothing open', async () => {
		const { plugin } = await pluginWithAnOpenEditor();

		plugin.onunload();

		expect(activeWriteIncidentRegistry()).toBeNull();
	});
});

/**
 * Owner ruling 16 (tracker L-21): the record is not released while a save is still running.
 *
 * The order is the MEASURED one (`tests/e2e/unloadWindow.e2e.ts`, Obsidian 1.13.7): the
 * teardown's blur dispatches a field commit, then `onunload` runs, and the write happens after
 * it returns. Here the dispatch and `onunload` share one synchronous turn, so the editor's two
 * serial queues put the GUARD after `onunload` — the harder of the two orders, and the one
 * nothing measured rules out. The save is a stand-in dispatched through the view's own tracked
 * dispatcher, which is the door the Room Inspector's quantity field reaches synchronously.
 */
describe('plugin unload with a save still running from the open view', () => {
	it('keeps the record for a save the teardown started, so its half-failure is gated and recorded', async () => {
		const { plugin, view } = await pluginWithAnOpenEditor();
		const runtime = runtimeOfPluginView(view);
		const registry = activeWriteIncidentRegistry();
		const save = slowGuardedSave();

		const dispatched = runtime.dispatcher.run({ label: 'test.save', execute: save.execute, undo: save.execute } as never as UndoableCommand);
		plugin.onunload();
		await settleUntil(() => save.seen.length > 0, 'the save to reach its guard');

		expect(save.seen).toEqual([registry]);
		save.halfFail();
		expect(expectErr(await dispatched).code).toBe('zone.write-uncompensated');
		expect(activeWriteIncidentRegistry()).toBe(registry);
		expect(registry?.anyOpen()).toBe(true);
		const adapter = plugin.app.vault.adapter as unknown as { read(path: string): Promise<string> };
		await expect.poll(() => adapter.read(registry?.report().path ?? '')).toContain('zone.write-uncompensated');
	});

	it('releases a clean record once the save running at unload settles', async () => {
		const { plugin, view } = await pluginWithAnOpenEditor();
		const runtime = runtimeOfPluginView(view);
		const registry = activeWriteIncidentRegistry();
		const save = slowGuardedSave();

		const dispatched = runtime.dispatcher.run({ label: 'test.save', execute: save.execute, undo: save.execute } as never as UndoableCommand);
		plugin.onunload();
		await settleUntil(() => save.seen.length > 0, 'the save to reach its guard');
		expect(activeWriteIncidentRegistry()).toBe(registry);

		save.finish({ ok: true, value: 'wrote' });
		expectOk(await dispatched);

		expect(activeWriteIncidentRegistry()).toBeNull();
	});
});
