/**
 * @vitest-environment jsdom
 *
 * AD13's "Use in plan" control: the predicate that decides whether it is drawn at all, and the
 * WIRING that carries the door from the leaf's context down to it.
 *
 * Two halves on purpose, and the second is the one this repository has paid for. An optional prop
 * with a permissive default that the root never binds is invisible to every gate — the
 * `lockedGraphics` defect, shipped for a commit — so the binding is asserted through the REAL
 * `AssetDesignerRoot` with a real context, not by mounting the leaf component alone and trusting
 * that somebody wired it.
 *
 * `assetDesignerUsePlan.test.ts` is where the door this calls decides which plan and opens it;
 * nothing here knows a workspace exists.
 */
import { describe, expect, it, vi } from 'vitest';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import AssetDesignerRoot from '../../../src/presentation/designer/AssetDesignerRoot.vue';
import DesignerUsePlan from '../../../src/presentation/designer/inspector/DesignerUsePlan.vue';
import {
	ASSET_DESIGNER_CONTEXT,
	type AssetDesignerContext,
} from '../../../src/presentation/designer/AssetDesignerContext';
import { unavailableAssetDesignerCommands } from '../../../src/presentation/designer/designerCommands';
import { ok } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import type { AssetDesignDto } from '../../../src/application/queries/GetAssetDesign';
import { assetDesign } from '../../helpers/assetDesign';
import { emptyBackgroundVault } from '../../helpers/background';
import { installCanvas } from '../../helpers/canvas';
import { installResizeObserver } from '../../helpers/layout';
import { recorder } from '../../helpers/logger';

/** The root mounts a real Konva stage and an `EditorSurface`; jsdom supplies neither. */
installCanvas();
installResizeObserver();

/**
 * The control, found under an optional ancestor selector.
 *
 * A template literal rather than a bare constant handed to `wrapper.find(...)`:
 * `unicorn/no-array-callback-reference` reads an identifier in that position as a function
 * reference passed to `Array.prototype.find` and fails the build — measured, five times in this
 * file's first draft.
 */
const control = (wrapper: VueWrapper, within = ''): ReturnType<VueWrapper['find']> =>
	wrapper.find(`${within}[data-rp-action="use-in-plan"]`);

/**
 * A design in whichever of `assetShapeAnswer`'s three states a case wants. `dimensions: null` is
 * `no-shape`; `dimensionsUnscaled: true` is a footprint still in background pixels, which is
 * `unscaled`; the fixture's own 1200×800 pair with neither flag is `placeable`.
 */
function design(options: { readonly dimensions?: null; readonly unscaled?: boolean } = {}): AssetDesignDto {
	const base = assetDesign();
	return {
		...base,
		dimensions: options.dimensions === null ? null : base.dimensions,
		dimensionsUnscaled: options.unscaled ?? base.dimensionsUnscaled,
	};
}

function mountControl(options: Parameters<typeof design>[0] = {}, usePlan?: () => void): VueWrapper {
	return mount(DesignerUsePlan, {
		props: { design: design(options), ...(usePlan === undefined ? {} : { usePlan }) },
	});
}

function mountRoot(usePlan?: () => void): VueWrapper {
	const context: AssetDesignerContext = {
		assetId: 'asset-01JABC',
		queries: { getAssetDesign: () => Promise.resolve(ok(design())) },
		commands: unavailableAssetDesignerCommands(),
		logger: recorder,
		picker: null,
		vault: emptyBackgroundVault(),
		onDesignChanged: () => () => undefined,
		onThemeChange: () => () => undefined,
		onVaultFileChanged: () => () => undefined,
		indexScanCompleted: () => true,
		closeLeaf: () => undefined,
		...(usePlan === undefined ? {} : { usePlan }),
	};
	return mount(AssetDesignerRoot, {
		global: { plugins: [createPinia(), VueKonva], provide: { [ASSET_DESIGNER_CONTEXT as symbol]: context } },
	});
}

describe('use in plan', () => {
	it('is drawn, and labelled, for a placeable asset behind a bound door', () => {
		const wrapper = mountControl({}, () => undefined);

		expect(control(wrapper).text()).toBe(t('en', 'designer.inspector.use-in-plan'));
	});

	it('reaches the door it was handed', async () => {
		const usePlan = vi.fn<() => void>();
		const wrapper = mountControl({}, usePlan);

		await control(wrapper).trigger('click');

		expect(usePlan).toHaveBeenCalledTimes(1);
	});

	/**
	 * Slice 14's Amendment 1, met here: a surface with no navigation composed behind it draws no
	 * control rather than a live one that does nothing. The browser harness and every component
	 * suite ARE that surface.
	 */
	it('is not drawn at all where no door is bound', () => {
		expect(control(mountControl()).exists()).toBe(false);
	});

	/**
	 * The two states `assetShapeAnswer` refuses. A control drawn here could only ever produce
	 * `editor.asset.no-shape` or `editor.asset.unscaled` — the drawn-but-can-only-refuse defect
	 * this expansion has shipped three times, and the reason the answer is a predicate and never
	 * `:disabled`.
	 */
	it.each([
		['an asset with no footprint', { dimensions: null } as const],
		['a footprint still in background pixels', { unscaled: true } as const],
	])('is not drawn for %s', (_name, options) => {
		expect(control(mountControl(options, () => undefined)).exists()).toBe(false);
	});

	/**
	 * **The BINDING, through the real root.** A prop the root never passes is a control that is
	 * never drawn, with every gate green and a person the only thing that could notice — measured
	 * on this very surface once, by `DesignerInspector.lockedGraphics`. So the door goes into the
	 * leaf's own context and the assertion is made on what the mounted tree draws.
	 */
	it('is carried from the leaf context through the root to the inspector', async () => {
		const usePlan = vi.fn<() => void>();
		const wrapper = mountRoot(usePlan);
		await flushPromises();

		const found = control(wrapper, '.rp-designer-inspector ');
		expect(found.exists()).toBe(true);
		await found.trigger('click');

		expect(usePlan).toHaveBeenCalledTimes(1);
	});

	/** And the same tree with no door composed draws none — the harness's own state. */
	it('is absent from the mounted designer when the context carries no door', async () => {
		const wrapper = mountRoot();
		await flushPromises();

		expect(control(wrapper).exists()).toBe(false);
	});
});
