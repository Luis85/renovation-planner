/**
 * @vitest-environment jsdom
 *
 * AD18-R17's two corner-radius rows in the selection inspector: the radius slider beside the number
 * field, and the radius SURVIVING a Width or Depth edit. `cornerRadius.test.ts` holds the geometry
 * (`resizeRoundedRect`, `roundedCorner`); this file holds what the inspector draws and commits.
 *
 * Two contract rules are the point of half of these cases. C05: *"intermediate pointer moves do not
 * become separate commands"* — a drag fires `input` on every step, and only `change` commits. C03:
 * *"typing the current value … create[s] no command"* — the edit answers `null`, which `editShape`
 * resolves as `no-write` and never dispatches.
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import DesignerSelectionInspector from '../../../src/presentation/designer/inspector/DesignerSelectionInspector.vue';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { ValidationError } from '../../../src/core/errors/AppError';
import { rotate } from '../../../src/core/geometry/operations';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { roundedRect } from '../../../src/domain/asset/presets/presetGeometry';
import type { DesignerSelection } from '../../../src/presentation/designer/selection/designerSelection';
import type { EditShape } from '../../../src/presentation/designer/selection/editShape';
import { resizeToExtent } from '../../../src/presentation/designer/selection/partExtent';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { t } from '../../../src/presentation/i18n/strings';
import { accessibleName } from '../../helpers/accessibleName';
import { assetDesign } from '../../helpers/assetDesign';
import { editableShape, ROUNDED_RECT, shapeWithRoundedRect } from '../../helpers/assetShapes';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { designerRig } from '../../helpers/designerRig';

const ROUNDED = { kind: 'detail', id: 'detail-3' } as const;

/**
 * `live` is the shape each edit is HANDED, which a case may set apart from the one the props drew —
 * `createEditShape`'s chain between a write and the refresh that follows it.
 */
function mountFor(shape: AssetShape, live: AssetShape = shape, selection: DesignerSelection = ROUNDED) {
	const applied: (Result<AssetShape, ValidationError> | null)[] = [];
	const editShape = vi.fn<EditShape>((edit) => {
		const result = edit(live);
		applied.push(result);
		if (result === null) return Promise.resolve(ok('no-write'));
		return Promise.resolve(result.ok ? ok('wrote') : err(result.error));
	});
	const wrapper = mount(DesignerSelectionInspector, { props: { design: assetDesign({ shape }), selection, editShape, select: vi.fn<(next: unknown) => void>() } });
	return { wrapper, editShape, applied };
}

const slider = (wrapper: VueWrapper) => wrapper.get('input[type="range"]');

async function commit(wrapper: VueWrapper, name: string, value: string): Promise<void> {
	const input = wrapper.get(`[name="${name}"]`);
	(input.element as HTMLInputElement).value = value;
	await input.trigger('change');
	await flushPromises();
}

const outlineOf = (result: Result<AssetShape, ValidationError> | null | undefined) =>
	expectOk(expectDefined(result, 'an applied edit')).details.find((detail) => detail.id === 'detail-3')?.outline;

describe('the corner radius slider', () => {
	it('sits beside the number field over the whole-millimetre radii setCornerRadius accepts', () => {
		const input = slider(mountFor(shapeWithRoundedRect()).wrapper).element as HTMLInputElement;

		expect([input.min, input.max, input.step, input.value]).toEqual(['1', '299', '1', '150']);
		expect(input.closest('.rp-designer-radius-field')?.querySelector('[name="corner-radius"]')).not.toBeNull();
	});

	it('is drawn only where the number field is', () => {
		expect(mountFor(shapeWithRoundedRect(), undefined, { kind: 'detail', id: 'detail-1' }).wrapper.find('input[type="range"]').exists()).toBe(false);
	});

	it.each(['en', 'de'] as const)('carries the visible Corner radius label inside its own name, in %s', (language) => {
		expect(t(language, 'designer.selection.fields.corner-radius-slider').toLowerCase()).toContain(t(language, 'designer.selection.corner-radius.short').toLowerCase());
	});

	it('is named apart from the number field beside it', () => {
		const { wrapper } = mountFor(shapeWithRoundedRect());

		expect(accessibleName(slider(wrapper).element)).toBe(t('en', 'designer.selection.fields.corner-radius-slider'));
		expect(accessibleName(slider(wrapper).element)).not.toBe(accessibleName(wrapper.get('[name="corner-radius"]').element));
	});

	/**
	 * The value is announced WITH its unit, and follows the thumb: a drag moves it before any commit, and
	 * the design's refresh hands it back to the stored radius.
	 */
	it('says its value with its unit, following the thumb until the design refreshes', async () => {
		const { wrapper } = mountFor(shapeWithRoundedRect());
		const input = slider(wrapper);
		expect(input.attributes('aria-valuetext')).toBe(t('en', 'designer.selection.fields.corner-radius-value', { value: '150' }));

		(input.element as HTMLInputElement).value = '80';
		await input.trigger('input');
		expect(input.attributes('aria-valuetext')).toBe('80 mm');

		await wrapper.setProps({ design: assetDesign({ shape: shapeWithRoundedRect(roundedRect(1000, 600, 90, 20, 30)) }) });
		expect(slider(wrapper).attributes('aria-valuetext')).toBe('90 mm');
	});

	/**
	 * ANY refresh hands the slider back to the design, including one that leaves the radius where it was —
	 * a refused commit at 80 followed by a Width edit that keeps 150. Keyed on the radius alone, nothing
	 * would change and the thumb and its text would stay on 80 indefinitely.
	 */
	it('goes back to the design’s radius on a refresh that leaves the radius unchanged', async () => {
		const { wrapper } = mountFor(shapeWithRoundedRect());
		const input = slider(wrapper);
		(input.element as HTMLInputElement).value = '80';
		await input.trigger('input');

		await wrapper.setProps({ design: assetDesign({ shape: shapeWithRoundedRect(roundedRect(1400, 600, 150, 20, 30)) }) });

		expect(slider(wrapper).attributes('aria-valuetext')).toBe('150 mm');
		expect((slider(wrapper).element as HTMLInputElement).value).toBe('150');
	});

	it('commits nothing while it is dragged, and ONE edit when it is let go', async () => {
		const { wrapper, editShape, applied } = mountFor(shapeWithRoundedRect());
		const input = slider(wrapper);

		for (const value of ['140', '120', '100', '80']) {
			(input.element as HTMLInputElement).value = value;
			await input.trigger('input');
		}
		expect(editShape).not.toHaveBeenCalled();

		await input.trigger('change');
		await flushPromises();
		expect(editShape).toHaveBeenCalledTimes(1);
		expect(outlineOf(applied[0])).toEqual(roundedRect(1000, 600, 80, 20, 30));
	});
});

describe('committing the radius it already has', () => {
	it.each([
		['the slider', 'corner-radius-slider'],
		['the number field', 'corner-radius'],
	] as const)('writes nothing when %s is committed at the current radius', async (_, name) => {
		const { wrapper, applied } = mountFor(shapeWithRoundedRect());

		await commit(wrapper, name, '150');

		expect(applied).toEqual([null]);
		expect(wrapper.find('[role="alert"]').exists()).toBe(false);
	});

	/** C03's second spelling: the field SHOWS 150 for a radius of 150.4, and 150 is what the user was shown. */
	it('writes nothing for the rounded figure it shows, keeping the canonical radius', async () => {
		const { wrapper, applied } = mountFor(shapeWithRoundedRect(roundedRect(1000, 600, 150.4, 20, 30)));

		await commit(wrapper, 'corner-radius', '150');

		expect(applied).toEqual([null]);
	});

	it('writes a radius measured off the shape it is HANDED, not off the render', async () => {
		const { wrapper, applied } = mountFor(shapeWithRoundedRect(), shapeWithRoundedRect(roundedRect(1000, 600, 90, 20, 30)));

		await commit(wrapper, 'corner-radius', '150');

		expect(outlineOf(applied[0])).toEqual(roundedRect(1000, 600, 150, 20, 30));
	});

	it.each([
		['no longer has the graphic', editableShape(), 'asset.part-not-found'],
		['has it no longer rounded', shapeWithRoundedRect(rotate(ROUNDED_RECT, Math.PI / 6, { x: 20, y: 30 })), 'asset.not-rounded-rectangle'],
	] as const)('refuses, and says why, when the shape it is handed %s', async (_, live, code) => {
		const { wrapper } = mountFor(shapeWithRoundedRect(), live);

		await commit(wrapper, 'corner-radius', '80');

		expect(wrapper.get('[role="alert"]').text()).toBe(t('en', code));
	});
});

describe('a Width or Depth edit on a rounded rectangle', () => {
	it('keeps it a rounded rectangle with its radius, as ONE edit', async () => {
		const { wrapper, editShape, applied } = mountFor(shapeWithRoundedRect());

		await commit(wrapper, 'width', '1400');

		expect(editShape).toHaveBeenCalledTimes(1);
		expect(outlineOf(applied[0])).toEqual(roundedRect(1400, 600, 150, 20, 30));
	});

	it('clamps the radius when the new box has no room for it', async () => {
		const { wrapper, applied } = mountFor(shapeWithRoundedRect());

		await commit(wrapper, 'depth', '200');

		expect(outlineOf(applied[0])).toEqual(roundedRect(1000, 200, 99, 20, 30));
	});

	it('resizes a rounded rectangle turned off the axes exactly as before, since it is offered no radius', async () => {
		const turned = shapeWithRoundedRect(rotate(ROUNDED_RECT, Math.PI / 6, { x: 20, y: 30 }));
		const { wrapper, applied } = mountFor(turned);

		await commit(wrapper, 'width', '1400');

		expect(applied[0]).toEqual(resizeToExtent(turned, ROUNDED, 'width', 1400));
	});

	it('resizes a plain rectangle exactly as before', async () => {
		const shape = shapeWithRoundedRect();
		const { wrapper, applied } = mountFor(shape, shape, { kind: 'detail', id: 'detail-1' });

		await commit(wrapper, 'width', '400');

		expect(applied[0]).toEqual(resizeToExtent(shape, { kind: 'detail', id: 'detail-1' }, 'width', 400));
	});

	it('resizes the footprint exactly as before, which is never asked for a radius', async () => {
		const shape = shapeWithRoundedRect();
		const { wrapper, applied } = mountFor(shape, shape, { kind: 'footprint' });

		await commit(wrapper, 'width', '1400');

		expect(applied).toEqual([resizeToExtent(shape, { kind: 'footprint' }, 'width', 1400)]);
	});

	it('writes through the mounted designer as one undo entry, and one Undo brings the old outline back', async () => {
		const rig = await designerRig({ shape: shapeWithRoundedRect() });
		try {
			useAssetDesignStore(rig.pinia).select(ROUNDED);
			await settle();
			const outline = async () => (await rig.document()).shape?.details.find((detail) => detail.id === 'detail-3')?.outline;

			const input = rig.wrapper.get('.rp-designer-selection [name="depth"]');
			(input.element as HTMLInputElement).value = '200';
			await input.trigger('change');
			await settle();
			expect(await outline()).toEqual(roundedRect(1000, 200, 99, 20, 30));
			expect(rig.wrapper.find('.rp-designer-selection [name="corner-radius"]').exists()).toBe(true);

			rig.toolbarButton(t('en', 'designer.toolbar.undo')).click();
			await settle();
			expect(await outline()).toEqual(ROUNDED_RECT);
			expect(rig.toolbarButton(t('en', 'designer.toolbar.undo')).disabled).toBe(true);
		} finally {
			rig.unmount();
		}
	});
});
