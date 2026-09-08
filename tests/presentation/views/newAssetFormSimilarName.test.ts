/**
 * @vitest-environment jsdom
 *
 * The similar-name hint (AL03) split out of `newAssetForm.test.ts` once the two files' sum
 * crossed the 450-line cap — the same seam `accessibilityAssetLibrary.test.ts` set as
 * precedent, drawn where the parent file already had a natural boundary: `findExisting` is
 * the one prop nothing else in that file's cases touches.
 */
import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import NewAssetForm from '../../../src/presentation/views/NewAssetForm.vue';
import { ok, type Result } from '../../../src/core/result/Result';
import type { AppError } from '../../../src/core/errors/AppError';
import type { CreateAssetInput } from '../../../src/application/commands/asset/CreateAsset';
import type { SetAssetFootprintFromDimensionsInput } from '../../../src/application/commands/asset/SetAssetFootprint';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { Asset } from '../../../src/domain/asset/Asset';
import { makeAsset } from '../../helpers/entities';
import { recorder } from '../../helpers/logger';

type CreateAsset = (input: CreateAssetInput) => Promise<Result<Asset, AppError>>;
type SetFootprint = (input: SetAssetFootprintFromDimensionsInput) => Promise<DispatchResult>;

function footprintOk(): ReturnType<typeof vi.fn<SetFootprint>> {
	return vi.fn<SetFootprint>(() => Promise.resolve(ok('wrote')));
}

describe('NewAssetForm similar-name hint', () => {
	/**
	 * AL03: "a similar name is a hint linking to existing results, not an automatic merge." The
	 * match itself is entirely `findExisting`'s — this form only draws whatever it answers and
	 * offers the one door out. Typed with leading/trailing space and mixed case to prove the
	 * comparison is the CALLER's, not a second one this form invents: `findExisting` here folds
	 * case and trims, and the form passes the raw typed value straight through.
	 */
	it('hints at an existing asset with the same name and offers to show it instead', async () => {
		const existing = { assetId: makeAsset().id, name: 'Oak plank floor' };
		const createAsset = vi.fn<CreateAsset>(() => Promise.resolve(ok(makeAsset())));
		const wrapper = mount(NewAssetForm, {
			props: {
				createAsset,
				setFootprintFromDimensions: footprintOk(),
				logger: recorder,
				defaultCurrency: 'EUR',
				findExisting: (name: string) =>
					name.trim().toLowerCase() === 'oak plank floor' ? existing : null,
			},
		});
		expect(wrapper.find('.rp-similar-name').exists()).toBe(false);

		await wrapper.get('[data-field="name"]').setValue('  oak PLANK floor ');

		expect(wrapper.get('.rp-similar-name').text()).toContain('“Oak plank floor” already exists');

		await wrapper.get('.rp-similar-name button').trigger('click');

		expect(wrapper.emitted('submit')?.[0]).toEqual([{ assetId: existing.assetId, created: false }]);
		expect(createAsset).not.toHaveBeenCalled();
	});

	/**
	 * The hint is a DOOR out of the dialog exactly like every other control here, so it has
	 * to follow the same `catalogueInoperative` gate rather than only `catalogueFrozen`.
	 * Before this case's fix, the hint stayed gated on `catalogueFrozen` alone —
	 * `createdAssetId !== null`, true only AFTER `createAsset` resolves — so it was still
	 * offered while a creation was in flight. Pressing it there would resolve `submit` with
	 * `{ created: false }` immediately, which is what the caller reads to decide whether to
	 * refresh, while the pending `createAsset` dispatch went on to land a duplicate asset
	 * nobody's refresh would ever pick up.
	 */
	it('withdraws the similar-name door while a creation is in flight', async () => {
		let release!: (value: Result<Asset, AppError>) => void;
		const pending = new Promise<Result<Asset, AppError>>((resolve) => {
			release = resolve;
		});
		const existing = { assetId: makeAsset().id, name: 'Oak plank floor' };
		const createAsset = vi.fn<CreateAsset>(() => pending);
		const wrapper = mount(NewAssetForm, {
			props: {
				createAsset,
				setFootprintFromDimensions: footprintOk(),
				logger: recorder,
				defaultCurrency: 'EUR',
				findExisting: (name: string) =>
					name.trim().toLowerCase() === 'oak plank floor' ? existing : null,
			},
		});
		await wrapper.get('[data-field="name"]').setValue('Oak plank floor');
		await wrapper.get('[data-field="unitCostAmount"]').setValue('4.50');
		expect(wrapper.find('.rp-similar-name').exists()).toBe(true);

		await wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(wrapper.find('.rp-similar-name').exists()).toBe(false);

		release(ok(makeAsset()));
		await flushPromises();
		expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ created: true });
	});
});
