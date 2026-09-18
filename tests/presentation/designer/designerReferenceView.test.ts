/**
 * @vitest-environment jsdom
 *
 * The reference as a VIEW preference and as a REMOVABLE thing — AD12-R1's opacity and AD12-R2's
 * delete, which are one subject: what a leaf may decide about the sheet without writing anything,
 * and the one thing about it that does write.
 *
 * **The opacity cases assert the SCENE, never the prop this codebase passed.** That is
 * `designerBackground.test.ts`'s own rule, and it is the rule that matters most here: the control
 * is in the View menu, the value is a ref on the runtime, and the picture is a Konva layer three
 * components away — a case that read back `DesignerCanvas`'s own `:opacity` would pass against a
 * layer that never dimmed.
 *
 * **Nobody has LOOKED at a faded sheet.** Opacity is a visual property and this environment has
 * no Obsidian and no pinned Chromium, so what is verified here is the number on the layer node and
 * not the appearance of anything. That is stated rather than implied.
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type Konva from 'konva';
import DesignerReferenceStatus from '../../../src/presentation/designer/inspector/DesignerReferenceStatus.vue';
import { editorViewPreferencesStore } from '../../../src/infrastructure/obsidian/plugin-data/editorViewPreferencesStore';
import { t } from '../../../src/presentation/i18n/strings';
import { toiletShape } from '../../helpers/assetShapes';
import { assetDesign } from '../../helpers/assetDesign';
import { settle } from '../../helpers/editor';
import { designerRig } from '../../helpers/designerRig';
import { recorder } from '../../helpers/logger';

/**
 * A function rather than a bare selector constant, because `wrapper.find(CONSTANT)` reads to
 * `unicorn/no-array-callback-reference` as a function reference handed to `Array.prototype.find`.
 */
const remove = (wrapper: VueWrapper, within = ''): ReturnType<VueWrapper['find']> => wrapper.find(`${within}[name="remove-reference"]`);
const OPACITY = '.rp-designer-tools [data-rp-view="reference-opacity"]';

/** The background LAYER node, which is what an opacity applies to — not the image inside it. */
function backgroundLayer(stage: Konva.Stage): Konva.Layer {
	const layer = stage.findOne<Konva.Layer>('.asset-background');
	if (layer === undefined) throw new Error('the designer drew no background layer');
	return layer;
}

describe('the reference’s opacity', () => {
	/**
	 * **The floor is asserted here and enforced by `min` alone**, which is the whole of what holds
	 * it: `backgroundOpacity` is an unclamped `Ref<number>`, so anything reaching it past the
	 * control could set 0. That is acceptable because the control is the only writer, and it is
	 * asserted because otherwise the floor is a number in a template nothing reads. Why 0.1 and
	 * not 0: a fully transparent sheet is indistinguishable from one that failed to load, and this
	 * surface's two background notices would then be describing a picture nobody can see.
	 */
	it('fades the background layer the whole way down to the control’s floor', async () => {
		const rig = await designerRig({ shape: toiletShape(), background: true });
		try {
			expect(backgroundLayer(rig.stage).opacity()).toBe(1);
			expect(rig.wrapper.get(OPACITY).attributes('min')).toBe('0.1');

			await rig.wrapper.get(OPACITY).setValue('0.1');

			expect(backgroundLayer(rig.stage).opacity()).toBeCloseTo(0.1);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * The predicate rule, not a `:disabled`: an opacity control over no sheet is the live control
	 * that does nothing, which is the shape AD12-R1 exists because of.
	 */
	it('is not drawn at all for an asset with no sheet', async () => {
		const rig = await designerRig({ shape: toiletShape() });
		try {
			expect(rig.wrapper.find(OPACITY).exists()).toBe(false);
			expect(rig.wrapper.find('.rp-designer-tools [data-rp-view="grid"]').exists()).toBe(true);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * **Written NOWHERE** — the structural half of AD12-R1, and `PartView`'s own guarantee. It is
	 * not a command, so the sidecar document is byte-identical afterwards; and it is not one of the
	 * two remembered choices either, so this device's stored preferences do not gain a third key.
	 * Both halves, because either one alone would pass while the other leaked.
	 *
	 * **Only the PREFERENCES half has been watched red**, and the sentence has to say so: a probe
	 * making the control write `snappingEnabled` reddened it, while one making the control dispatch
	 * a real command did not, because the rig seeds no calibration and the command's only sidecar
	 * write then leaves the document identical. The sidecar half is a standing guard against a
	 * future wiring rather than a demonstrated one.
	 */
	it('writes nothing — not the sidecar, and not this device’s remembered choices', async () => {
		let stored: unknown = { gridVisible: false, snappingEnabled: true };
		const viewPreferences = editorViewPreferencesStore(
			{ loadLocalStorage: () => stored, saveLocalStorage: (_key, data) => { stored = data; } },
			'designer-view',
			recorder,
		);
		const rig = await designerRig({ shape: toiletShape(), background: true, viewPreferences });
		try {
			const before = await rig.document();

			await rig.wrapper.get(OPACITY).setValue('0.5');
			await settle();

			expect(await rig.document()).toEqual(before);
			expect(stored).toEqual({ gridVisible: false, snappingEnabled: true });
		} finally {
			rig.unmount();
		}
	});
});

describe('removing the reference', () => {
	it('offers the gesture while there is a sheet, and calls it once', async () => {
		const removeBackground = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
		const wrapper = mount(DesignerReferenceStatus, {
			props: { design: assetDesign({ background: { path: 'Specs/oven.png', kind: 'image', page: null } }), removeBackground },
		});

		expect(remove(wrapper).text()).toBe(t('en', 'designer.reference.remove'));
		await remove(wrapper).trigger('click');
		await flushPromises();

		expect(removeBackground).toHaveBeenCalledTimes(1);
	});

	/** A predicate, never a `:disabled`: there is nothing to remove, so there is no control. */
	it('draws no control for an asset with no sheet, even with the gesture bound', () => {
		const removeBackground = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
		const wrapper = mount(DesignerReferenceStatus, {
			props: { design: assetDesign({ background: null, calibration: null, shape: { ...toiletShape(), footprintOrigin: 'traced', footprintPending: true } }), removeBackground },
		});

		expect(wrapper.find('.rp-designer-reference').exists()).toBe(true);
		expect(remove(wrapper).exists()).toBe(false);
	});

	/**
	 * **The unwired case, drawn as nothing rather than as a button that throws.** `removeBackground`
	 * is optional with NO default, so a parent that has not bound it draws no control at all — the
	 * opposite of the optional-with-a-permissive-default shape that shipped a whole rule nothing
	 * could fire last wave.
	 */
	it('draws no control when nothing is bound to it', () => {
		const wrapper = mount(DesignerReferenceStatus, {
			props: { design: assetDesign({ background: { path: 'Specs/oven.png', kind: 'image', page: null } }) },
		});

		expect(wrapper.find('.rp-designer-reference').exists()).toBe(true);
		expect(remove(wrapper).exists()).toBe(false);
	});

	/**
	 * **THIS CASE IS DELIBERATELY RED IN THIS CARD'S CANDIDATE.**
	 *
	 * The control lives in `DesignerReferenceStatus.vue`; the props of that component are bound by
	 * `DesignerInspector.vue`, which this card does not own and must not edit. So the callback is
	 * built here and bound by nobody, and this is the assertion that says so out loud — the idiom
	 * `tests/build/lint-edited.test.ts` uses for its own hook registration, for the same reason: an
	 * unwired callback is invisible to every one of this repository's six gates, and that exact
	 * defect shipped last wave.
	 *
	 * It is written against the WHOLE mounted designer rather than a bare inspector, so what it
	 * proves once wired is the whole vertical: press the control, and the block that names the
	 * sheet says there is none.
	 *
	 * **The shape is seeded `traced`/`footprintPending`, and that is load-bearing rather than
	 * decoration.** `DesignerReferenceStatus` draws nothing at all unless `relevant` — a
	 * background, a calibration or a pending flag — and this rig seeds `calibration: null` while
	 * `toiletShape()` builds from `ASSET_PRESETS` with all three pending flags `false`. So on a
	 * successful removal the whole `<section>` would disappear and `sheet.none` would be rendered
	 * NOWHERE: the button-is-gone assertion would pass for the wrong reason and the sheet line
	 * would fail. Measured, with the parent binding applied locally — `AssertionError: expected
	 * 'PanSelectTrace footprintTrace clearan…' to contain 'None chosen'`. A pending flag is also
	 * the state AD12-R2 is most specific about, since removing the sheet must leave it standing.
	 * The sibling case above seeds the same pair for the same reason.
	 */
	it('reaches the real command from the real inspector, once the parent binds it', async () => {
		const rig = await designerRig({
			shape: { ...toiletShape(), footprintOrigin: 'traced', footprintPending: true },
			background: true,
		});
		try {
			const button = remove(rig.wrapper, '.rp-designer-inspector ');
			expect(button.exists()).toBe(true);

			await button.trigger('click');
			await settle();

			expect(remove(rig.wrapper, '.rp-designer-inspector ').exists()).toBe(false);
			expect(rig.wrapper.text()).toContain(t('en', 'designer.reference.sheet.none'));
			// AD12-R2's second answer, at the surface: the pixels stayed pixels.
			expect(rig.wrapper.text()).toContain(t('en', 'designer.reference.pending.footprint'));
		} finally {
			rig.unmount();
		}
	});
});
