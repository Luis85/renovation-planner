/**
 * @vitest-environment jsdom
 *
 * Task B7's `BackgroundPicker` port, reached from the `noBackground` empty state's action —
 * the third case in the plan's own list is why this port exists at all: `presentation/` has no
 * way to reach Obsidian's own file suggester from inside the Vue tree, so a bound port is the
 * only door.
 *
 * Driven against the REAL `ReversibleAssetDesignCommands` over the in-memory vault
 * (`tests/helpers/assetDesignHarness.ts`, shared with the reversible-adapter suites), with only
 * the PICKER faked — Obsidian's `FuzzySuggestModal` cannot run in jsdom at all, which is exactly
 * the boundary a bound port exists to draw. A spy on the underlying command's own
 * `executeWithVersion` is what "stores what it returns" is asserted against, so a case here is
 * a claim about what actually reached the vault rather than about a mock's own bookkeeping.
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
import type { BackgroundPicker } from '../../../src/presentation/designer/ports';
import { ok } from '../../../src/core/result/Result';
import { recorder } from '../../helpers/logger';
import { expectOk } from '../../helpers/domain';
import { seeded } from '../../helpers/assetDesignHarness';
import { emptyBackgroundVault } from '../../helpers/background';
import { installCanvas } from '../../helpers/canvas';
import { installResizeObserver } from '../../helpers/layout';

installCanvas();
installResizeObserver();

function context(
	harness: Awaited<ReturnType<typeof seeded>>,
	picker: BackgroundPicker | null,
): AssetDesignerContext {
	return {
		assetId: String(harness.assetId),
		// A shapeless, background-less asset — the ONLY state `selectAssetDesignerEmptyState`
		// answers `noBackground` for — read through the real query over the harness's own
		// stack, so the empty state this suite drives is the one a real vault would draw.
		queries: {
			getAssetDesign: async () => {
				const document = await harness.document();
				const asset = expectOk(await harness.stack.assets.getById(harness.assetId));
				if (asset === null) throw new Error('expected the seeded asset to be present');
				return ok({
					assetId: harness.assetId,
					name: asset.entity.name,
					height: asset.entity.height,
					background: asset.entity.background,
					calibration: document.calibration,
					shape: document.shape,
					dimensions: null,
					dimensionsUnscaled: false,
					noteVersion: asset.version,
					geometryVersion: await harness.geometryVersion(),
				});
			},
		},
		commands: { designEdits: () => harness.reversible },
		logger: recorder,
		picker,
		// Empty on purpose: this suite is about the PICK, and the file it picks
		// (`Specs/oven.pdf`) is a path no fixture ever wrote — so the layer answers
		// `unavailable/missing` for it either way and no assertion here reads a raster.
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

async function mountDesigner(options: { readonly picker: BackgroundPicker | null }) {
	const harness = await seeded();
	const pinia = createPinia();
	const wrapper = mount(AssetDesignerRoot, {
		global: {
			plugins: [pinia, VueKonva],
			provide: { [ASSET_DESIGNER_CONTEXT as symbol]: context(harness, options.picker) },
		},
	});
	await flushPromises();
	return { wrapper, harness };
}

describe('the designer’s background picker', () => {
	/**
	 * Slice 14's Amendment 1, applied to a picker rather than to a form: a button whose picker
	 * is unbound would be a live control that does nothing the moment it were pressed.
	 */
	it('draws no background button when no picker is bound, rather than a control that does nothing', async () => {
		const { wrapper } = await mountDesigner({ picker: null });

		expect(wrapper.find('.rp-empty-state__action').exists()).toBe(false);
	});

	it('opens the picker from the empty state action and stores what it returns', async () => {
		const picker: BackgroundPicker = { pick: vi.fn<BackgroundPicker['pick']>() };
		vi.mocked(picker.pick).mockResolvedValue({ path: 'Specs/oven.pdf', kind: 'pdf', page: 1 });
		const { wrapper, harness } = await mountDesigner({ picker });
		const setBackground = vi.spyOn(harness.bundle.setBackground, 'executeWithVersion');

		await wrapper.find('.rp-empty-state__action').trigger('click');
		await flushPromises();

		expect(picker.pick).toHaveBeenCalled();
		expect(setBackground).toHaveBeenCalledWith(expect.objectContaining({ path: 'Specs/oven.pdf' }));
		// And it really reached the vault — the note carries what the picker returned, not
		// merely what the spy recorded being asked for.
		const stored = expectOk(await harness.stack.assets.getById(harness.assetId));
		expect(stored?.entity.background).toEqual({ path: 'Specs/oven.pdf', kind: 'pdf', page: 1 });
	});

	it('does nothing when the picker is cancelled', async () => {
		const picker: BackgroundPicker = { pick: vi.fn<BackgroundPicker['pick']>() };
		vi.mocked(picker.pick).mockResolvedValue(null);
		const { wrapper, harness } = await mountDesigner({ picker });
		const setBackground = vi.spyOn(harness.bundle.setBackground, 'executeWithVersion');

		await wrapper.find('.rp-empty-state__action').trigger('click');
		await flushPromises();

		expect(setBackground).not.toHaveBeenCalled();
	});

	/**
	 * The defensive guard `onEmptyStateAction` itself keeps, for a picker that becomes unbound
	 * between the render that drew the button and the click on it — `context` is a plain object
	 * held by reference, not a reactive one, so mutating it here does not itself repaint the
	 * DOM; the click still lands on the button `overlay`'s earlier evaluation already drew.
	 */
	it('does nothing if the picker is unbound by the time the click is handled', async () => {
		const picker: BackgroundPicker = { pick: vi.fn<BackgroundPicker['pick']>() };
		const harness = await seeded();
		const pinia = createPinia();
		const ctx = context(harness, picker);
		const wrapper = mount(AssetDesignerRoot, {
			global: { plugins: [pinia, VueKonva], provide: { [ASSET_DESIGNER_CONTEXT as symbol]: ctx } },
		});
		await flushPromises();
		expect(wrapper.find('.rp-empty-state__action').exists()).toBe(true);

		(ctx as { picker: BackgroundPicker | null }).picker = null;
		await wrapper.find('.rp-empty-state__action').trigger('click');
		await flushPromises();

		expect(picker.pick).not.toHaveBeenCalled();
	});
});
