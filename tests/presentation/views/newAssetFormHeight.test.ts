/**
 * @vitest-environment jsdom
 *
 * AD07 implementation item 3's "optional descriptive height", the half of that item Amendment 1
 * recorded as deferred: the field, what a BLANK one sends, where its two refusals land, and the
 * two things about it that differ from width and depth.
 *
 * Sited beside `newAssetForm.test.ts` rather than inside it for `newAssetFormOutline.test.ts`'s
 * reason — that file's `fill` helper enumerates every field it types, and a suite whose subject
 * is one field is clearer with its own baseline than as ten more cases in a 450-line cap.
 *
 * **The blank case is the load-bearing one.** `Number('')` is `0`, and unlike a dimension a zero
 * height is VALID — `checkHeight` accepts it deliberately, a flat thing being a real answer — so
 * an eagerly parsed blank is refused by nothing at any layer. It would simply record every asset
 * created through this form as nought millimetres tall, which is a claim the user never made.
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

type CreateAsset = (input: CreateAssetInput) => Promise<Result<Asset, AppError>>;
type SetFootprint = (input: SetAssetFootprintFromDimensionsInput) => Promise<DispatchResult>;
type WriteOutline = (input: SetAssetFootprintInput) => Promise<DispatchResult>;

const CENTRED: readonly Point[] = [{ x: -600, y: -300 }, { x: 600, y: -300 }, { x: 600, y: 300 }, { x: -600, y: 300 }];

function refusal(code: string): AppError {
	return { category: 'Validation', code, message: 'developer english' } as AppError;
}

interface Mounted {
	readonly wrapper: VueWrapper;
	readonly createAsset: ReturnType<typeof vi.fn<CreateAsset>>;
	readonly setFootprintFromDimensions: ReturnType<typeof vi.fn<SetFootprint>>;
}

function mountForm(
	overrides: {
		createAsset?: ReturnType<typeof vi.fn<CreateAsset>>;
		setFootprintFromDimensions?: ReturnType<typeof vi.fn<SetFootprint>>;
		outline?: { readonly points: readonly Point[]; write: WriteOutline };
	} = {},
): Mounted {
	const createAsset = overrides.createAsset ?? vi.fn<CreateAsset>(() => Promise.resolve(ok(makeAsset())));
	const setFootprintFromDimensions
		= overrides.setFootprintFromDimensions ?? vi.fn<SetFootprint>(() => Promise.resolve(ok('wrote')));
	const wrapper = mount(NewAssetForm, {
		props: {
			createAsset,
			setFootprintFromDimensions,
			logger: recorder,
			defaultCurrency: 'EUR',
			...(overrides.outline ? { outline: overrides.outline } : {}),
		},
	});
	return { wrapper, createAsset, setFootprintFromDimensions };
}

/** A valid baseline, so a case can only ever fail on the height it is about. */
async function submitWithHeight(mounted: Mounted, height: string): Promise<void> {
	await mounted.wrapper.get('[data-field="name"]').setValue('Kitchen island');
	await mounted.wrapper.get('[data-field="unitCostAmount"]').setValue('450.00');
	if (height !== '') await mounted.wrapper.get('[data-field="height"]').setValue(height);
	await mounted.wrapper.get('form').trigger('submit');
	await flushPromises();
}

/**
 * The message a control itself POINTS AT, read through its own `aria-describedby` rather than
 * off a class. A field message that rendered somewhere else in the form would satisfy a class
 * lookup and tell a screen-reader user nothing, which is the failure this shape refuses.
 */
function messageFor(wrapper: VueWrapper, field: string): string | null {
	const described = wrapper.get(`[data-field="${field}"]`).attributes('aria-describedby');
	if (described === undefined) return null;
	return wrapper.get(`[id="${described}"]`).text().replace('⚠', '').trim();
}

describe('NewAssetForm height', () => {
	it('sends null rather than zero when the height is left blank', async () => {
		const mounted = mountForm();
		await submitWithHeight(mounted, '');
		expect(mounted.createAsset).toHaveBeenCalledTimes(1);
		// `toMatchObject` would pass on an absent key; the height's whole point is which value
		// an untouched field sends, so the assertion has to be over the property itself.
		expect(mounted.createAsset.mock.calls[0][0].height).toBeNull();
		expect(mounted.wrapper.emitted('submit')).toHaveLength(1);
	});

	it('carries a typed height to the create command as a number', async () => {
		const mounted = mountForm();
		await submitWithHeight(mounted, '900');
		expect(mounted.createAsset.mock.calls[0][0].height).toBe(900);
	});

	it('renders the height beside the two dimensions and sends all three', async () => {
		const mounted = mountForm();
		await mounted.wrapper.get('[data-field="width"]').setValue('1200');
		await mounted.wrapper.get('[data-field="depth"]').setValue('450');
		await submitWithHeight(mounted, '900');
		expect(mounted.createAsset.mock.calls[0][0].height).toBe(900);
		expect(mounted.setFootprintFromDimensions.mock.calls[0][0]).toMatchObject({ width: 1200, depth: 450 });
	});

	it('routes a refused height under the height field rather than to the banner', async () => {
		const createAsset = vi.fn<CreateAsset>(() => Promise.resolve(err(refusal('asset.negative-height'))));
		const mounted = mountForm({ createAsset });
		await submitWithHeight(mounted, '-5');
		expect(messageFor(mounted.wrapper, 'height')).toBe(t('en', 'asset.negative-height'));
		expect(mounted.wrapper.find('.rp-form-banner').exists()).toBe(false);
		expect(mounted.wrapper.emitted('submit')).toBeUndefined();
	});

	/**
	 * Why `NEW_ASSET_ERRORS` routes `asset.negative-height` and NOT `asset.invalid-height`. The
	 * control is `type="number"`, and the HTML value-sanitization algorithm empties one whose
	 * content is not a finite floating-point number — so the form never holds `1e999` and
	 * `parseHeight` never produces `Infinity`. Driven rather than asserted as an absence: this
	 * case goes red if the control's type changes or the parse stops asking, which is exactly
	 * when the missing route would start mattering.
	 */
	it('cannot produce a non-finite height at all, the control having emptied itself', async () => {
		const mounted = mountForm();
		await submitWithHeight(mounted, '1e999');
		expect((mounted.wrapper.get('[data-field="height"]').element as HTMLInputElement).value).toBe('');
		expect(mounted.createAsset.mock.calls[0][0].height).toBeNull();
	});

	/**
	 * Outline mode renders no width and no depth — the outline decides the footprint — and a
	 * height is a NOTE field that outline says nothing about, so it survives. Hiding it here
	 * would be a question this dialog never gets to ask again.
	 */
	it('still offers the height when an item outline stands in for the dimensions', async () => {
		const write = vi.fn<WriteOutline>(() => Promise.resolve(ok('wrote')));
		const mounted = mountForm({ outline: { points: CENTRED, write } });
		expect(mounted.wrapper.find('[data-field="width"]').exists()).toBe(false);
		expect(mounted.wrapper.find('[data-field="depth"]').exists()).toBe(false);
		await submitWithHeight(mounted, '900');
		expect(mounted.createAsset.mock.calls[0][0].height).toBe(900);
	});

	/**
	 * The height is a `createAsset` field, and a frozen retry never calls `createAsset` again —
	 * so an edit to it after the freeze would be accepted by the input and discarded by the code
	 * behind it. The two dimensions are the opposite case in the same markup, which is why
	 * `NumericField.readonly` is a required prop rather than a default the three sites share.
	 */
	it('freezes the height with the catalogue while leaving the two dimensions live', async () => {
		const setFootprintFromDimensions = vi
			.fn<SetFootprint>()
			.mockResolvedValueOnce(err(refusal('vault.unexpected-failure')))
			.mockResolvedValue(ok('wrote'));
		const mounted = mountForm({ setFootprintFromDimensions });
		await mounted.wrapper.get('[data-field="width"]').setValue('1200');
		await mounted.wrapper.get('[data-field="depth"]').setValue('450');
		await submitWithHeight(mounted, '900');

		expect(mounted.wrapper.find('.rp-new-asset__created').exists()).toBe(true);
		expect((mounted.wrapper.get('[data-field="height"]').element as HTMLInputElement).readOnly).toBe(true);
		expect((mounted.wrapper.get('[data-field="width"]').element as HTMLInputElement).readOnly).toBe(false);
		expect((mounted.wrapper.get('[data-field="depth"]').element as HTMLInputElement).readOnly).toBe(false);
	});
});
