/**
 * @vitest-environment jsdom
 *
 * **The value the Asset Designer's `EditorContext` carries — and the measured fact that NO
 * REGISTERED TOOL EVER ASKS FOR IT.**
 *
 * Read that sentence before reading either case below as a gate. `designer/runtime.ts` handed
 * its tool framework `writesBlocked: () => false`, a constant, under a comment that was right
 * about the Plan Editor's STALE-read trust path having no counterpart here and said nothing
 * about incidents. That constant was a lie about ADR-0034's vault-wide pause and is now the
 * honest value. It changes no behaviour on this surface, because nothing reads it.
 *
 * Measured rather than remembered, in the edit that wrote this:
 * `grep -rn "writesBlocked()" src/presentation/editor/` prints **23** call sites in SIX modules —
 * `tools/select-tool.ts`, `elements/ElementMove.ts`, `elements/ElementResize.ts`,
 * `elements/ElementRotation.ts`, `labels/LabelMove.ts`, `structure/OpeningResize.ts`. The grep is
 * scoped to `editor/` on purpose: unscoped over `src/` it also counts the comments that spell the
 * call, including this one, so it answers several more than the calls. In
 * `src/presentation/designer/` the only occurrence that is not prose is the `writesBlocked:`
 * property `runtime.ts` builds — `grep -rn "writesBlocked" src/presentation/designer/ | grep -v "//"`
 * returns exactly that one line. `registerDesignerTools` registers `DesignerSelectTool`,
 * `DrawPolygonTool`, `DrawDetailTool`, `SetAnchorTool`, `SetFacingTool` and `CalibrateTool`, and
 * none of the six reading modules is among them.
 *
 * **So no FORWARD write on this surface is gated** — not a tool, not an inspector field, not the
 * preset form. Each is refused by the guarded doors underneath and nothing on screen says so
 * first. This file was the prerequisite's check for that, not the increment's.
 *
 * **Until BP-02's L-16 that sentence had no "forward" in it, and read "the Asset Designer is not
 * gated at all — not a tool, not a button, not the inspector, not the preset form."** The BUTTON
 * clause stopped being true: `designer/runtime.ts`'s `designerDispatcher` now puts `withStaleGate`
 * between `withSaveStateTracking` and `wrapDispatcher`, exactly where the Plan Editor has it, so
 * this leaf's Undo and Redo are refused while `saveState.unrecoveredWrite` holds — and
 * `canUndo`/`canRedo` disable the two toolbar controls on the same fact. The third describe below
 * is that measurement, at the dispatcher, which is the level the gate actually lives at. Note
 * what did NOT change: `withStaleGate`'s `isStale` predicate is `() => false` here, so `run` is
 * refused by nothing on this surface and the first two describes' subject is untouched.
 *
 * **That sentence has two halves and this file checks only the SECOND one** — *"nothing on
 * screen says so first"*, through the `writesBlocked()` probe below. The FIRST half — that the
 * guarded doors underneath really do refuse — is checked by
 * `designerIncidentRefusal.test.ts` beside this file, which builds the design bundle through
 * the REAL `guardAssetDesign` and dispatches real gestures at it. It holds that half as a
 * CATEGORY rather than a sample: a loop over the guarded bundle's own members requires both
 * doors of all nine commands to answer `WRITES_PAUSED_CODE`, with the `get` query excluded by
 * name, and two of them are additionally driven end to end through the designer's real write
 * door with the port read back. Neither file holds the whole sentence alone, and that file also
 * records the measured gap in it: the UNDO half writes through raw ports and is not behind the
 * gate.
 * The sentence lives here because the describe that moved out of `designerRefresh.test.ts`
 * carried it ("no registered tool ever asks"), the first pass at this slice deleted it and
 * replaced it with the opposite claim, and a reader arriving at the new file had no way to
 * discover the gap.
 *
 * Both cases reach the REAL context `buildRuntime` builds, through `ToolManager`'s own public
 * door, rather than reading the expression out of the module. A probe tool registered under
 * `'measure'` — an id this surface does not register; it was `'select'` until the designer
 * registered a Select tool, when `ToolManager.register` began refusing the duplicate — is what
 * captures it. That mechanism and the `false` case below moved here from
 * `designerRefresh.test.ts`, whose subject is the read-back after a dispatch and which was
 * within about twenty counted lines of its 450-line cap.
 *
 * **The registry is installed BEFORE the mount in the blocked case, and that ordering is the
 * mechanism rather than a fixture detail.** `save-state-store.ts` asks
 * `activeWriteIncidentRegistry()` once, while the store is being created; a leaf mounts its own
 * Pinia, so "a designer opened while an incident is open" IS "a store created after the
 * registry was installed".
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, onMounted } from 'vue';
import { ok } from '../../../src/core/result/Result';
import type { DispatchOutcome } from '../../../src/application/commands/DispatchOutcome';
import { guardCommand, WRITES_PAUSED_CODE } from '../../../src/application/errors/guardAgainstThrowing';
import { persistenceError } from '../../../src/application/errors';
import { installWriteIncidentRegistry } from '../../../src/application/incidents/WriteIncidentRegistry';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import {
	ASSET_DESIGNER_CONTEXT,
	type AssetDesignerContext,
} from '../../../src/presentation/designer/AssetDesignerContext';
import { unavailableAssetDesignerCommands } from '../../../src/presentation/designer/designerCommands';
import { provideDesignerRuntime, type DesignerRuntime } from '../../../src/presentation/designer/runtime';
import type { EditorContext } from '../../../src/presentation/editor/tools/editor-context';
import type { EditorTool } from '../../../src/presentation/editor/tools/editor-tool';
import type { UndoableCommand } from '../../../src/presentation/editor/tools/undoable-command';
import { STALE_WRITE_REFUSED } from '../../../src/presentation/editor/tools/with-stale-gate';
import { assetDesign } from '../../helpers/assetDesign';
import { expectErr, expectOk } from '../../helpers/domain';
import { installObsidianDom } from '../../helpers/dom';
import { emptyBackgroundVault } from '../../helpers/background';
import { recorder, resetRecorder } from '../../helpers/logger';
import { installOpenWriteIncident, installQuietWriteIncidents } from '../../helpers/writeIncidents';

installObsidianDom();

const THE_ASSET = createAssetId();

/**
 * The runtime alone, on a bare `div` — no canvas and no shell. Every member this context
 * requires is answered the way production answers it; only the SURFACE around the runtime is
 * absent, and nothing here draws.
 */
function designerRuntime(): DesignerRuntime {
	const context: AssetDesignerContext = {
		assetId: THE_ASSET,
		queries: { getAssetDesign: () => Promise.resolve(ok(assetDesign({ assetId: THE_ASSET }))) },
		commands: unavailableAssetDesignerCommands(),
		logger: recorder,
		picker: null,
		vault: emptyBackgroundVault(),
		onDesignChanged: () => () => undefined,
		onThemeChange: () => () => undefined,
		onVaultFileChanged: () => () => undefined,
		indexScanCompleted: () => true,
		closeLeaf: () => undefined,
	};
	let captured!: DesignerRuntime;
	mount(
		defineComponent({
			setup() {
				const runtime = provideDesignerRuntime(context);
				captured = runtime;
				// The mount read, exactly where `AssetDesignerRoot` performs it.
				onMounted(() => {
					void runtime.hydrate();
				});
				return () => h('div');
			},
		}),
		{ global: { plugins: [createPinia()], provide: { [ASSET_DESIGNER_CONTEXT as symbol]: context } } },
	);
	return captured;
}

/**
 * A mutable-cell holder rather than a bare `let`, for the reason this repository's own Testing
 * section records: a `let` reassigned only inside a closure narrows to `null` at every later
 * read, and a definite-assignment `!` would claim the object exists before `setActiveTool` has
 * run. `buildDispatcherChain`'s own `inspectorRef` breaks the identical narrowing the same way.
 */
function contextOf(runtime: DesignerRuntime): EditorContext {
	const captured: { current: EditorContext | null } = { current: null };
	const probe: EditorTool = {
		id: 'measure',
		activate: (context) => {
			captured.current = context;
		},
		deactivate: () => undefined,
		pointerDown: () => undefined,
		pointerMove: () => undefined,
		pointerUp: () => undefined,
		cancel: () => undefined,
		abandonGesture: () => undefined,
		hasDraft: () => false,
	};
	runtime.toolManager.register(probe);
	runtime.toolManager.setActiveTool('measure');
	if (captured.current === null) throw new Error('the probe tool was never activated');
	return captured.current;
}

/**
 * An ordinary gesture that WROTE, driven straight at `runtime.dispatcher` rather than through a
 * canvas gesture: the gate below sits on the ONE dispatcher every door on this leaf funnels
 * through, so asserting it here asserts it at every door.
 *
 * Its `undo` resolves ok UNCONDITIONALLY, and that is the faithful part rather than a
 * convenience. `ReversibleAssetDesignCommands`' real inverses write the captured snapshot back
 * through the RAW `assets.save` / `sidecar.write` ports, neither of which passes `guardCommand`
 * — measured next door in `designerIncidentRefusal.test.ts`. So an inverse that refused itself
 * would be HARSHER than production and would leave the case green with the gate removed.
 */
function noopWriteCommand(): UndoableCommand {
	return {
		execute: () => Promise.resolve(ok<DispatchOutcome>('wrote')),
		undo: () => Promise.resolve(ok<DispatchOutcome>('wrote')),
	};
}

/**
 * A gesture whose `execute` goes through the REAL `guardCommand`, so the refusal a paused vault
 * produces is production's own rather than a code typed into this file. It is how a mounted leaf
 * LEARNS the vault paused: nothing notifies it, and `withSaveStateTracking` calls
 * `markVaultPaused()` on exactly this code. The identical stand-in stands one surface over in
 * `tests/presentation/editor/runtime.test.ts`.
 */
function guardedGesture(): UndoableCommand {
	const guarded = guardCommand<undefined, DispatchOutcome, never>(
		{ execute: () => Promise.resolve(ok<DispatchOutcome>('wrote')) },
		'test.guarded-gesture',
		recorder,
		(cause) => ({ ...persistenceError('vault.threw', 'threw', cause), technicalFault: true }),
	);
	return { execute: () => guarded.execute(undefined), undo: () => guarded.execute(undefined) };
}

describe('the tool framework this leaf builds', () => {
	afterEach(() => {
		installWriteIncidentRegistry(null);
		resetRecorder();
	});

	beforeEach(resetRecorder);

	it('answers false for writesBlocked while the vault holds no incident, though no registered tool asks', async () => {
		installQuietWriteIncidents();
		const runtime = designerRuntime();
		await flushPromises();

		expect(contextOf(runtime).writesBlocked()).toBe(false);
	});

	/**
	 * The case the constant could never answer: the value is now truthful.
	 *
	 * **What this does NOT assert, and the list is the whole surface:** that any designer tool
	 * stops a gesture, that a button is disabled, that the inspector's fields are inert, or that
	 * the preset form refuses. None of that happens — the header's grep is the measurement. The
	 * probe tool below is the ONLY thing in this repository that reads this value, and it exists
	 * in this file. That is what the case name says out loud.
	 */
	it('answers true for writesBlocked when the leaf mounts with an incident already open, and no registered tool ever asks', async () => {
		await installOpenWriteIncident();
		const runtime = designerRuntime();
		await flushPromises();

		expect(contextOf(runtime).writesBlocked()).toBe(true);
	});
});

/**
 * **BP-02's L-16: the one thing on this surface that IS gated, at the level the gate lives.**
 *
 * `designerDispatcher` composes `withStaleGate` between `withSaveStateTracking` and
 * `wrapDispatcher`, and that decorator refuses `undo`/`redo` on its `unsafeHistory()` predicate
 * — here `saveState.unrecoveredWrite`, which is `leafOwn || vaultPaused`. So an open write
 * incident anywhere in the vault (ADR-0034) refuses this leaf's Undo.
 *
 * **Why the gate has to be at the dispatcher and cannot be underneath.** The inverses of
 * `ReversibleAssetDesignCommands` write the captured snapshot back through the raw
 * `assets.save` / `sidecar.write` ports, and neither passes `guardCommand` —
 * `designerIncidentRefusal.test.ts`'s last describe measures exactly that and still does after
 * this change, because calling an inverse DIRECTLY still reaches those ports. What makes the
 * distinction safe is that no production caller does: the only three places in
 * `src/presentation/designer/` that call an inverse at all are `registerDesignerTools.ts`'s
 * detail write and its two polygon traces, and each of the three hands the inverse to
 * `CommandHistory` inside an `UndoableCommand` rather than invoking it. `grep -rn "\.undo("
 * src/presentation/designer/` prints FIVE lines and no more: those three, plus the two that ARE
 * this door — `runtime.ts:521`'s `dispatcher.undo()` and `DesignerToolbar.vue:89`'s
 * `runtime.undo()`, the button that calls it.
 */
describe('the dispatcher this leaf hands out (BP-02 L-16)', () => {
	afterEach(() => {
		installWriteIncidentRegistry(null);
		resetRecorder();
	});

	/**
	 * **The sequence is forced, not chosen.** A leaf that MOUNTS with an incident open seeds
	 * `vaultPaused` true, and the only reachable state with a filled history and a paused vault
	 * is this one: the leaf works while the vault is clean, a peer pauses it, and this leaf
	 * catches up at its next write — there is no notification, so the refused write is where it
	 * learns. Every step is production's own mechanism: `guardCommand` raises the code,
	 * `withSaveStateTracking` turns it into `markVaultPaused()`, `withStaleGate` reads the result.
	 */
	it('refuses undo once an incident opens behind a gesture already on the history', async () => {
		installQuietWriteIncidents();
		const runtime = designerRuntime();
		await flushPromises();

		expect(expectOk(await runtime.dispatcher.run(noopWriteCommand()))).toBe('wrote');
		expect(runtime.canUndo.value).toBe(true);

		// A peer leaf half-writes the vault; this leaf catches up on its own next write.
		await installOpenWriteIncident();
		expect(expectErr(await runtime.dispatcher.run(guardedGesture())).code).toBe(WRITES_PAUSED_CODE);

		const undone = await runtime.dispatcher.undo();

		expect(expectErr(undone).code).toBe(STALE_WRITE_REFUSED);
		// The AFFORDANCE half. It read `true` above the pause and reads `false` here, which is
		// what makes this an observation of the gate rather than of an empty stack.
		expect(runtime.canUndo.value).toBe(false);
	});

	/** Redo takes the same arm of the same decorator, and a gate on one is not a gate on both. */
	it('refuses redo once an incident opens behind an undone gesture', async () => {
		installQuietWriteIncidents();
		const runtime = designerRuntime();
		await flushPromises();

		expect(expectOk(await runtime.dispatcher.run(noopWriteCommand()))).toBe('wrote');
		expect(expectOk(await runtime.dispatcher.undo())).toBe('wrote');
		expect(runtime.canRedo.value).toBe(true);

		await installOpenWriteIncident();
		expect(expectErr(await runtime.dispatcher.run(guardedGesture())).code).toBe(WRITES_PAUSED_CODE);

		expect(expectErr(await runtime.dispatcher.redo()).code).toBe(STALE_WRITE_REFUSED);
		expect(runtime.canRedo.value).toBe(false);
	});
});
