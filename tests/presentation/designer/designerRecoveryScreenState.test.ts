/**
 * @vitest-environment jsdom
 *
 * `docs/tests/cases/Recover an asset design rather than lose it.md` steps 3, 5, 7 and 30, and
 * `docs/tests/cases/Two designers on one asset.md` step 8 — the clauses the audit
 * (`.superpowers/sdd/audit/recover.md`, `.superpowers/sdd/audit/two-designers.md`) found bucket D
 * (no test asserts them at all): after a REFUSED write, nothing else on screen reacts to it (no
 * notice, no failure panel, every mode tool stays live, no dialog opens); a refused write's
 * optimistic preview really clears, so the canvas draws the position the vault still holds; and a
 * design kept on screen after a FAILED re-read keeps its position, its selection and its Inspector
 * fields, not merely the fact that a design object still exists (`designerRefresh.test.ts` and
 * `assetDesignerRoot.test.ts` already cover the latter, at the height field and the notice text
 * alone).
 *
 * The write-boundary refusal is reached through a PEER write racing a live drag
 * (`designerSelection.test.ts`'s own "refuses a drag made against a design a peer rewrote
 * mid-gesture" shape) rather than through the manual case's OS-level `chmod`, which jsdom cannot
 * reproduce. `AssetDesignerRoot`'s render logic (`staleAfterRefresh`, `failure`, the toolbar's
 * button bindings) branches on the design store's `status`/`stale`/`error` fields and never on
 * WHICH refusal code produced them, so a revision-conflict refusal exercises the identical render
 * path step 3's OS refusal would.
 */
import { describe, expect, it } from 'vitest';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import AssetDesignerRoot from '../../../src/presentation/designer/AssetDesignerRoot.vue';
import { ASSET_DESIGNER_CONTEXT, type AssetDesignerContext } from '../../../src/presentation/designer/AssetDesignerContext';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import { err, ok } from '../../../src/core/result/Result';
import { expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { designerRig, held, type DesignerRig } from '../../helpers/designerRig';
import { TOILET, detailOutline, justInsideBottom } from '../../helpers/designerSelection';
import { unavailableAssetDesignerCommands } from '../../../src/presentation/designer/designerCommands';
import { assetDesign, VAULT_FAILED } from '../../helpers/assetDesign';
import { emptyBackgroundVault } from '../../helpers/background';
import { installCanvas } from '../../helpers/canvas';
import { installResizeObserver } from '../../helpers/layout';
import { recorder } from '../../helpers/logger';
import { unwiredPlanUsage } from '../../helpers/designerQueries';

const BOWL = detailOutline('detail-2');
/** Inside the bowl, more than the rig's 80 mm grab radius from every handle. */
const IN_BOWL = justInsideBottom(BOWL);
const MOVED = { x: IN_BOWL.x + 500, y: IN_BOWL.y + 300 };

async function press(rig: DesignerRig, label: StringKey): Promise<void> {
	rig.toolbarButton(t('en', label)).click();
	await settle();
}

/**
 * A write-boundary refusal on THIS leaf's own gesture, reached the way `designerSelection.test.ts`
 * and `designerWriteChain.test.ts` already reach it: a peer's write lands mid-drag, so the release
 * is conditioned on a revision the store no longer holds and `asset-geometry.revision-conflict`
 * refuses it. Held rather than a plain `drag()`, matching Two designers step 8's own "press and
 * hold... without releasing, make a write" — `drag()` cannot leave a press open for that.
 */
async function refuseAHeldDrag(rig: DesignerRig): Promise<void> {
	await press(rig, 'designer.toolbar.select');
	held(rig, 'pointerdown', IN_BOWL, 1);
	held(rig, 'pointermove', MOVED, 1);
	expectOk(await rig.peer.setFacing.execute({ assetId: rig.assetId, facing: 0 }));
	await settle();
	held(rig, 'pointerup', MOVED, 0);
	await settle();
	expect(useSaveStateStore(rig.pinia).state).toBe('save-error');
}

/**
 * Every mode BUTTON outside the history group — `designerRefresh.test.ts`'s AD18-R13 mechanism, at
 * the DOM. `.rp-designer-tool-button` is also worn by `DesignerViewMenu`'s `<summary>`, which has no
 * `disabled` IDL property at all — excluded here by tag rather than by a second class, since a
 * `<summary>` is never one of the "tools" step 3 means.
 */
function modeButtons(rig: DesignerRig) {
	return rig.wrapper
		.findAll('.rp-designer-tools .rp-designer-tool-button')
		.filter((button) => button.element.tagName === 'BUTTON' && button.element.closest('.rp-designer-history') === null);
}

describe('recover.md step 3 — a refused write leaves everything else alone', () => {
	it('draws no notice, no failure panel, and dims no mode tool', async () => {
		const rig = await designerRig({ shape: TOILET });
		await refuseAHeldDrag(rig);

		expect(rig.wrapper.find('.rp-designer-notice').exists()).toBe(false);
		expect(rig.wrapper.find('.rp-view-failure').exists()).toBe(false);
		for (const button of modeButtons(rig)) {
			expect((button.element as HTMLButtonElement).disabled).toBe(false);
			expect(button.attributes('aria-disabled')).not.toBe('true');
		}
		rig.unmount();
	});

	/**
	 * Two designers step 8's own D row: "nothing anywhere is paused, no dialog appears" — the same
	 * peer-write-during-a-held-drag shape that case's own step 8 walks, from leaf B's side.
	 * `DialogHost` (`assetDesignerRoot.test.ts` "mounts a dialog host...") renders NOTHING while
	 * `dialogs.current` is `null`, and nothing on this refusal's path ever opens one.
	 */
	it('opens no dialog (Two designers on one asset, step 8)', async () => {
		const rig = await designerRig({ shape: TOILET });
		await refuseAHeldDrag(rig);

		expect(rig.wrapper.find('.rp-dialog').exists()).toBe(false);
		rig.unmount();
	});
});

describe('recover.md step 5 — the bowl springs back', () => {
	/**
	 * `DesignerSelectTool.commit` clears the gesture's preview whether or not the write landed
	 * (`this.deps.setPreview(null)` outside the `result.ok` check) — that is what makes the CANVAS
	 * spring back rather than only the file on disk. Existing coverage (`designerSelection.test.ts`,
	 * `setAssetFootprint.test.ts`) reads `rig.document()`, the STORED shape; nothing reads the
	 * store's own `preview`/`design`, which is what the canvas actually draws
	 * (`preview ?? design.shape`, per `DesignerLegend.vue`/`DesignerDimensions.vue`'s own comments).
	 */
	it('clears the preview and leaves the design store’s own shape untouched', async () => {
		const rig = await designerRig({ shape: TOILET });
		await refuseAHeldDrag(rig);

		const store = useAssetDesignStore(rig.pinia);
		expect(store.preview).toBeNull();
		const bowl = store.design?.shape?.details.find((detail) => detail.id === 'detail-2')?.outline.points;
		expect(bowl).toHaveLength(BOWL.points.length);
		BOWL.points.forEach((point, index) => {
			expect(bowl?.[index]?.x).toBeCloseTo(point.x, 6);
			expect(bowl?.[index]?.y).toBeCloseTo(point.y, 6);
		});
		rig.unmount();
	});
});

/**
 * Step 7's own context, mirroring `assetDesignerRoot.test.ts`'s `context()` — this file's own copy
 * rather than an import, since that helper is a private module-local function there, not an
 * exported one this file could reuse.
 */
function rootContext(overrides: Partial<AssetDesignerContext> = {}): AssetDesignerContext {
	return {
		assetId: 'asset-01JRECOVER',
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
}

describe('recover.md step 7 — a kept-but-stale design keeps its position, its selection and its Inspector', () => {
	installCanvas();
	installResizeObserver();

	it('keeps the footprint, the selection and the Inspector’s own fields', async () => {
		const pinia = createPinia();
		const ctx = rootContext();
		const wrapper = mount(AssetDesignerRoot, { global: { plugins: [pinia, VueKonva], provide: { [ASSET_DESIGNER_CONTEXT as symbol]: ctx } } });
		await flushPromises();
		const store = useAssetDesignStore(pinia);
		const originalFootprint = store.design?.shape?.footprint;
		expect(originalFootprint).toBeDefined();
		store.select({ kind: 'footprint' });

		await store.hydrate(
			{
				getAssetDesign: () => Promise.resolve(err(VAULT_FAILED)),
				listPlansUsingAsset: unwiredPlanUsage,
			},
			ctx.assetId,
			{ indexScanCompleted: true, keepPreviousOnFailure: true },
		);
		await nextTick();

		// The precondition this clause is ABOUT: a design really is being kept, not blanked.
		expect(wrapper.find('.rp-designer-notice').exists()).toBe(true);
		expect(wrapper.find('.rp-view-failure').exists()).toBe(false);

		expect(store.design?.shape?.footprint).toEqual(originalFootprint);
		expect(store.selection).toEqual({ kind: 'footprint' });
		expect(wrapper.find('.rp-designer-inspector-fields dd').text()).toBe('1200 × 800 mm');
		expect((wrapper.find('input[name="height"]').element as HTMLInputElement).value).toBe('900');

		wrapper.unmount();
	});
});
