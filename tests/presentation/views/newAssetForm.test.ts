/**
 * @vitest-environment jsdom
 *
 * `NewAssetForm` is design slice 16's vocabulary read a third time, and the FIRST form in
 * this plugin whose submit is a SEQUENCE rather than one command: an asset is created, and
 * only then — and only if the user typed both dimensions — is its rectangle footprint
 * written into the geometry sidecar. Every case below asserts the COMMAND INPUT and the
 * rendered control, never "a dialog opened", which is equally true of a caller that
 * dispatched something else entirely.
 *
 * Two hazards belong to the sequence and to nothing else here, and each has its own case:
 *
 *  - the note is committed before the sidecar is touched, so a vault fault in between
 *    leaves an asset with no footprint. A retry must NOT create a second one.
 *  - `CreateAssetCommand` calls `Money.of` before it validates anything, and `of` THROWS on
 *    a malformed amount or currency rather than refusing. A typo in either field would
 *    therefore reach the user as `vault.unexpected-failure` — "reading or writing the vault
 *    failed unexpectedly" — about a vault nothing touched. The form pre-validates through
 *    `createMoney`, which is the same two patterns as a refusal.
 */
import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import NewAssetForm from '../../../src/presentation/views/NewAssetForm.vue';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { AppError } from '../../../src/core/errors/AppError';
import type { CreateAssetInput } from '../../../src/application/commands/asset/CreateAsset';
import type { SetAssetFootprintFromDimensionsInput } from '../../../src/application/commands/asset/SetAssetFootprint';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { Asset } from '../../../src/domain/asset/Asset';
import { makeAsset } from '../../helpers/entities';
import { recorder } from '../../helpers/logger';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';

type CreateAsset = (input: CreateAssetInput) => Promise<Result<Asset, AppError>>;
type SetFootprint = (input: SetAssetFootprintFromDimensionsInput) => Promise<DispatchResult>;

function refusal(category: AppError['category'], code: string): AppError {
	return { category, code, message: 'developer english' } as AppError;
}

/**
 * The copy a code resolves to, asked of the SAME table the form asks — never a literal
 * copied out of `en.ts`, which would agree with a typo in it. The mock's `getLanguage()`
 * answers `'en'`, which is what makes `trError` inside the form resolve this locale.
 */
function sentence(code: StringKey): string {
	return t('en', code);
}

/**
 * Every distinct field message currently rendered. Distinct, because a cross-field claim is
 * ONE message drawn under each of the two fields it is about — counting elements would
 * assert the routing's arity rather than what the user is told.
 */
function messages(wrapper: VueWrapper): string[] {
	const rendered = wrapper
		.findAll('.rp-field-error__message')
		// The glyph is an `aria-hidden` span inside the same paragraph, so `text()` carries it.
		.map((node) => node.text().replace('⚠', '').trim());
	return [...new Set(rendered)];
}

function createOk(asset = makeAsset()): ReturnType<typeof vi.fn<CreateAsset>> {
	return vi.fn<CreateAsset>(() => Promise.resolve(ok(asset)));
}

function footprintOk(): ReturnType<typeof vi.fn<SetFootprint>> {
	return vi.fn<SetFootprint>(() => Promise.resolve(ok('wrote')));
}

interface Typed {
	readonly name?: string;
	readonly width?: string;
	readonly depth?: string;
	readonly unitCostAmount?: string;
	readonly currency?: string;
}

/**
 * Every field the user can reach, filled to a valid baseline and then overridden. A form
 * whose defaults were already invalid would let a case pass on the wrong refusal, which is
 * this repository's own recorded shape.
 */
async function fill(wrapper: VueWrapper, typed: Typed): Promise<void> {
	const values: Required<Typed> = {
		name: 'Kitchen island',
		width: '',
		depth: '',
		unitCostAmount: '450.00',
		currency: 'EUR',
		...typed,
	};
	for (const [field, value] of Object.entries(values)) {
		await wrapper.get(`[data-field="${field}"]`).setValue(value);
	}
}

async function mountAndSubmit(
	props: { createAsset: CreateAsset; setFootprintFromDimensions: SetFootprint },
	typed: Typed,
): Promise<VueWrapper> {
	const wrapper = mount(NewAssetForm, { props: { ...props, logger: recorder } });
	await fill(wrapper, typed);
	await wrapper.get('form').trigger('submit');
	await flushPromises();
	return wrapper;
}

describe('NewAssetForm', () => {
	it('creates the asset and, when dimensions are given, its rectangle footprint', async () => {
		const asset = makeAsset();
		const createAsset = createOk(asset);
		const setFootprintFromDimensions = footprintOk();

		const wrapper = await mountAndSubmit(
			{ createAsset, setFootprintFromDimensions },
			{ width: '1200', depth: '800' },
		);

		expect(createAsset).toHaveBeenCalledTimes(1);
		expect(createAsset.mock.calls[0][0]).toEqual({
			name: 'Kitchen island',
			category: 'material',
			unit: 'piece',
			unitCostAmount: '450.00',
			currency: 'EUR',
		});
		expect(setFootprintFromDimensions).toHaveBeenCalledTimes(1);
		expect(setFootprintFromDimensions).toHaveBeenCalledWith(
			expect.objectContaining({ assetId: asset.id, width: 1200, depth: 800 }),
		);
		expect(wrapper.emitted('submit')).toEqual([[asset.id]]);
	});

	it('creates the asset with no footprint when dimensions are left empty', async () => {
		const createAsset = createOk();
		const setFootprintFromDimensions = footprintOk();

		const wrapper = await mountAndSubmit({ createAsset, setFootprintFromDimensions }, {});

		expect(createAsset).toHaveBeenCalledTimes(1);
		expect(setFootprintFromDimensions).not.toHaveBeenCalled();
		expect(wrapper.emitted('submit')).toHaveLength(1);
	});

	/**
	 * Plan Step 3, rule 1: the dimensions are validated with NOTHING yet written.
	 * `footprintFromDimensions` is pure, so the common failure — a zero, a negative — is
	 * caught before the asset note is committed, and there is no half-made asset to strand.
	 *
	 * The message routes to BOTH dimension fields because the code names neither: the refusal
	 * is minted inside a loop over `[width, depth]` and carries only the offending value in
	 * developer English. Claiming it for `width` alone would be a second answer to which field
	 * is wrong, and a wrong one half the time.
	 */
	it('refuses a non-positive dimension at both fields with nothing written', async () => {
		const createAsset = createOk();
		const setFootprintFromDimensions = footprintOk();

		const wrapper = await mountAndSubmit(
			{ createAsset, setFootprintFromDimensions },
			{ width: '0', depth: '800' },
		);

		expect(createAsset).not.toHaveBeenCalled();
		expect(setFootprintFromDimensions).not.toHaveBeenCalled();
		expect(wrapper.get('[data-field="width"]').attributes('aria-invalid')).toBe('true');
		expect(wrapper.get('[data-field="depth"]').attributes('aria-invalid')).toBe('true');
		// The MESSAGE, not merely that one appeared. It is what tells this refusal from the
		// incomplete-pair one below, and asserting only `aria-invalid` cannot: measured, with
		// the incomplete-pair guard deleted BOTH cases go on passing, because `Number('')` is
		// `0` and this very code fires for the blank field instead.
		expect(messages(wrapper)).toEqual([sentence('asset.non-positive-dimension')]);
		// A rejected commit KEEPS the user's typed value — it never reverts.
		expect((wrapper.get('[data-field="width"]').element as HTMLInputElement).value).toBe('0');
		expect(wrapper.emitted('submit')).toBeUndefined();
	});

	it('refuses one dimension given without the other, since a rectangle needs both', async () => {
		const createAsset = createOk();
		const setFootprintFromDimensions = footprintOk();

		const wrapper = await mountAndSubmit(
			{ createAsset, setFootprintFromDimensions },
			{ width: '1200', depth: '' },
		);

		expect(createAsset).not.toHaveBeenCalled();
		expect(wrapper.get('[data-field="depth"]').attributes('aria-invalid')).toBe('true');
		expect(wrapper.emitted('submit')).toBeUndefined();
		// **The assertion this case is actually for.** Without the incomplete-pair guard the
		// blank depth parses as `Number('') === 0` and `asset.non-positive-dimension` fires
		// instead — same fields, same `aria-invalid`, and a sentence telling the user that a
		// value they never typed must be greater than zero. Only the copy tells the two apart,
		// which is why the guard is not redundant and why this line exists.
		expect(messages(wrapper)).toEqual([sentence('asset.dimensions-incomplete')]);
	});

	/**
	 * The pair retires as a pair. Slice 16's rule is that editing a rejected field retires
	 * only its OWN message — and a cross-field claim IS one message about two fields, so
	 * correcting either half retires the whole claim.
	 */
	it('retires the paired dimension error when either half is edited', async () => {
		const wrapper = await mountAndSubmit(
			{ createAsset: createOk(), setFootprintFromDimensions: footprintOk() },
			{ width: '0', depth: '800' },
		);
		expect(wrapper.get('[data-field="depth"]').attributes('aria-invalid')).toBe('true');

		await wrapper.get('[data-field="width"]').setValue('1200');

		expect(wrapper.get('[data-field="width"]').attributes('aria-invalid')).toBeUndefined();
		expect(wrapper.get('[data-field="depth"]').attributes('aria-invalid')).toBeUndefined();
	});

	/**
	 * `Money.of` throws on either of these, and `CreateAssetCommand` calls it on its first
	 * line — so without the pre-validation these two presses reach the user as a mapped
	 * `vault.unexpected-failure` about a vault that was never opened. The assertion that
	 * discriminates is `createAsset` NOT having been called: a build that dispatched and
	 * rendered the fault would still show a message.
	 */
	it('refuses a malformed currency at its own field before anything is dispatched', async () => {
		const createAsset = createOk();

		const wrapper = await mountAndSubmit(
			{ createAsset, setFootprintFromDimensions: footprintOk() },
			{ currency: 'eur' },
		);

		expect(createAsset).not.toHaveBeenCalled();
		expect(wrapper.get('[data-field="currency"]').attributes('aria-invalid')).toBe('true');
	});

	it('refuses a malformed unit cost at its own field before anything is dispatched', async () => {
		const createAsset = createOk();

		const wrapper = await mountAndSubmit(
			{ createAsset, setFootprintFromDimensions: footprintOk() },
			{ unitCostAmount: '4,50' },
		);

		expect(createAsset).not.toHaveBeenCalled();
		expect(wrapper.get('[data-field="unitCostAmount"]').attributes('aria-invalid')).toBe('true');
	});

	it('routes a refused name to the name field and keeps what the user typed', async () => {
		const createAsset = vi.fn<CreateAsset>(() =>
			Promise.resolve(err(refusal('Validation', 'asset.empty-name'))),
		);

		const wrapper = await mountAndSubmit(
			{ createAsset, setFootprintFromDimensions: footprintOk() },
			{ name: '  ' },
		);

		expect(wrapper.get('[data-field="name"]').attributes('aria-invalid')).toBe('true');
		expect((wrapper.get('[data-field="name"]').element as HTMLInputElement).value).toBe('  ');
		expect(wrapper.find('.rp-form-banner').exists()).toBe(false);
		expect(wrapper.emitted('submit')).toBeUndefined();
	});

	/**
	 * **The sequence's real hazard.** The asset note is committed before the sidecar is
	 * touched, so a vault fault in between leaves an asset that exists and has no footprint.
	 * Re-creating it on the retry would turn one vault fault into two catalogue entries — and
	 * a catalogue is vault-wide since slice 19, so the duplicate is permanent and visible to
	 * every project.
	 */
	it('does not create a second asset when the footprint write fails and the user retries', async () => {
		const asset = makeAsset();
		const createAsset = createOk(asset);
		const setFootprintFromDimensions = vi
			.fn<SetFootprint>()
			.mockResolvedValueOnce(err(refusal('Persistence', 'vault.unexpected-failure')))
			.mockResolvedValueOnce(ok('wrote'));

		const wrapper = await mountAndSubmit(
			{ createAsset, setFootprintFromDimensions },
			{ width: '1200', depth: '800' },
		);
		expect(wrapper.emitted('submit')).toBeUndefined();

		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(createAsset).toHaveBeenCalledTimes(1);
		expect(setFootprintFromDimensions).toHaveBeenCalledTimes(2);
		expect(setFootprintFromDimensions.mock.calls[1][0].assetId).toBe(asset.id);
		expect(wrapper.emitted('submit')).toEqual([[asset.id]]);
	});

	/**
	 * The two SELECTS, which no other case touches — every one above leaves them at their
	 * defaults, so the whole category/unit path would be uncovered and a control wired to the
	 * wrong key would send the default and look right.
	 *
	 * Driven through the real `@change` handler rather than by setting the form's state, which
	 * is what makes this a test of the binding: `onFieldInput` is one generic handler over a
	 * key, so a select naming the wrong key compiles perfectly and fails here.
	 */
	it('sends the category and the unit the user chose', async () => {
		const createAsset = createOk();
		const wrapper = mount(NewAssetForm, {
			props: { createAsset, setFootprintFromDimensions: footprintOk(), logger: recorder },
		});
		await fill(wrapper, {});

		await wrapper.get('[data-field="category"]').setValue('building-element');
		await wrapper.get('[data-field="unit"]').setValue('m2');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(createAsset.mock.calls[0][0]).toEqual(
			expect.objectContaining({ category: 'building-element', unit: 'm2' }),
		);
	});

	/**
	 * `useDialogFormBusy`'s refusal arm, which is the half of that composable no case here
	 * reached: while a write is in flight a control must not accept an edit, and the RESTORE is
	 * what makes it visible — `refuseWhileSubmitting` puts the committed value back into the
	 * DOM node the user just typed into, because a `readonly` input still accepts a
	 * programmatic `setValue` and Vue would not re-render a value its own state never changed.
	 *
	 * It matters more on this form than on either sibling: the sequence keeps a created id
	 * across submits, so a name edited mid-write would be a name the already-created asset
	 * never had, with nothing downstream to notice.
	 */
	it('refuses an edit while the write is in flight, restoring what was committed', async () => {
		let release!: (result: Result<Asset, AppError>) => void;
		const createAsset = vi.fn<CreateAsset>(
			() =>
				new Promise((resolve) => {
					release = resolve;
				}),
		);
		const wrapper = mount(NewAssetForm, {
			props: { createAsset, setFootprintFromDimensions: footprintOk(), logger: recorder },
		});
		await fill(wrapper, { name: 'Kitchen island' });
		await wrapper.get('form').trigger('submit');

		await wrapper.get('[data-field="name"]').setValue('Something else');

		expect((wrapper.get('[data-field="name"]').element as HTMLInputElement).value).toBe(
			'Kitchen island',
		);
		release(ok(makeAsset()));
		await flushPromises();
		expect(createAsset.mock.calls[0][0]).toEqual(
			expect.objectContaining({ name: 'Kitchen island' }),
		);
	});

	/** A repeated submit is ONE intent pressed twice, so the second is DROPPED. */
	it('drops a second submit while the first is still in flight', async () => {
		let release!: (result: Result<Asset, AppError>) => void;
		const createAsset = vi.fn<CreateAsset>(
			() =>
				new Promise((resolve) => {
					release = resolve;
				}),
		);
		const wrapper = mount(NewAssetForm, {
			props: { createAsset, setFootprintFromDimensions: footprintOk(), logger: recorder },
		});
		await fill(wrapper, {});

		await wrapper.get('form').trigger('submit');
		await wrapper.get('form').trigger('submit');
		release(ok(makeAsset()));
		await flushPromises();

		expect(createAsset).toHaveBeenCalledTimes(1);
		expect(wrapper.emitted('submit')).toHaveLength(1);
	});
});
