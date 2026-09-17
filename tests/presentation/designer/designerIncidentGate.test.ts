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
 * **So the Asset Designer is not gated at all** — not a tool, not a button, not the inspector,
 * not the preset form. Every write it dispatches is refused by the guarded doors underneath and
 * nothing on screen says so first. This file is the prerequisite's check, not the increment's.
 *
 * **That sentence has two halves and this file checks only the SECOND one** — *"nothing on
 * screen says so first"*, through the `writesBlocked()` probe below. The FIRST half — that the
 * guarded doors underneath really do refuse — is checked by
 * `designerIncidentRefusal.test.ts` beside this file, which builds the design bundle through
 * the REAL `guardAssetDesign` and dispatches real gestures at it. Neither file holds the claim
 * alone, and that file also records the measured gap in it: the UNDO half writes through raw
 * ports and is not behind the gate.
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
import { assetDesign } from '../../helpers/assetDesign';
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
