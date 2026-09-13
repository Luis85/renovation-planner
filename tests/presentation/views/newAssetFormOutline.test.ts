/**
 * @vitest-environment jsdom
 *
 * `NewAssetForm` opened from a plan item (2026-09-13 item modes spec §B): the name starts from the item, the
 * outline stands where the two dimension fields would, and the footprint is written MEASURED after the asset
 * exists. The created-id retry rule is the same one `newAssetForm.test.ts` holds for dimensions.
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import NewAssetForm from '../../../src/presentation/views/NewAssetForm.vue';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { AppError } from '../../../src/core/errors/AppError';
import type { Point } from '../../../src/core/geometry/Point';
import type { CreateAssetInput } from '../../../src/application/commands/asset/CreateAsset';
import type {
	SetAssetFootprintFromDimensionsInput,
	SetAssetFootprintInput,
} from '../../../src/application/commands/asset/SetAssetFootprint';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { Asset } from '../../../src/domain/asset/Asset';
import { makeAsset } from '../../helpers/entities';
import { recorder } from '../../helpers/logger';
import { t } from '../../../src/presentation/i18n/strings';

type Write = (input: SetAssetFootprintInput) => Promise<DispatchResult>;
const CENTRED: readonly Point[] = [{ x: -600, y: -300 }, { x: 600, y: -300 }, { x: 600, y: 300 }, { x: -600, y: 300 }];

function mountWithOutline(points: readonly Point[] = CENTRED, write = vi.fn<Write>(() => Promise.resolve(ok('wrote')))) {
	const asset = makeAsset();
	const createAsset = vi.fn<(input: CreateAssetInput) => Promise<Result<Asset, AppError>>>(() => Promise.resolve(ok(asset)));
	const setFootprintFromDimensions = vi.fn<(input: SetAssetFootprintFromDimensionsInput) => Promise<DispatchResult>>(
		() => Promise.resolve(ok('wrote')),
	);
	const wrapper = mount(NewAssetForm, {
		props: { createAsset, setFootprintFromDimensions, logger: recorder, defaultCurrency: 'EUR', initialName: 'Cabinet', outline: { points, write } },
	});
	return { wrapper, asset, createAsset, setFootprintFromDimensions, write };
}

async function submit(wrapper: VueWrapper): Promise<void> {
	await wrapper.get('[data-field="unitCostAmount"]').setValue('450.00');
	await wrapper.get('form').trigger('submit');
	await flushPromises();
}

describe('NewAssetForm with an item outline', () => {
	it('starts from the item name and states the outline in place of the dimension fields', () => {
		const { wrapper } = mountWithOutline();
		expect((wrapper.get('[data-field="name"]').element as HTMLInputElement).value).toBe('Cabinet');
		expect(wrapper.find('[data-field="width"]').exists()).toBe(false);
		expect(wrapper.find('[data-field="depth"]').exists()).toBe(false);
		expect(wrapper.get('.rp-new-asset__outline').text()).toBe(t('en', 'form.new-asset.outline', { width: '1200', depth: '600' }));
	});

	it('creates the asset, writes the outline measured, and submits the created id', async () => {
		const { wrapper, asset, createAsset, setFootprintFromDimensions, write } = mountWithOutline();
		await submit(wrapper);
		expect(createAsset.mock.calls[0][0]).toMatchObject({ name: 'Cabinet', unitCostAmount: '450.00', currency: 'EUR' });
		expect(write).toHaveBeenCalledWith({ assetId: asset.id, points: CENTRED, measured: true });
		expect(setFootprintFromDimensions).not.toHaveBeenCalled();
		expect(wrapper.emitted('submit')).toEqual([[{ assetId: asset.id, created: true }]]);
	});

	it('retries only the outline after a refused write, never creating a second asset', async () => {
		const refused = err({ category: 'Persistence', code: 'asset-geometry.write-failed', message: 'x' } as AppError);
		const write = vi.fn<Write>().mockResolvedValueOnce(refused).mockResolvedValue(ok('wrote'));
		const { wrapper, createAsset } = mountWithOutline(CENTRED, write);
		await submit(wrapper);
		expect(wrapper.emitted('submit')).toBeUndefined();
		expect(wrapper.get('.rp-new-asset__created').text()).toBe(t('en', 'form.new-asset.already-created-outline'));
		await wrapper.get('form').trigger('submit'); await flushPromises();
		expect(createAsset).toHaveBeenCalledTimes(1);
		expect(write).toHaveBeenCalledTimes(2);
		expect(wrapper.emitted('submit')).toHaveLength(1);
	});

	it('refuses an outline enclosing no area before anything is written', async () => {
		const { wrapper, createAsset, write } = mountWithOutline([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]);
		await submit(wrapper);
		expect(createAsset).not.toHaveBeenCalled();
		expect(write).not.toHaveBeenCalled();
		expect(wrapper.emitted('submit')).toBeUndefined();
	});
});
