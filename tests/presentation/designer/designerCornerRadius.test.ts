/**
 * @vitest-environment jsdom
 *
 * The selection inspector's Corner radius field (AD18-R16 Task 12): offered only while the selected
 * graphic IS a rounded rectangle, read back from its geometry (`cornerRadiusOf`), and written as one
 * whole-shape edit. `cornerRadius.test.ts` holds the detection and the bounds; this file holds what the
 * field draws and commits, bare and then through the mounted designer's undo.
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import DesignerSelectionInspector from '../../../src/presentation/designer/inspector/DesignerSelectionInspector.vue';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { ValidationError } from '../../../src/core/errors/AppError';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { roundedRect } from '../../../src/domain/asset/presets/presetGeometry';
import { rotate } from '../../../src/core/geometry/operations';
import type { EditShape } from '../../../src/presentation/designer/selection/editShape';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { t } from '../../../src/presentation/i18n/strings';
import { assetDesign, handed } from '../../helpers/assetDesign';
import { ROUNDED_RECT, shapeWithRoundedRect } from '../../helpers/assetShapes';
import { expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { designerRig } from '../../helpers/designerRig';

const ROUNDED = { kind: 'detail', id: 'detail-3' } as const;

function mountFor(shape: AssetShape, selection: { kind: 'detail'; id: string } = ROUNDED) {
	const applied: Result<AssetShape, ValidationError>[] = [];
	const editShape = vi.fn<EditShape>((edit) => {
		const result = handed(edit(shape));
		applied.push(result);
		return Promise.resolve(result.ok ? ok('wrote') : err(result.error));
	});
	const wrapper = mount(DesignerSelectionInspector, { props: { design: assetDesign({ shape }), selection, editShape, select: vi.fn<(next: unknown) => void>() } });
	return { wrapper, editShape, applied };
}

const radiusField = (wrapper: ReturnType<typeof mountFor>['wrapper']) => wrapper.find('[name="corner-radius"]');

async function type(wrapper: ReturnType<typeof mountFor>['wrapper'], value: string): Promise<void> {
	const input = radiusField(wrapper);
	(input.element as HTMLInputElement).value = value;
	await input.trigger('change');
	await flushPromises();
}

describe('when the inspector offers a corner radius', () => {
	it('offers one for a rounded rectangle, showing the radius its geometry has', () => {
		expect((radiusField(mountFor(shapeWithRoundedRect()).wrapper).element as HTMLInputElement).value).toBe('150');
	});

	it('offers one for a rounded rectangle turned a quarter, which is still one', () => {
		expect(radiusField(mountFor(shapeWithRoundedRect(rotate(ROUNDED_RECT, Math.PI / 2, { x: 20, y: 30 }))).wrapper).exists()).toBe(true);
	});

	it.each([
		['a plain rectangle', 'detail-1', shapeWithRoundedRect()],
		['a rounded rectangle rotated off the axes', 'detail-3', shapeWithRoundedRect(rotate(ROUNDED_RECT, Math.PI / 6, { x: 20, y: 30 }))],
		['a rounded rectangle stretched along one axis', 'detail-3', shapeWithRoundedRect({ ...ROUNDED_RECT, points: ROUNDED_RECT.points.map((point) => ({ x: point.x * 1.5, y: point.y })) })],
	] as const)('offers none for %s', (_, id, shape) => {
		expect(radiusField(mountFor(shape, { kind: 'detail', id }).wrapper).exists()).toBe(false);
	});

	it('offers none for a pending rounded rectangle, whose lengths are placeholder pixels', () => {
		const shape = shapeWithRoundedRect();
		const pending = { ...shape, details: shape.details.map((detail) => (detail.id === 'detail-3' ? { ...detail, pending: true } : detail)) };
		expect(radiusField(mountFor(pending).wrapper).exists()).toBe(false);
	});
});

describe('what the corner radius commits', () => {
	it('rebuilds the same box with the typed radius as ONE edit', async () => {
		const { wrapper, editShape, applied } = mountFor(shapeWithRoundedRect());

		await type(wrapper, '80');

		expect(editShape).toHaveBeenCalledTimes(1);
		expect(expectOk(applied[0]).details.find((detail) => detail.id === 'detail-3')?.outline).toEqual(roundedRect(1000, 600, 80, 20, 30));
	});

	it('refuses half the shorter side, and says why', async () => {
		const { wrapper } = mountFor(shapeWithRoundedRect());

		await type(wrapper, '300');

		expect(wrapper.find('[role="alert"]').text()).toBe(t('en', 'asset.corner-radius-out-of-range'));
	});
});

describe('the corner radius in the mounted designer', () => {
	it('writes through the leaf as one undo entry, and one Undo brings the old corners back', async () => {
		const rig = await designerRig({ shape: shapeWithRoundedRect() });
		try {
			useAssetDesignStore(rig.pinia).select(ROUNDED);
			await settle();
			const outline = async () => (await rig.document()).shape?.details.find((detail) => detail.id === 'detail-3')?.outline;

			const input = rig.wrapper.find('.rp-designer-selection [name="corner-radius"]');
			(input.element as HTMLInputElement).value = '80';
			await input.trigger('change');
			await settle();
			expect(await outline()).toEqual(roundedRect(1000, 600, 80, 20, 30));

			rig.toolbarButton(t('en', 'designer.toolbar.undo')).click();
			await settle();
			expect(await outline()).toEqual(ROUNDED_RECT);
			expect(rig.toolbarButton(t('en', 'designer.toolbar.undo')).disabled).toBe(true);
		} finally {
			rig.unmount();
		}
	});
});
