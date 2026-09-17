/**
 * @vitest-environment jsdom
 *
 * **The Asset Designer's write gate, which did not exist until 2026-09-17 (BP-02 slice 4).**
 *
 * `designer/runtime.ts` handed its tool framework `writesBlocked: () => false`, a constant,
 * under a comment that was right about the Plan Editor's STALE-read trust path having no
 * counterpart here and said nothing about incidents. It was therefore wrong for the fact
 * ADR-0034 added: an open write incident pauses every guarded write in the VAULT, and this
 * surface's forward doors are guarded (`composeGuarded`), so its tools were pre-checking
 * against a constant while the doors beneath them refused.
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

	it('answers false for writesBlocked while the vault holds no incident', async () => {
		installQuietWriteIncidents();
		const runtime = designerRuntime();
		await flushPromises();

		expect(contextOf(runtime).writesBlocked()).toBe(false);
	});

	/**
	 * The case the constant could never answer. Every registered designer tool consults this one
	 * function, so one expression gates the whole framework — and a tool that pre-checks it stops
	 * offering a drag whose release the guarded door below would refuse anyway.
	 *
	 * **What this does NOT assert, said here because the gap is real:** that a designer BUTTON is
	 * disabled. The inspector's fields, the toolbar and the preset form stay visually enabled;
	 * their dispatches are refused underneath. That is an affordance gap, not a data-safety one.
	 */
	it('answers true for writesBlocked when the leaf mounts with an incident already open', async () => {
		await installOpenWriteIncident();
		const runtime = designerRuntime();
		await flushPromises();

		expect(contextOf(runtime).writesBlocked()).toBe(true);
	});
});
