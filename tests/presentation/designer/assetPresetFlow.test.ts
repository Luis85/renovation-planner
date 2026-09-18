/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import AssetDesignerRoot from '../../../src/presentation/designer/AssetDesignerRoot.vue';
import {
	ASSET_DESIGNER_CONTEXT,
	type AssetDesignerContext,
} from '../../../src/presentation/designer/AssetDesignerContext';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';
import { GetAssetDesignQuery } from '../../../src/application/queries/GetAssetDesign';
import type { AssetId } from '../../../src/domain/asset/AssetId';
import { recorder } from '../../helpers/logger';
import { expectOk } from '../../helpers/domain';
import { seeded, drawn } from '../../helpers/assetDesignHarness';
import { emptyBackgroundVault } from '../../helpers/background';
import { installCanvas } from '../../helpers/canvas';
import { installResizeObserver } from '../../helpers/layout';
import { ASSET_PRESETS } from '../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../src/domain/asset/presets/presetGeometry';
import { t } from '../../../src/presentation/i18n/strings';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { DEFAULT_VIEWPORT } from '../../../src/presentation/editor/viewport/Viewport';
import { toiletShape } from '../../helpers/assetShapes';
import { designerRig, tracePolygon, type DesignerRig } from '../../helpers/designerRig';
import { settle } from '../../helpers/editor';
import { unwiredPlanUsage } from '../../helpers/designerQueries';

installCanvas();
installResizeObserver();

function context(harness: Awaited<ReturnType<typeof seeded>>): AssetDesignerContext {
	// The real query, over the harness's own repositories — the same join `GetAssetDesign` runs
	// in production, so `dimensions` and `dimensionsUnscaled` are the query's own answers rather
	// than a fixture's guess about what they should be.
	const query = new GetAssetDesignQuery(harness.stack.assets, harness.sidecar);
	return {
		assetId: String(harness.assetId),
		queries: { getAssetDesign: (assetId) => query.execute(assetId as AssetId), listPlansUsingAsset: unwiredPlanUsage },
		commands: { designEdits: () => harness.reversible },
		logger: recorder,
		picker: null,
		vault: emptyBackgroundVault(),
		onDesignChanged: () => () => undefined,
		onThemeChange: () => () => undefined,
		// A source that never fires, rather than one omitted: the member is required precisely so
		// no surface can forget to answer the question, and this suite's cases are not about a file
		// moving under the surface. `backgroundInEditor.test.ts` is where that door is driven.
		onVaultFileChanged: () => () => undefined,
		indexScanCompleted: () => true,
		// Not the dangling state's suite: `assetDesignerRoot.test.ts` is where the tree is asked
		// whether it CALLS this, and `assetDesignerView.test.ts` whether calling it detaches the
		// leaf. Present rather than omitted because the member is required precisely so no surface
		// can forget to answer the question.
		closeLeaf: () => undefined,
	};
}

async function mountDesigner(harness: Awaited<ReturnType<typeof seeded>>) {
	const pinia = createPinia();
	const wrapper = mount(AssetDesignerRoot, {
		global: {
			plugins: [pinia, VueKonva],
			provide: { [ASSET_DESIGNER_CONTEXT as symbol]: context(harness) },
		},
	});
	await flushPromises();
	return { wrapper, dialogs: useDialogStore(pinia) };
}

describe('the designer’s preset dialog', () => {
	it('writes the shape the form submits to the open asset', async () => {
		const harness = await seeded();
		await harness.seed(drawn());
		const { wrapper, dialogs } = await mountDesigner(harness);
		const toilet = ASSET_PRESETS.find((preset) => preset.id === 'toilet');
		if (toilet === undefined) throw new Error('the catalogue has a toilet');
		const shape = expectOk(toilet.build(defaultValues(toilet)));
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue({ action: 'submit', values: shape } as never);

		await wrapper.find('.rp-designer-start-preset').trigger('click');
		await flushPromises();

		expect(vi.mocked(dialogs.openDialog).mock.calls[0][0]).toMatchObject({ kind: 'form', props: { replaces: true } });
		expect((await harness.document()).shape?.details.map((detail) => detail.name)).toEqual(['tank', 'bowl']);
	});

	/**
	 * Spec acceptance criterion "one undo entry": Apply replaces footprint, clearance and details
	 * in ONE history entry, so a single undo brings back the traced outline with no details left.
	 */
	it('takes the whole preset back with one undo', async () => {
		const harness = await seeded();
		await harness.seed(drawn());
		const { wrapper, dialogs } = await mountDesigner(harness);
		const toilet = ASSET_PRESETS.find((preset) => preset.id === 'toilet');
		if (toilet === undefined) throw new Error('the catalogue has a toilet');
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue({ action: 'submit', values: expectOk(toilet.build(defaultValues(toilet))) } as never);
		await wrapper.find('.rp-designer-start-preset').trigger('click');
		await flushPromises();
		expect((await harness.document()).shape?.details).toHaveLength(2);

		const undo = wrapper.findAll('.rp-designer-tools button').find((button) => button.text() === t('en', 'designer.toolbar.undo'));
		await undo?.trigger('click');
		await flushPromises();

		expect((await harness.document()).shape).toEqual(drawn());
	});

	it('opens one picker for two clicks landing before the first dialog closes', async () => {
		const harness = await seeded();
		await harness.seed(drawn());
		const { wrapper, dialogs } = await mountDesigner(harness);
		const open = vi.spyOn(dialogs, 'openDialog');

		const button = wrapper.find('.rp-designer-start-preset');
		await button.trigger('click');
		await button.trigger('click');
		await flushPromises();

		expect(open).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});

	it('writes nothing when the dialog is cancelled', async () => {
		const harness = await seeded();
		await harness.seed(drawn());
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue('cancel' as never);

		await wrapper.find('.rp-designer-start-preset').trigger('click');
		await flushPromises();

		expect((await harness.document()).shape?.footprint.points).toEqual(drawn().footprint.points);
	});
});

/** Shift+1 as a hand presses it, on the canvas itself — `layers.test.ts`'s `pressOnCanvas`. */
function pressFitAll(canvas: HTMLElement): void {
	canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', shiftKey: true, bubbles: true, cancelable: true }));
}

async function applyTree(rig: DesignerRig): Promise<void> {
	const tree = ASSET_PRESETS.find((preset) => preset.id === 'tree');
	if (tree === undefined) throw new Error('the catalogue has a tree');
	vi.spyOn(useDialogStore(rig.pinia), 'openDialog').mockResolvedValue({ action: 'submit', values: expectOk(tree.build(defaultValues(tree))) } as never);
	await rig.wrapper.find('.rp-designer-start-preset').trigger('click');
	await settle();
}

describe('the camera after a preset', () => {
	/**
	 * A preset is centred on the origin at whatever size was typed, so a 15 m tree applied from a
	 * chair-sized view overflows the pane. Apply frames the whole design, and the instrument is
	 * Shift+1 itself: from the camera the leaf had, the shortcut lands exactly where Apply did.
	 */
	it('frames the applied preset exactly as Shift+1 does', async () => {
		const rig = await designerRig({ shape: null });
		const editor = useEditorStore(rig.pinia);
		const before = editor.viewport;

		await applyTree(rig);
		const applied = editor.viewport;
		editor.viewport = before;
		pressFitAll(rig.canvasEl);

		expect(applied).not.toEqual(before);
		expect(applied).toEqual(editor.viewport);
		rig.unmount();
	});

	/** Over a design that exists, so a fit taken regardless of the outcome would move the camera. */
	it('leaves the camera where it was when the write is refused', async () => {
		const rig = await designerRig({ shape: drawn(), unrecoveredSettings: true });
		const editor = useEditorStore(rig.pinia);
		const before = editor.viewport;

		await applyTree(rig);

		expect(editor.viewport).toEqual(before);
		rig.unmount();
	});
});

/**
 * An asset OPENS framed (selection polish critique, finding 1): once, at the canvas's first measured size,
 * exactly as `Shift+1` frames it — and only a design that HAS a shape then. `designerRig`'s
 * `camera: 'opened'` keeps what opening did; every other rig case gets the default camera back.
 */
describe('the camera an asset opens with', () => {
	it('frames an opened design exactly as Shift+1 does', async () => {
		const rig = await designerRig({ shape: toiletShape(), camera: 'opened' });
		const editor = useEditorStore(rig.pinia);
		const opened = editor.viewport;

		pressFitAll(rig.canvasEl);

		expect(opened).not.toEqual(DEFAULT_VIEWPORT);
		expect(editor.viewport).toEqual(opened);
		rig.unmount();
	});

	/**
	 * A GUARD, green before and after: the fit is asked once, at the first measure. A fit that waited for a
	 * shape instead would jump the camera the moment the user's first trace lands, away from the sheet they
	 * were tracing at.
	 */
	it('leaves a shapeless asset where it opened, and does not jump when its first outline is traced', async () => {
		const rig = await designerRig({ shape: null, camera: 'opened' });
		const editor = useEditorStore(rig.pinia);
		expect(editor.viewport).toEqual(DEFAULT_VIEWPORT);

		rig.toolbarButton(t('en', 'designer.toolbar.trace-footprint')).click();
		await settle();
		tracePolygon(rig, [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }]);
		await settle();

		expect((await rig.document()).shape).not.toBeNull();
		expect(editor.viewport).toEqual(DEFAULT_VIEWPORT);
		rig.unmount();
	});
});
