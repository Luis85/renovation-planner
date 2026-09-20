/**
 * @vitest-environment jsdom
 *
 * AD18 item 2's header — AD06 implementation item 1, re-opened because AD06 was marked integrated
 * without it. The four things it carries: which asset this leaf is editing, the way back to the
 * catalogue, whether the work is saved, and the way into a plan.
 *
 * **The cases about the NAME and the library door were moved here from
 * `designerInspector.test.ts`, not copied.** Ruling AD18-R1 moved both controls out of that panel,
 * and a case left behind asserting the Inspector still draws them would have been the second answer
 * to one question that the ruling exists to prevent.
 *
 * `designerUsePlan.test.ts` owns the Use-in-plan control's own predicate and its wiring through the
 * real root; nothing here re-states either. What this file adds about it is only that the header is
 * where it now lives.
 */
import { describe, expect, it, vi } from 'vitest';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import { flushPromises, mount } from '@vue/test-utils';
import DesignerHeader from '../../../src/presentation/designer/DesignerHeader.vue';
import AssetDesignerRoot from '../../../src/presentation/designer/AssetDesignerRoot.vue';
import {
	ASSET_DESIGNER_CONTEXT,
	type AssetDesignerContext,
} from '../../../src/presentation/designer/AssetDesignerContext';
import { unavailableAssetDesignerCommands } from '../../../src/presentation/designer/designerCommands';
import { ok } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import { assetDesign } from '../../helpers/assetDesign';
import { emptyBackgroundVault } from '../../helpers/background';
import { installCanvas } from '../../helpers/canvas';
import { installResizeObserver } from '../../helpers/layout';
import { recorder } from '../../helpers/logger';
import { unwiredPlanUsage } from '../../helpers/designerQueries';

/** The root mounts a real Konva stage and an `EditorSurface`; jsdom supplies neither. */
installCanvas();
installResizeObserver();

/**
 * `SaveStateIndicator` reads the leaf's own Pinia store, so every mount needs one — which is also
 * what makes the save-state case below meaningful rather than a check on a stub.
 */
function mountHeader(props: Partial<InstanceType<typeof DesignerHeader>['$props']> = {}) {
	return mount(DesignerHeader, {
		props: { design: assetDesign(), ...props },
		global: { plugins: [createPinia()] },
	});
}

function mountRoot(overrides: Partial<AssetDesignerContext> = {}) {
	const context: AssetDesignerContext = {
		assetId: assetDesign().assetId,
		queries: { getAssetDesign: () => Promise.resolve(ok(assetDesign())), listPlansUsingAsset: unwiredPlanUsage },
		commands: unavailableAssetDesignerCommands(),
		logger: recorder,
		picker: null,
		vault: emptyBackgroundVault(),
		onDesignChanged: () => () => undefined,
		onThemeChange: () => () => undefined,
		onVaultFileChanged: () => () => undefined,
		indexScanCompleted: () => true,
		closeLeaf: () => undefined,
		...overrides,
	};
	return mount(AssetDesignerRoot, {
		global: { plugins: [createPinia(), VueKonva], provide: { [ASSET_DESIGNER_CONTEXT as symbol]: context } },
	});
}

describe('the designer header', () => {
	it('names the asset it is designing', () => {
		expect(mountHeader().find('.rp-designer-asset-name').text()).toBe('Base cabinet 600');
	});

	/**
	 * A heading rather than a paragraph, which the Inspector's copy was. This surface had no `<h1>`
	 * at all, so its outline began at the panels' `<h2>`s; the asset is what the whole leaf is
	 * about, and naming it as the first heading is what makes the rest read as its sections.
	 */
	it('names it as this surface’s first heading', () => {
		expect(mountHeader().find('.rp-designer-asset-name').element.tagName).toBe('H1');
	});

	it('offers the library door, and calls it', async () => {
		const openLibrary = vi.fn<() => void>();
		const wrapper = mountHeader({ openLibrary });

		await wrapper.find('.rp-designer-open-library').trigger('click');

		expect(openLibrary).toHaveBeenCalledTimes(1);
	});

	/** Slice 14's Amendment 1: no door bound, no control — never a live one that does nothing. */
	it('draws no library control where no door is bound', () => {
		expect(mountHeader().find('.rp-designer-open-library').exists()).toBe(false);
	});

	/**
	 * **The save state is OUTSIDE the design gate and the other three are inside it**, which is the
	 * whole reason this component takes a nullable design rather than being drawn behind a `v-if`
	 * the way the Parts and Inspector regions are. A leaf whose read is in flight or refused has no
	 * name to state and no asset to take into a plan; it still has a save state, and it drew one
	 * from the status region before AD18 moved it up here.
	 */
	it('states the save state for a leaf with no design, and names no asset', () => {
		const wrapper = mountHeader({ design: null });

		expect(wrapper.find('.rp-save-state-label').exists()).toBe(true);
		expect(wrapper.find('.rp-designer-asset-name').exists()).toBe(false);
		expect(wrapper.find('[data-rp-action="use-in-plan"]').exists()).toBe(false);
	});

	it('labels the library door from the locale rather than from a literal', () => {
		expect(mountHeader({ openLibrary: () => undefined }).find('.rp-designer-open-library').text())
			.toBe(t('en', 'designer.inspector.open-library'));
	});
});

/**
 * **AD18-R1's actual guarantee, asked at the forbidden thing rather than of the two components in
 * turn.** The ruling is not "the header draws the name" — it is that ONE place does. A case that
 * only asserted the header drew one would stay green on the day somebody restores the Inspector's
 * copy, which is precisely the failure the ruling was taken to prevent.
 */
describe('one answer to “which asset is this”', () => {
	it('names the asset exactly once in the whole mounted designer, in the header region', async () => {
		const wrapper = mountRoot();
		await flushPromises();

		const named = wrapper.element.querySelectorAll('.rp-designer-asset-name');
		expect(named).toHaveLength(1);
		expect(wrapper.element.querySelector('.rp-designer-header .rp-designer-asset-name')).not.toBeNull();
	});

	/**
	 * And the same for the save state, which moved the same way and for the same reason: two
	 * indicators reading one store are two answers to "is my work safe".
	 */
	it('states the save state exactly once, in the header region', async () => {
		const wrapper = mountRoot();
		await flushPromises();

		expect(wrapper.element.querySelectorAll('.rp-save-state-label')).toHaveLength(1);
		expect(wrapper.element.querySelector('.rp-designer-header .rp-save-state-label')).not.toBeNull();
	});
});
