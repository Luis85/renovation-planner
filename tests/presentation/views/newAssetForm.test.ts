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

	/**
	 * The preflight has to run the COMPLETE shape validation the command runs, not the half of
	 * it that happens to be about the two numbers.
	 *
	 * `Number.MIN_VALUE * 2` survives every guard `footprintFromDimensions` owns: it is
	 * positive, and its half is `Number.MIN_VALUE`, which is positive too. What it does not
	 * survive is `validateAssetShape`, because the shoelace products of four vertices that
	 * small all underflow to zero — so a preflight calling only the first of the two committed
	 * the asset note and THEN had the footprint refused, which is exactly the guarantee this
	 * form's header makes and the one its own header names as the sequence's real hazard.
	 *
	 * `createAsset` not having been called is the whole assertion: a build that dispatched and
	 * merely reported the refusal afterwards shows the same message.
	 */
	it('refuses a rectangle whose vertices collapse, before creating anything', async () => {
		const createAsset = createOk();
		const setFootprintFromDimensions = footprintOk();
		const subnormal = String(Number.MIN_VALUE * 2);

		const wrapper = await mountAndSubmit(
			{ createAsset, setFootprintFromDimensions },
			{ width: subnormal, depth: subnormal },
		);

		expect(createAsset).not.toHaveBeenCalled();
		expect(setFootprintFromDimensions).not.toHaveBeenCalled();
		expect(messages(wrapper)).toEqual([sentence('asset.degenerate-footprint')]);
		expect(wrapper.get('[data-field="width"]').attributes('aria-invalid')).toBe('true');
		expect(wrapper.get('[data-field="depth"]').attributes('aria-invalid')).toBe('true');
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
	 * **The other half of the retry rule, and the one it created.** Keeping the created id is
	 * what stops a second catalogue entry — and it also means every later submit SKIPS
	 * `createAsset` entirely, so a user who corrects the name before retrying watched the
	 * dialog succeed and close over an asset that still carries the old one. An edit accepted
	 * by an input and discarded by the code behind it is worse than an edit refused.
	 *
	 * The five catalogue fields are frozen once the note exists, which says the true thing:
	 * the entry is in the vault, and what this dialog has left to do is its footprint. The two
	 * dimensions stay live, because they are exactly what the retry re-dispatches.
	 */
	it('freezes the catalogue fields once the asset exists, and says why', async () => {
		const createAsset = createOk();
		const setFootprintFromDimensions = vi
			.fn<SetFootprint>()
			.mockResolvedValueOnce(err(refusal('Persistence', 'vault.unexpected-failure')))
			.mockResolvedValueOnce(ok('wrote'));

		const wrapper = await mountAndSubmit(
			{ createAsset, setFootprintFromDimensions },
			{ width: '1200', depth: '800' },
		);

		// NEVER `:disabled`, which is the framework invariant `FormDialog.vue` states and
		// `formBusy.test.ts` drives through the real Tab trap: a disabled control matches no
		// focusable selector, and Chromium blurs it to `<body>` — outside `.rp-dialog`, where
		// `DialogHost` binds `Escape`. The freeze flips WHILE the dialog is open, so the
		// control the user is standing on is exactly the one that would be blurred.
		//
		// `readonly` on the three inputs and `aria-disabled` on the two selects, which is the
		// split `useDialogFormBusy`'s docblock already states and the split
		// `styles/dialogs.css` already dims: `readonly` does nothing at all to a `<select>`.
		for (const field of ['name', 'unitCostAmount', 'currency']) {
			const control = wrapper.get(`[data-field="${field}"]`);
			expect(control.attributes('readonly')).toBeDefined();
			expect(control.attributes('disabled')).toBeUndefined();
		}
		for (const field of ['category', 'unit']) {
			const control = wrapper.get(`[data-field="${field}"]`);
			expect(control.attributes('aria-disabled')).toBe('true');
			expect(control.attributes('disabled')).toBeUndefined();
		}
		for (const field of ['width', 'depth']) {
			const control = wrapper.get(`[data-field="${field}"]`);
			expect(control.attributes('disabled')).toBeUndefined();
			expect(control.attributes('readonly')).toBeUndefined();
			expect(control.attributes('aria-disabled')).toBeUndefined();
		}
		expect(wrapper.find('.rp-new-asset__created').exists()).toBe(true);
	});

	/**
	 * **The half that matters most, and the one an `<input>`-only case would miss entirely.**
	 *
	 * The five frozen controls are inoperative rather than `:disabled`, and `aria-disabled` is
	 * advisory: it blocks nothing in the DOM. For the three text inputs `readonly` is a real
	 * native refusal, so they are safe either way — but `readonly` does NOTHING to a
	 * `<select>`, which is the reason this form reached for `:disabled` in the first place.
	 * What stands between a frozen select and an edit the code behind it silently discards is
	 * `useDialogFormBusy`'s restore, and nothing else.
	 *
	 * Asserted twice on purpose. The value immediately after the change is the RESTORE — the
	 * composable putting the committed value back into the DOM node the browser already moved.
	 * The value after a tick is that no re-render disagreed with it, which is what says
	 * `setField` was never called: had the edit landed, `form.values.category` would hold
	 * `building-element` and the binding would paint it straight back.
	 */
	it('refuses an edit to a frozen select, restoring the value the created asset carries', async () => {
		const createAsset = createOk();
		const setFootprintFromDimensions = vi
			.fn<SetFootprint>()
			.mockResolvedValue(err(refusal('Persistence', 'vault.unexpected-failure')));

		const wrapper = await mountAndSubmit(
			{ createAsset, setFootprintFromDimensions },
			{ width: '1200', depth: '800' },
		);
		const category = wrapper.get('[data-field="category"]');

		await category.setValue('building-element');

		expect((category.element as HTMLSelectElement).value).toBe('material');
		await flushPromises();
		expect((category.element as HTMLSelectElement).value).toBe('material');
	});

	/**
	 * **A fractional millimetre is an ordinary dimension, and without `step` the browser
	 * refuses to submit the form at all.** HTML's default step for `type="number"` is 1 and the
	 * step base is `min`, so `600.5` is a `stepMismatch`; the `<form>` carries no `novalidate`,
	 * and `@submit.prevent` only prevents the default AFTER submit fires — it does not disable
	 * constraint validation. So `onSubmit` never runs, none of this form's own routing happens,
	 * and the user gets an untranslated native bubble instead of a field error.
	 *
	 * The domain accepts it: the only `Number.isInteger` guard in `src/domain/` is a PDF page
	 * number. `KnownDistanceForm.vue` already pairs `min="0"` with `step="any"` for this exact
	 * reason, and a grep for `type="number"` across `src/presentation/` returns three inputs —
	 * that one and these two — so the class is closed by this case. `any` rather than a
	 * fractional step, because a concrete `0.1` would silently reject `600.55`.
	 *
	 * **Driven through `checkValidity()` rather than by asserting the attribute**, which is a
	 * stronger instrument than it first looks: jsdom really does implement `stepMismatch`, so
	 * this reads the CONDITION the browser would refuse on rather than the markup that avoids
	 * it — measured, `600.5` in a `min="0"` number input with no `step` reports
	 * `stepMismatch: true`. What jsdom cannot reproduce is the half after that: `trigger()`
	 * dispatches the event directly and never runs the form's implicit submission algorithm, so
	 * no case here can watch a real browser withhold `submit`. That half is a vault walkthrough.
	 */
	it('accepts a fractional millimetre in either dimension', async () => {
		const wrapper = mount(NewAssetForm, {
			props: {
				createAsset: createOk(),
				setFootprintFromDimensions: footprintOk(),
				logger: recorder,
			},
		});
		await fill(wrapper, { width: '600.5', depth: '399.25' });

		for (const field of ['width', 'depth']) {
			const control = wrapper.get(`[data-field="${field}"]`).element as HTMLInputElement;
			expect(control.validity.stepMismatch).toBe(false);
			expect(control.checkValidity()).toBe(true);
		}
	});

	/**
	 * The input half of the case above, kept beside it because the two are ONE rule with two
	 * spellings and a case for only one of them reads as if the other were covered. Found by
	 * mutation: un-marking the three frozen inputs reddened the attribute assertion and nothing
	 * behavioural, so what a frozen NAME field actually does was asserted by no case at all.
	 *
	 * `readonly` is a real native refusal in a browser, which is why the inputs take it rather
	 * than `aria-disabled` — but `setValue` writes straight past it, so what this case exercises
	 * is the same restore the select relies on. That is the honest reading of it: it proves the
	 * belt, and the braces are the attribute the case above pins.
	 */
	it('refuses an edit to a frozen text field, restoring the value the created asset carries', async () => {
		const createAsset = createOk();
		const setFootprintFromDimensions = vi
			.fn<SetFootprint>()
			.mockResolvedValue(err(refusal('Persistence', 'vault.unexpected-failure')));

		const wrapper = await mountAndSubmit(
			{ createAsset, setFootprintFromDimensions },
			{ width: '1200', depth: '800' },
		);
		const name = wrapper.get('[data-field="name"]');

		await name.setValue('Something else');

		expect((name.element as HTMLInputElement).value).toBe('Kitchen island');
		await flushPromises();
		expect((name.element as HTMLInputElement).value).toBe('Kitchen island');
	});

	/**
	 * The other direction, and the one an over-correction breaks: widening the refusal to
	 * "every field while frozen" leaves the retry unable to change the very numbers it exists
	 * to re-dispatch. Asserted on the COMMAND INPUT rather than on the rendered value, because
	 * a restored DOM node and a committed one look identical in the markup a tick later.
	 */
	it('keeps the two dimensions editable while the catalogue is frozen', async () => {
		const createAsset = createOk();
		const setFootprintFromDimensions = vi
			.fn<SetFootprint>()
			.mockResolvedValueOnce(err(refusal('Persistence', 'vault.unexpected-failure')))
			.mockResolvedValueOnce(ok('wrote'));

		const wrapper = await mountAndSubmit(
			{ createAsset, setFootprintFromDimensions },
			{ width: '1200', depth: '800' },
		);

		await wrapper.get('[data-field="width"]').setValue('1500');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(setFootprintFromDimensions.mock.calls[1][0]).toEqual(
			expect.objectContaining({ width: 1500, depth: 800 }),
		);
	});

	it('leaves every field editable while nothing has been created', async () => {
		const wrapper = mount(NewAssetForm, {
			props: {
				createAsset: createOk(),
				setFootprintFromDimensions: footprintOk(),
				logger: recorder,
			},
		});
		await fill(wrapper, {});

		for (const field of ['name', 'category', 'unit', 'unitCostAmount', 'currency']) {
			expect(wrapper.get(`[data-field="${field}"]`).attributes('disabled')).toBeUndefined();
		}
		expect(wrapper.find('.rp-new-asset__created').exists()).toBe(false);
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
