// @vitest-environment jsdom
/**
 * A DISPATCH held open across each of the three disruptions the lifecycle contract names —
 * perspective switch, width change, settings rebind. Row F4
 * (`docs/releases/first-beta-readiness/04-lifecycle-contract.md`), which read "zero cases hold a
 * dispatch open across any of the three".
 *
 * The idiom is `defer()` (`tests/helpers/async.ts`): the command's `execute` answers a promise
 * this file settles, so the disruption happens strictly INSIDE the dispatch rather than beside
 * it. Its own docblock states why nothing weaker works — with `Promise.resolve(...)` the first
 * read always lands first, so a suite written against one is green whether the ordering guard is
 * there or not.
 *
 * **The command body is a stand-in and nothing else here is.** What each arm asks about lives
 * strictly above the command: `withSaveStateTracking`'s `beginSaving`, the history push, the
 * outcome's route back to its caller. All three are reached through `runtime.dispatcher.run`,
 * which is the SAME door `useFieldCommit` and every tool take (`dispatcherChain.ts` builds it
 * once per leaf), so the wire under test is the real one. Setting `save.state` directly would
 * certify the branch and say nothing about that wire, which is the failure shape
 * `responsiveShell.test.ts`'s own header names.
 *
 * **Why all three arms are one file rather than filed by what drives them.** The subject is the
 * DISPATCHER's behaviour while something is destroyed around it, and the three disruptions are
 * comparable only side by side — arm C's result is meaningful exactly because arms A and B are
 * beside it. That is why the rebind arm reaches for `loadedPlugin`/`saveSettings` here rather
 * than living with `tests/plugin/rootSwapRebind.test.ts`: those cases are about the SWAP with
 * nothing in flight.
 *
 * **Arm C is adjacent to F1 and does not reopen it.** F1 is a DIALOG's `onBeforeUnmount`
 * resolving a cancel while a `vault.create` runs; closed by ruling R-S7-11 with its residual
 * accepted. What is asked here is a different object in the same window — the COMMAND's own
 * outcome, and where the history push and the save indicator it drives end up.
 *
 * **What was watched red, and what could not be.** One mutation per arm, each failing exactly
 * its own case as a named assertion: dropping `save.state === 'saving'` from `perspective`'s
 * guard (A, `expected 'renovate' to be 'plan'`); settling the save batch inside
 * `ResponsiveEditorShell.measure` when the mode turns `unsupported` (B,
 * `expected 'saved' to be 'saving'`); hoisting `dispatcherChain`'s `new CommandHistory()` to
 * module scope, which is rule 5's own violation (C, `expected true to be false` on the
 * replacement's `canUndo`). TWO assertions here have no mutation available without inventing
 * production code, and are locks rather than demonstrated reds — arm C's
 * `expectOk(await dispatch)`, since nothing in the tree resolves a pending dispatch on a rebind
 * at all, and the `reboundSave.state` line, which records a residual rather than guarding a
 * mechanism. Said here rather than left to be assumed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pinia } from 'pinia';
import {
	installEditorEnvironment,
	runtimeOf,
	runtimeOfPluginView,
	settle,
	sizedShellRoot,
} from '../../helpers/editor';
import { defer } from '../../helpers/async';
import { resizeTo } from '../../helpers/layout';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectOk } from '../../helpers/domain';
import { makePlan, makeProject } from '../../helpers/entities';
import { createRepositoryStack } from '../../helpers/vault';
import { loadedPlugin, openViewOnLeaf } from '../../helpers/plugin';
import { lines, resetRecorder } from '../../helpers/logger';
import { DEFAULT_SETTINGS } from '../../../src/plugin/settings/settings';
import { PLAN_EDITOR_VIEW } from '../../../src/presentation/views/PlanEditorView';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { EditorRuntime } from '../../../src/presentation/editor/runtime';

vi.mock('../../../src/infrastructure/logging/consoleLogger', async () => (await import('../../helpers/logger')).consoleLoggerMock());

installEditorEnvironment();

/** What a command that really wrote resolves with — the shape `withSaveStateTracking` reads. */
const WROTE = { ok: true, value: 'wrote' } as unknown as DispatchResult;

/**
 * A reversible command whose forward half does not finish until this file says so, plus the
 * count of times it actually RAN.
 *
 * The count is the premise every arm rests on: a gate ahead of the command (`withStaleGate`,
 * `withIncidentGate`) refuses before `execute` is ever called, and a refused dispatch settles at
 * once — so an arm that never checked this would be asserting about a window that was never open.
 * Measured while writing arm C, where a plugin mounted over a vault with no readable plan refused
 * with `editor.stale-write-refused` and the held promise was never reached.
 */
function heldCommand(): {
	readonly run: (runtime: EditorRuntime) => Promise<DispatchResult>;
	finish: () => void;
	executed: () => number;
	undone: () => number;
} {
	const gate = defer<DispatchResult>();
	let executed = 0;
	let undone = 0;
	return {
		run: (runtime) => runtime.dispatcher.run({
			execute: () => {
				executed += 1;
				return gate.promise;
			},
			// Counted rather than stubbed: it is how an arm asks WHICH tree the history push
			// landed in. `canUndo` alone cannot — a rig whose setup already filled the history
			// reads true either way, measured.
			undo: () => {
				undone += 1;
				return Promise.resolve(WROTE);
			},
		}),
		finish: () => gate.resolve(WROTE),
		executed: () => executed,
		undone: () => undone,
	};
}

let open: { unmount: () => void } | null = null;
afterEach(() => {
	open?.unmount();
	open = null;
});

describe('a dispatch held open across a disruption', () => {
	/**
	 * **Arm A — the perspective switch, which already refuses and is pinned here rather than
	 * repaired.** `renovationActions.perspective(next)` returns early on
	 * `dialogs.current || save.state === 'saving' || loading.value || next === session.perspective`,
	 * and `save.state === 'saving'` is what a dispatched command sets through
	 * `withSaveStateTracking`. This drives the two ends of that sentence against each other: the
	 * user's own radio, and a write that is genuinely in flight.
	 *
	 * The retry after the settle is not a formality — it is what tells a refusal apart from a
	 * switch that was broken all along, which is the only other program that passes the first
	 * half.
	 *
	 * **What this case records rather than asserts: the refusal is SILENT.** Nothing is logged
	 * and nothing is shown — the radio simply does not move, and a user pressing it during a slow
	 * vault write has no way to tell that from a dead control. That breaks no rule in the
	 * contract and is deliberately not made into a failing assertion here; adding a notice for it
	 * would mint user-facing copy, which needs a native-speaker review this repository does not
	 * have (limitation L-15). The `lines` assertion is what would notice if somebody added a
	 * developer-facing half without the user-facing one.
	 */
	it('refuses a perspective switch while a write is in flight, and allows it once the write settles', async () => {
		const r = await renovationEditor();
		open = r;
		const save = useSaveStateStore(r.pinia);
		expect(r.session.perspective).toBe('plan');
		resetRecorder();

		const held = heldCommand();
		const dispatch = held.run(r.runtime);
		await settle();
		expect(held.executed()).toBe(1);
		expect(save.state).toBe('saving');

		await r.wrapper.get('[data-rp-perspective="renovate"]').trigger('click');
		await settle();

		expect(r.session.perspective).toBe('plan');
		expect(r.wrapper.get('[data-rp-perspective="plan"]').attributes('aria-checked')).toBe('true');
		expect(r.wrapper.get('[data-rp-perspective="renovate"]').attributes('aria-checked')).toBe('false');
		// Recorded, not celebrated: the refusal reaches the user through no channel at all.
		expect(lines).toHaveLength(0);

		held.finish();
		expectOk(await dispatch);
		await settle();
		expect(save.state).toBe('saved');

		// The same gesture, now that nothing is in flight. Without this the case would pass
		// against a switch that never worked.
		await r.wrapper.get('[data-rp-perspective="renovate"]').trigger('click');
		await settle();
		expect(r.session.perspective).toBe('renovate');
	});

	/**
	 * **Arm B — the width floor, where no refusal exists and none is needed.** The canvas slot
	 * unmounts and everything the dispatch's outcome touches is above it: the leaf's Pinia, its
	 * `CommandHistory`, the save-state store. So rules 1 and 2 hold structurally — nothing is
	 * reported as cancelled, and the outcome reaches the same live root it started in.
	 *
	 * Asserted at the HISTORY as well as at the indicator, because the two fail differently: an
	 * indicator settling to `saved` says the batch closed, and `canUndo` says the write was
	 * recorded as reversible by the tree that is still on screen.
	 */
	it('carries a dispatch across the width floor and settles it into the same live root', async () => {
		const r = await renovationEditor();
		open = r;
		const runtime = runtimeOf(r);
		const save = useSaveStateStore(r.pinia);

		const held = heldCommand();
		const dispatch = held.run(runtime);
		await settle();
		expect(held.executed()).toBe(1);
		expect(save.state).toBe('saving');

		resizeTo(r.rootEl, 320, 800);
		await settle();

		// The canvas is gone and the write is still in flight and still reported as such: a
		// component disappearing does not cancel a command (rule 1).
		expect(r.wrapper.find('.rp-plan-canvas').exists()).toBe(false);
		expect(r.rootEl.dataset.layout).toBe('unsupported');
		expect(save.state).toBe('saving');

		held.finish();
		expectOk(await dispatch);
		await settle();

		expect(save.state).toBe('saved');
		expect(runtime.canUndo.value).toBe(true);

		resizeTo(r.rootEl, 1280, 800);
		await settle();
		expect(r.wrapper.find('.rp-plan-canvas').exists()).toBe(true);
		expect(save.state).toBe('saved');

		// The history push landed in THIS tree: its Undo reverses the very command that was in
		// flight while the canvas was gone. `canUndo` cannot say that on its own — this rig's own
		// setup already filled the history, so it reads true either way.
		expectOk(await runtime.dispatcher.undo());
		expect(held.undone()).toBe(1);
	});

	/**
	 * **Arm C — the settings rebind, which destroys the whole Vue app and its whole Pinia while
	 * the write runs on.** Rule 2: *a retired context publishes nothing into a live one.*
	 *
	 * Driven through the plugin's own `registerView` factory and its real `saveSettings` chain,
	 * over a real repository stack — a harness that handed the view its own dependencies could
	 * not have this bug, and a vault with no readable plan would have the dispatch refused by the
	 * stale gate before `execute` ran at all.
	 *
	 * The outcome is asserted in both directions, because only the pair says anything: it
	 * resolves to the caller that asked for it (rule 1 — nothing is reported as cancelled), and
	 * the REPLACEMENT tree's history and indicator are untouched by it (rule 2).
	 *
	 * **The residual this case pins rather than repairs**, and it is the contract's own *Command
	 * pending* row read back — "the write survives; the knowledge of it does not": between the
	 * rebind and the settle, the fresh root reads `saved` over a write that has not landed. That
	 * is a consequence of `createPinia()` being per mount rather than a missing guard, and
	 * closing it would need durable per-leaf state for an in-flight dispatch, which is wider than
	 * anything rules 1 to 4 ask for. It is asserted here as the measured behaviour so that a
	 * change to it is a decision rather than a drift.
	 */
	it('settles a rebound leaf’s dispatch into the retired tree, leaving the replacement untouched', async () => {
		resetRecorder();
		const stack = createRepositoryStack(DEFAULT_SETTINGS.projectFolder);
		const project = makeProject();
		expectOk(await stack.projects.save(project, 'absent'));
		const plan = makePlan({ projectId: project.id, name: 'Ground floor' });
		expectOk(await stack.plans.save(plan, 'absent'));
		stack.metadataCache.catchUp();
		const loaded = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		loaded.workspace.layoutReady();
		const { view } = await openViewOnLeaf(loaded.plugin, loaded.workspace, PLAN_EDITOR_VIEW, { planId: plan.id });
		// The pane Obsidian would have laid out; without it `layoutModeFor(0)` draws the
		// too-narrow notice instead of the canvas the runtime lives in.
		sizedShellRoot((view as unknown as { contentEl: HTMLElement }).contentEl);
		await settle();
		const runtime = runtimeOfPluginView(view);

		const held = heldCommand();
		const dispatch = held.run(runtime);
		await settle();
		expect(held.executed()).toBe(1);

		await loaded.plugin.saveSettings({ ...DEFAULT_SETTINGS, projectFolder: 'Somewhere Else' });
		await settle();

		// A different app and a different Pinia, which is what makes everything below a claim
		// about where an outcome goes rather than about a remount that did not happen.
		const rebound = runtimeOfPluginView(view);
		expect(rebound).not.toBe(runtime);
		const reboundSave = useSaveStateStore(piniaOf(view));
		// The residual, measured: the fresh root reports a clean save over an unlanded write.
		expect(reboundSave.state).toBe('saved');

		held.finish();
		// Rule 1: the outcome reaches the caller that dispatched it, unchanged and not cancelled.
		expect(expectOk(await dispatch)).toBe('wrote');
		await settle();

		// Rule 2: and it reached nothing in the replacement. The history push landed in the
		// retired tree — a fresh `CommandHistory` has nothing in it — and the indicator was
		// never driven by a batch that did not belong to it. The replacement's Undo cannot
		// reach the held command: it has nothing to undo, and the command's own counter says so.
		expect(rebound.canUndo.value).toBe(false);
		await rebound.dispatcher.undo();
		expect(held.undone()).toBe(0);
		expect(useSaveStateStore(piniaOf(view)).state).toBe('saved');
		expect(lines.filter((line) => line.level === 'error')).toHaveLength(0);
	});
});

/**
 * A mounted view's Pinia, the way `rootSwapRebind.test.ts` reaches it: Pinia's `install(app)`
 * sets `app.config.globalProperties.$pinia`, which is the one door into the instance from
 * outside the component tree. Read AFTER each disruption rather than captured once, because the
 * whole point of arm C is that the instance is replaced.
 */
function piniaOf(view: unknown): Pinia {
	return (view as { vueApp: { config: { globalProperties: { $pinia: Pinia } } } }).vueApp.config.globalProperties.$pinia;
}
