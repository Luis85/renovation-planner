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

installCanvas();
installResizeObserver();

function context(harness: Awaited<ReturnType<typeof seeded>>): AssetDesignerContext {
	// The real query, over the harness's own repositories — the same join `GetAssetDesign` runs
	// in production, so `dimensions` and `dimensionsUnscaled` are the query's own answers rather
	// than a fixture's guess about what they should be.
	const query = new GetAssetDesignQuery(harness.stack.assets, harness.sidecar);
	return {
		assetId: String(harness.assetId),
		queries: { getAssetDesign: (assetId) => query.execute(assetId as AssetId) },
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
