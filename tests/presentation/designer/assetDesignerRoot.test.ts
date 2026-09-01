/**
 * @vitest-environment jsdom
 *
 * The designer's root component, in isolation — its REGIONS above all.
 *
 * This file exists because of a gap a reviewer found in the increment plan: Task B3 is the only
 * task that writes `AssetDesignerRoot.vue`, while Task B4 only CREATES `DesignerCanvas.vue`,
 * Task B5 a toolbar and Task B8 `DesignerInspector.vue`. Nothing downstream says "mount it", so
 * followed literally the plan ships three components with three green suites and no surface —
 * this repository's recorded slice-7 defect, where a tool registered by nothing was invisible
 * to all four gates because nothing was wrong with the code.
 *
 * TWO instruments answer it and they catch different mistakes. `regionsReachable.test.ts` walks
 * the real import graph and fails when a designer component exists that the view cannot reach.
 * This file fails when a REGION disappears — which the graph walk cannot see, because a
 * component can stay reachable through some other import while the place it drew is gone.
 * Neither alone is enough, and each names the other.
 */
import { describe, expect, it } from 'vitest';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import AssetDesignerRoot from '../../../src/presentation/designer/AssetDesignerRoot.vue';
import {
	ASSET_DESIGNER_CONTEXT,
	useAssetDesignerContext,
	type AssetDesignerContext,
} from '../../../src/presentation/designer/AssetDesignerContext';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';
import { unavailableAssetDesignerQueries } from '../../../src/presentation/read-models/assetDesignerQueries';
import { err, ok } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import { EMPTY_STATE_CONTENT } from '../../../src/presentation/emptyStates/content';
import { assetDesign } from '../../helpers/assetDesign';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { recorder } from '../../helpers/logger';
import { unavailableAssetDesignerCommands } from '../../../src/presentation/designer/designerCommands';
import { installCanvas } from '../../helpers/canvas';
import { installResizeObserver } from '../../helpers/layout';

/**
 * The canvas region holds a real Konva stage since Task B4, so this file mounts one: jsdom has
 * no 2D context and no `ResizeObserver`, and `EditorSurface` constructs the second at mount.
 * `VueKonva` is registered on the test's own app below because `mount` builds it — the real
 * `AssetDesignerView` registers it on the app it creates, which is what
 * `assetDesignerView.test.ts` covers.
 */
installCanvas();
installResizeObserver();

const ASSET_ID = 'asset-01JABC';

function context(overrides: Partial<AssetDesignerContext> = {}): AssetDesignerContext {
	return {
		assetId: ASSET_ID,
		queries: { getAssetDesign: () => Promise.resolve(ok(assetDesign())) },
		commands: unavailableAssetDesignerCommands(),
		logger: recorder,
		// A subscription that delivers nothing and disposes cleanly: this file is about what the
		// shell DRAWS, and `designerRefresh.test.ts` is where the source is driven.
		onDesignChanged: () => () => undefined,
		// The scan has run, so a miss here is authoritative and the failure cases below mean what
		// their names say — a leaf reading before the scan holds its loading line instead, which
		// is `designerRefresh.test.ts`'s restored-leaf case.
		indexScanCompleted: () => true,
		...overrides,
	};
}

async function mounted(ctx: AssetDesignerContext = context()) {
	const pinia = createPinia();
	const wrapper = mount(AssetDesignerRoot, {
		global: { plugins: [pinia, VueKonva], provide: { [ASSET_DESIGNER_CONTEXT as symbol]: ctx } },
	});
	await flushPromises();
	return { wrapper, pinia };
}

/**
 * The shell, as a list rather than four `it`s, and each entry says WHO fills it. A region added
 * to the root without appearing here is a region no test names; a region dropped from the root
 * fails here by name rather than as an anonymous missing selector.
 */
const REGIONS = [
	['.rp-designer-toolbar', 'Task B5 mounts the designer toolbar into it'],
	['.rp-designer-canvas', 'Task B4 mounts DesignerCanvas into it'],
	['.rp-designer-inspector', 'Task B8 mounts DesignerInspector into it'],
	['.rp-designer-status', 'the save-state indicator draws in it, from this task'],
] as const;

describe('the designer shell', () => {
	it('renders the element the stylesheet keys off', async () => {
		const { wrapper } = await mounted();

		expect(wrapper.classes()).toContain('renovation-asset-designer');
	});

	// `element.querySelector` rather than `wrapper.find`: oxlint's `no-array-callback-reference`
	// reads `.find(selector)` on any receiver as a function reference handed to `Array#find`, and
	// a variable selector is exactly the shape that trips it. The literal-selector cases below
	// keep `wrapper.find`, where the rule has nothing to object to.
	it.each(REGIONS)('draws %s, because %s', async (selector) => {
		const { wrapper } = await mounted();

		expect(wrapper.element.querySelector(selector)).not.toBeNull();
	});

	/**
	 * The regions survive a FAILED read too, and that is the half a reader would not predict:
	 * the failure replaces what is inside the canvas region, never the shell around it — so a
	 * later task's toolbar and inspector do not vanish because one query refused.
	 */
	it('keeps every region when the read refuses', async () => {
		const { wrapper } = await mounted(context({ queries: unavailableAssetDesignerQueries() }));

		for (const [selector] of REGIONS) expect(wrapper.element.querySelector(selector)).not.toBeNull();
	});

	/**
	 * Slice 13's indicator, in THIS shell too — one per designer leaf, because it reads the
	 * leaf's own Pinia store and two open designers must indicate independently.
	 */
	it('draws the save-state indicator in its status region', async () => {
		const { wrapper } = await mounted();

		expect(wrapper.find('.rp-designer-status .rp-save-state-label').exists()).toBe(true);
	});

	/**
	 * Slice 15's host, mounted in this app as well as the other two.
	 *
	 * Driven by opening a plain `confirm` through the leaf's own store, exactly as
	 * `viewRoot.test.ts` does, rather than by looking for a container element: `DialogHost`'s
	 * whole template sits behind `v-if="current !== null"`, so an idle host renders a comment
	 * placeholder and NO element at all — which is why the increment plan's own snippet for this,
	 * `querySelector('.rp-dialog-host')`, cannot pass against the component this plugin has. No
	 * such class exists anywhere in `src/`.
	 */
	it('mounts a dialog host that the designer can open a dialog through', async () => {
		const { wrapper, pinia } = await mounted();
		const store = useDialogStore(pinia);

		void store.openDialog({ kind: 'confirm', title: 'T', message: 'M' });
		await nextTick();

		expect(wrapper.find('.rp-dialog').exists()).toBe(true);
	});
});

describe('what the designer draws inside its canvas region', () => {
	/**
	 * An OVERLAY inside the canvas region, never a replacement for it — slice 14's rule, and the
	 * assertion is the CONTAINMENT rather than the presence: an empty state that replaced the
	 * region would satisfy `find('.rp-empty-state')` just as well while hiding the one thing the
	 * region exists to show.
	 */
	it('overlays the no-shape empty state inside the canvas, never in place of it', async () => {
		const { wrapper } = await mounted(
			context({ queries: { getAssetDesign: () => Promise.resolve(ok(assetDesign({ shape: null }))) } }),
		);

		const overlay = wrapper.find('.rp-designer-canvas .rp-empty-state');
		expect(overlay.exists()).toBe(true);
		expect(overlay.classes()).toContain('rp-empty-state--overlay');
		expect(overlay.text()).toContain(t('en', EMPTY_STATE_CONTENT.assetDesigner.noShape.headline));
	});

	/**
	 * And BUTTONLESS, asserted where it is rendered rather than only in the registry. The
	 * registry case proves no label is declared; this proves nothing draws a control anyway.
	 * Task B8 builds the dimensions form this hands off to and flips this assertion then.
	 */
	it('draws no action button on the no-shape state, because Task B8 builds what it hands off to', async () => {
		const { wrapper } = await mounted(
			context({ queries: { getAssetDesign: () => Promise.resolve(ok(assetDesign({ shape: null }))) } }),
		);

		expect(wrapper.find('.rp-empty-state__action').exists()).toBe(false);
	});

	it('overlays nothing once the asset has a shape', async () => {
		const { wrapper } = await mounted();

		expect(wrapper.find('.rp-empty-state').exists()).toBe(false);
	});

	/**
	 * A failed read is NOT an empty state, which is slice 17's whole objection to reusing one:
	 * "draw your first footprint" shown because the vault could not be read is actively
	 * misleading. Both halves, because a build that drew both would pass either alone.
	 */
	it('draws a failure and no empty state when the read refuses', async () => {
		const { wrapper } = await mounted(
			context({
				queries: {
					getAssetDesign: () =>
						Promise.resolve(err({ category: 'Persistence' as const, code: 'vault.unexpected-failure', message: 'x' })),
				},
			}),
		);

		expect(wrapper.find('.rp-designer-canvas .rp-view-failure').exists()).toBe(true);
		expect(wrapper.find('.rp-empty-state').exists()).toBe(false);
	});

	/**
	 * The retry re-runs the read, and a second answer replaces the failure. Asserted as a
	 * BEHAVIOUR rather than as a click count: a button that dispatched nothing would be the live
	 * control that does nothing slice 14's Amendment 1 refuses.
	 */
	it('re-reads when the retry is pressed, and draws what the second read answered', async () => {
		let attempt = 0;
		const { wrapper } = await mounted(
			context({
				queries: {
					getAssetDesign: () => {
						attempt += 1;
						return attempt === 1
							? Promise.resolve(err({ category: 'Persistence' as const, code: 'vault.unexpected-failure', message: 'x' }))
							: Promise.resolve(ok(assetDesign({ shape: null })));
					},
				},
			}),
		);

		await wrapper.find('.rp-view-failure__action').trigger('click');
		await flushPromises();

		expect(attempt).toBe(2);
		expect(wrapper.find('.rp-view-failure').exists()).toBe(false);
		expect(wrapper.find('.rp-designer-canvas .rp-empty-state').exists()).toBe(true);
	});

	/**
	 * A bootstrap failure gets NO retry: the composition root wired no query service at all, so
	 * re-running one does nothing while looking like it might. The same `viewHydrationOrigin`
	 * distinction both other views already make, and a single case would not have discriminated
	 * — a build that offered a retry to every failure passes the case above.
	 */
	it('withholds the retry from a bootstrap failure, which has nothing to re-run', async () => {
		const { wrapper } = await mounted(context({ queries: unavailableAssetDesignerQueries() }));

		expect(wrapper.find('.rp-view-failure').exists()).toBe(true);
		expect(wrapper.find('.rp-view-failure__action').exists()).toBe(false);
	});
});

/**
 * The read-back after a committed command keeps the previous design when it fails
 * (`keepPreviousOnFailure`), so the canvas goes on drawing content that is real and may be out
 * of date. Slice 17's rule: a view showing valid-but-STALE data is not a view that failed, so
 * the failure panel is the wrong surface and an additive strip is the right one.
 */
describe('a design the canvas can no longer confirm', () => {
	it('draws an additive stale strip rather than replacing the design it cannot re-read', async () => {
		const pinia = createPinia();
		const wrapper = mount(AssetDesignerRoot, {
			global: { plugins: [pinia, VueKonva], provide: { [ASSET_DESIGNER_CONTEXT as symbol]: context() } },
		});
		await flushPromises();
		const store = useAssetDesignStore(pinia);

		await store.hydrate(
			{
				getAssetDesign: () =>
					Promise.resolve(err({ category: 'Persistence' as const, code: 'vault.unexpected-failure', message: 'x' })),
			},
			ASSET_ID,
			{ indexScanCompleted: true, keepPreviousOnFailure: true },
		);
		await nextTick();

		expect(wrapper.find('.rp-designer-notice').text()).toBe(t('en', 'designer.refresh-failed'));
		// BOTH halves: a build that replaced the canvas with the failure panel would satisfy the
		// strip's absence just as well as one that reported nothing at all.
		expect(wrapper.find('.rp-view-failure').exists()).toBe(false);
	});
});

describe('the asset designer context guard', () => {
	/**
	 * Mirrors `usePlanEditorContext`'s and `useRenovationProjectContext`'s: there is no sensible
	 * degraded behaviour for a designer with no asset id and no query service — it would mount,
	 * draw nothing, and look exactly like an asset nobody has designed yet.
	 */
	it('throws rather than mounting a designer with nothing behind it', () => {
		expect(() => useAssetDesignerContext()).toThrow(/AssetDesignerContext/);
	});
});
