/**
 * @vitest-environment jsdom
 *
 * The runtime's half of AD18-R20's polish round, driven on `provideDesignerRuntime` in a bare component
 * (`designerRefresh.test.ts`'s shape) because each case needs something the mounted rig cannot give it:
 * the tool framework before any read has answered, a tool that refuses to be switched away from, and a
 * read whose answer the case chooses.
 */
import { describe, expect, it } from 'vitest';
import { createPinia } from 'pinia';
import { defineComponent, h, onMounted } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { ok } from '../../../src/core/result/Result';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { ASSET_DESIGNER_CONTEXT, type AssetDesignerContext } from '../../../src/presentation/designer/AssetDesignerContext';
import { unavailableAssetDesignerCommands } from '../../../src/presentation/designer/designerCommands';
import { provideDesignerRuntime, type DesignerRuntime } from '../../../src/presentation/designer/runtime';
import type { EditorTool } from '../../../src/presentation/editor/tools/editor-tool';
import { assetDesign } from '../../helpers/assetDesign';
import { editableShape } from '../../helpers/assetShapes';
import { emptyBackgroundVault } from '../../helpers/background';
import { installCanvas } from '../../helpers/canvas';
import { installObsidianDom } from '../../helpers/dom';
import { installResizeObserver } from '../../helpers/layout';
import { recorder } from '../../helpers/logger';
import { unwiredPlanUsage } from '../../helpers/designerQueries';

installObsidianDom();
installCanvas();
installResizeObserver();

const THE_ASSET = createAssetId();
const WITH_CLEARANCE = editableShape();
const WITHOUT_CLEARANCE = editableShape({ clearance: null });

interface Harness {
	readonly runtime: DesignerRuntime;
	/** Sets what the next read answers; the mount's read answers `WITH_CLEARANCE`. */
	readonly answers: (shape: AssetShape) => void;
	/** A peer's write reaching this leaf: the design-changed event the composition root subscribes it to. */
	readonly peerWrote: () => Promise<void>;
}

function harness(): Harness {
	const listeners: (() => void)[] = [];
	const state = { answer: WITH_CLEARANCE };
	const context: AssetDesignerContext = {
		assetId: THE_ASSET,
		queries: {
			listPlansUsingAsset: unwiredPlanUsage,
			getAssetDesign: () => Promise.resolve(ok(assetDesign({ assetId: THE_ASSET, shape: state.answer }))),
		},
		commands: unavailableAssetDesignerCommands(),
		logger: recorder,
		closeLeaf: () => undefined,
		picker: null,
		vault: emptyBackgroundVault(),
		onDesignChanged: (listener) => {
			listeners.push(listener);
			return () => undefined;
		},
		onThemeChange: () => () => undefined,
		onVaultFileChanged: () => () => undefined,
		indexScanCompleted: () => true,
	};
	let captured!: DesignerRuntime;
	mount(
		defineComponent({
			setup() {
				captured = provideDesignerRuntime(context);
				onMounted(() => {
					void captured.hydrate();
				});
				return () => h('div');
			},
		}),
		{ global: { plugins: [createPinia()], provide: { [ASSET_DESIGNER_CONTEXT as symbol]: context } } },
	);
	return {
		runtime: captured,
		answers: (shape) => {
			state.answer = shape;
		},
		peerWrote: async () => {
			for (const listener of listeners) listener();
			await flushPromises();
		},
	};
}

/** A tool that holds on: `ToolManager.setActiveTool` asks `canDeactivate` and does nothing on `false`. */
function stubborn(): EditorTool {
	return {
		id: 'measure',
		canDeactivate: () => false,
		activate: () => undefined,
		deactivate: () => undefined,
		pointerDown: () => undefined,
		pointerMove: () => undefined,
		pointerUp: () => undefined,
		cancel: () => undefined,
		abandonGesture: () => undefined,
		hasDraft: () => false,
	};
}

describe('the resting tool', () => {
	it('is Select from the moment the runtime is built, before the first read has answered', () => {
		const { runtime } = harness();
		expect(runtime.toolManager.activeToolId).toBe('select');
		expect(runtime.activeToolId.value).toBe('select');
	});
});

describe('arming Trace clearance', () => {
	it('reveals nothing when the switch was refused, because the tool that is active did not change', async () => {
		const { runtime } = harness();
		await flushPromises();
		runtime.toolManager.register(stubborn());
		runtime.setTool('measure');
		runtime.showClearance.value = false;

		runtime.setTool('trace-clearance');

		expect(runtime.activeToolId.value).toBe('measure');
		expect(runtime.showClearance.value).toBe(false);
	});
});

describe('a clearance a peer write brings back', () => {
	it('is shown again once the refresh reads it where there was none', async () => {
		const leaf = harness();
		await flushPromises();
		leaf.runtime.showClearance.value = false;

		leaf.answers(WITHOUT_CLEARANCE);
		await leaf.peerWrote();
		expect(leaf.runtime.showClearance.value).toBe(false);

		leaf.answers(WITH_CLEARANCE);
		await leaf.peerWrote();
		expect(leaf.runtime.showClearance.value).toBe(true);
	});

	it('stays hidden when the refresh reads a clearance that was already there', async () => {
		const leaf = harness();
		await flushPromises();
		leaf.runtime.showClearance.value = false;

		leaf.answers(editableShape({ facing: Math.PI / 2 }));
		await leaf.peerWrote();

		expect(leaf.runtime.showClearance.value).toBe(false);
	});
});
