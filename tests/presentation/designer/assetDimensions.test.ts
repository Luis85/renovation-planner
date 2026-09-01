/**
 * @vitest-environment jsdom
 *
 * Task B8's Step 1a: the dimensions dialog reached from BOTH callers — the `noShape` empty
 * state's action, and `DesignerInspector`'s own "Edit dimensions" control once a shape exists —
 * both dispatching `SetAssetFootprintFromDimensions` for the asset already OPEN rather than
 * `NewAssetForm`'s different one.
 *
 * Driven against the REAL `ReversibleAssetDesignCommands` over the in-memory vault
 * (`tests/helpers/assetDesignHarness.ts`), with only the DIALOG faked — a real `openDialog`
 * would need a user to type into a mounted `AssetDimensionsDialog`, which `dialogKinds.test.ts`
 * already covers on its own; this file is about the WIRING, the same split
 * `backgroundPicker.test.ts` draws for Task B7's picker.
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
import { isOk } from '../../../src/core/result/Result';
import { recorder } from '../../helpers/logger';
import { expectOk } from '../../helpers/domain';
import { seeded, drawn } from '../../helpers/assetDesignHarness';
import { emptyBackgroundVault } from '../../helpers/background';
import { installCanvas } from '../../helpers/canvas';
import { installResizeObserver } from '../../helpers/layout';

installCanvas();
installResizeObserver();

/**
 * `selectAssetDesignerEmptyState` answers `noShape` only for a SHAPELESS asset that already
 * has a background (`shape === null && background !== null`) — the harness's own `makeAsset`
 * seeds neither, and every fixture in this file needs the `noShape` state specifically, so the
 * background half is given here rather than left to the selector's other arm, `noBackground`,
 * which `backgroundPicker.test.ts` already owns.
 */
async function withBackground(harness: Awaited<ReturnType<typeof seeded>>): Promise<void> {
	const loaded = expectOk(await harness.stack.assets.getById(harness.assetId));
	if (loaded === null) throw new Error('expected the seeded asset to be present');
	const changed = expectOk(
		loaded.entity.withChanges({ background: { path: 'Specs/oven.png', kind: 'image', page: null } }),
	);
	expectOk(await harness.stack.assets.save(changed, loaded.version));
}

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
		indexScanCompleted: () => true,
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

describe('the designer’s dimensions dialog', () => {
	it('opens the dimensions dialog from the empty state and writes the rectangle to the OPEN asset', async () => {
		const harness = await seeded();
		await harness.seed(null); // no footprint at all
		await withBackground(harness); // and a background, so the state is `noShape` and not `noBackground`
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue({ width: 1200, depth: 800 });
		const setFootprintFromDimensions = vi.spyOn(
			harness.bundle.setFootprintFromDimensions,
			'executeWithVersion',
		);

		await wrapper.find('.rp-empty-state__action').trigger('click');
		await flushPromises();

		expect(dialogs.openDialog).toHaveBeenCalledWith(expect.objectContaining({ kind: 'asset-dimensions' }));
		expect(setFootprintFromDimensions).toHaveBeenCalledWith(
			expect.objectContaining({ assetId: harness.assetId, width: 1200, depth: 800 }),
		);
		// And it really reached the vault, for the same reason `backgroundPicker.test.ts` checks
		// the note rather than trusting the spy alone.
		const stored = expectOk(await harness.sidecar.read(harness.assetId));
		expect(stored.document.shape?.footprint).toEqual({
			points: [
				{ x: -600, y: -400 },
				{ x: 600, y: -400 },
				{ x: 600, y: 400 },
				{ x: -600, y: 400 },
			],
		});
	});

	it('does nothing when the dialog is cancelled', async () => {
		const harness = await seeded();
		await harness.seed(null);
		await withBackground(harness);
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue(null);
		const setFootprintFromDimensions = vi.spyOn(
			harness.bundle.setFootprintFromDimensions,
			'executeWithVersion',
		);

		await wrapper.find('.rp-empty-state__action').trigger('click');
		await flushPromises();

		expect(setFootprintFromDimensions).not.toHaveBeenCalled();
	});

	it('offers the same editor from the inspector once a shape exists', async () => {
		const harness = await seeded();
		await harness.seed(drawn());
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue(null);

		await wrapper.find('.rp-designer-edit-dimensions').trigger('click');
		await flushPromises();

		expect(dialogs.openDialog).toHaveBeenCalledWith(expect.objectContaining({ kind: 'asset-dimensions' }));
	});

	/**
	 * The one worth thinking about rather than copying (the plan's own words): typing dimensions
	 * over a trace replaces measured coordinates with authored ones, so the provenance must
	 * follow, or a later calibration would rescale a rectangle nobody measured (Decision 6).
	 * `drawn()`'s footprint is `footprintOrigin: 'traced'`, `footprintPending: false` — the write
	 * command's own `withFootprint(current, footprint, 'typed', false)` retypes it regardless of
	 * what it replaces, so this is the wiring proof that the real command really is what answers
	 * this gesture end to end.
	 */
	it('retypes a TRACED footprint as typed, since the numbers are now authored rather than measured', async () => {
		const harness = await seeded();
		await harness.seed(drawn());
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue({ width: 1200, depth: 800 });

		await wrapper.find('.rp-designer-edit-dimensions').trigger('click');
		await flushPromises();

		const stored = await harness.sidecar.read(harness.assetId);
		expect(isOk(stored) && stored.value.document.shape?.footprintOrigin).toBe('typed');
		expect(isOk(stored) && stored.value.document.shape?.footprintPending).toBe(false);
	});
});

/**
 * `DesignerInspector.test.ts` drives the height field against a MOCKED `setHeight` prop, which
 * proves the field's own commit/error/reset behaviour without touching a vault at all. This is
 * the wiring proof for the prop itself — `DesignerRuntime.commitHeight`, dispatched through the
 * real `SetAssetHeightCommand` over the harness's own note — the same split the dimensions
 * dialog above draws between its component test and this file's end-to-end one.
 */
describe('the inspector’s height field, wired for real', () => {
	it('writes the height to the OPEN asset’s note through the real command', async () => {
		const harness = await seeded();
		await harness.seed(drawn());
		const { wrapper } = await mountDesigner(harness);

		const input = wrapper.find('input[name="height"]');
		await input.setValue('1300');
		await input.trigger('blur');
		await flushPromises();

		expect(await harness.height()).toBe(1300);
	});
});
