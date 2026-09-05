/**
 * @vitest-environment jsdom
 *
 * The section a user reaches to price a shared catalogue asset for one project.
 *
 * Everything is driven through `AssetPriceList` — the component `ProjectDetail` mounts — rather
 * than through `AssetPriceRow` directly, because the row exists only inside this list and a case
 * that mounted it alone would certify a component nothing composes that way.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import AssetPriceList from '../../../src/presentation/views/AssetPriceList.vue';
import { createMoney, type Money } from '../../../src/core/money/Money';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { ValidationError } from '../../../src/core/errors/AppError';
import type { Logger } from '../../../src/application/ports/Logger';
import type { AssetPriceRowDto } from '../../../src/application/queries/ListProjectAssetPrices';
import type { AssetPriceOverrideId } from '../../../src/domain/asset-price/AssetPriceOverrideId';
import type { EntityVersion, ObservationToken } from '../../../src/application/ports/versioning';
import type {
	AssetPriceCommitResult,
	AssetPriceEdit,
} from '../../../src/presentation/views/assetPriceEdit';
import { t } from '../../../src/presentation/i18n/strings';
import { trError } from '../../../src/presentation/i18n/toUserMessage';
import { activateNotices, disposeNotices } from '../../../src/presentation/notices/notify';
import { installObsidianDom } from '../../helpers/dom';
import { Notice } from '../../helpers/obsidian-mock';

const logger: Logger = {
	debug: () => undefined,
	info: () => undefined,
	warn: () => undefined,
	error: () => undefined,
};

/**
 * `createMoney` rather than `of`, and this is the constructor the component itself mints with —
 * a fixture built through the other door could hold an amount the component's own validator
 * refuses, which is the disagreement this whole file is partly about.
 */
function money(amount: string, currency = 'GBP'): Money {
	const minted: Result<Money, ValidationError> = createMoney(amount, currency);
	if (!minted.ok) throw new Error(`unmintable fixture: ${amount} ${currency}`);
	return minted.value;
}

const version = (revision: number): EntityVersion => ({
	revision,
	observed: `observed-${revision}` as ObservationToken,
});

interface RowOptions {
	assetId?: string;
	assetName?: string | null;
	catalogue?: Money | null;
	override?: Money | null;
	overrideRevision?: number;
	assetStatus?: AssetPriceRowDto['assetStatus'];
}

/**
 * One row, ANNOTATED as the DTO the component's prop declares, so a member the query grows is a
 * compile error here rather than an `undefined` the template reads happily.
 *
 * `overrideId`/`overrideVersion` are derived from `override` rather than taken separately: the
 * three travel together on the real DTO — an override IS a note at a version — and a fixture
 * that could spell a price with no id would be a row the query never produces.
 */
function row(over: RowOptions = {}): AssetPriceRowDto {
	const override = over.override ?? null;
	return {
		assetId: over.assetId ?? 'a1',
		assetName: over.assetName === undefined ? 'Oak flooring' : over.assetName,
		catalogue: over.catalogue === undefined ? money('24.00') : over.catalogue,
		override,
		overrideId: override === null ? null : ('op-1' as AssetPriceOverrideId),
		overrideVersion: override === null ? null : version(over.overrideRevision ?? 1),
		assetStatus: over.assetStatus ?? 'known',
	};
}

/** A commit that accepts everything and reports the pair it left behind. */
const accepts = (): AssetPriceCommitResult => ({
	dispatch: ok('wrote'),
	settled: { id: 'op-2' as AssetPriceOverrideId, version: version(9) },
});

function mountSection(options: {
	rows?: readonly AssetPriceRowDto[];
	currency?: string;
	commit?: (edit: AssetPriceEdit) => Promise<AssetPriceCommitResult>;
} = {}) {
	const commit = vi.fn<(edit: AssetPriceEdit) => Promise<AssetPriceCommitResult>>(
		options.commit ?? (() => Promise.resolve(accepts())),
	);
	const wrapper = mount(AssetPriceList, {
		props: {
			rows: options.rows ?? [row()],
			currency: options.currency ?? 'GBP',
			commit,
			logger,
		},
	});
	return { wrapper, commit };
}

describe('AssetPriceList', () => {
	it('renders one row per asset, with the library price and an empty field where there is no override', () => {
		const { wrapper } = mountSection({
			rows: [row({ assetId: 'a1', assetName: 'Oak flooring' }), row({ assetId: 'a2', assetName: 'Paint' })],
		});

		expect(wrapper.findAll('.rp-asset-price-row')).toHaveLength(2);
		expect(wrapper.get('.rp-asset-price-catalogue').text()).toContain('24.00');
		expect(wrapper.get('.rp-asset-price-catalogue').text()).toContain(t('en', 'view.project.price-catalogue'));
		expect((wrapper.get('input').element as HTMLInputElement).value).toBe('');
	});

	it('renders the project’s own price in the field where there is one', () => {
		const { wrapper } = mountSection({ rows: [row({ override: money('19.50') })] });

		expect((wrapper.get('input').element as HTMLInputElement).value).toBe('19.50');
	});

	/**
	 * §89's "beside what it replaced", as a FIGURE rather than only as the input's contents — a
	 * control holding a number is not a statement about what is in force. Drawn only where there
	 * IS an override: a row without one has nothing to put here that the library price does not
	 * already say.
	 */
	it('prints this project’s own price beside the library default, and only where there is one', () => {
		const { wrapper } = mountSection({
			rows: [row({ assetId: 'a1', override: money('19.50') }), row({ assetId: 'a2' })],
		});

		const yours = wrapper.findAll('.rp-asset-price-yours');
		expect(yours).toHaveLength(1);
		expect(yours[0]?.text()).toContain(t('en', 'view.project.price-yours'));
		expect(yours[0]?.text()).toContain('19.50 GBP');
	});

	/**
	 * **The field says which currency it is in, and the capture is what said it had to.** The
	 * input held `41.50` beside `Library price: 48.00 EUR` with nothing naming the currency of the
	 * typed number — and the one place that WAS said, the header's `Priced in GBP`, is pinned
	 * above a body that has scrolled the whole plan list past by the time a row is on screen. Two
	 * numbers in one row read as one currency unless something says otherwise, which is precisely
	 * the confusion this increment exists to end.
	 *
	 * On the LABEL rather than as a decoration beside the input, so it is part of the control's
	 * accessible name rather than an adjacent string a screen reader may or may not reach.
	 */
	it('names the project’s currency on the field’s own label', () => {
		const { wrapper } = mountSection({ rows: [row({ catalogue: money('24.00', 'EUR') })], currency: 'GBP' });

		expect(wrapper.get('label').text()).toContain('GBP');
		expect(wrapper.get('label').text()).toContain(t('en', 'view.project.price-set'));
		// The asset name stays IN the accessible name, visually hidden: `Set a price (GBP)` on
		// every row is a set of identical labels, and a screen-reader user moving between them by
		// form control would hear the same words each time.
		expect(wrapper.get('label').text()).toContain('Oak flooring');
		expect(wrapper.find('label .rp-visually-hidden').exists()).toBe(true);
	});

	it.each([['0', '0'], ['12,50', '12.50'], ['12.5', '12.5']])('applies the decimal input %s without grouping or floating-point conversion', async (draft, amount) => {
		const { wrapper, commit } = mountSection();
		await wrapper.get('input').setValue(draft);
		await wrapper.get('.rp-asset-price-apply').trigger('click'); await flushPromises();
		expect(commit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ kind: 'set', unitCost: expect.objectContaining({ amount, currency: 'GBP' }) }));
		expect(wrapper.find('.rp-asset-price-apply').exists()).toBe(false);
	});

	it('dispatches a set for a typed price on explicit Apply', async () => {
		const { wrapper, commit } = mountSection();

		await wrapper.get('input').setValue('19.50');
		await wrapper.get('input').trigger('keydown', { key: 'Enter' });
		await flushPromises();

		expect(commit).toHaveBeenCalledTimes(1);
		expect(commit).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'set', assetId: 'a1' }),
		);
	});

	/**
	 * The row supplies the expectation the command needs — `overrideVersion` when it rendered a
	 * price, `'absent'` when it rendered none. Task 8's DTO carries those fields for exactly
	 * this; a row that dispatched without them would make the command a blind overwrite.
	 */
	it('passes the row expectation into the command', async () => {
		const { wrapper, commit } = mountSection({ rows: [row({ override: money('19.50'), overrideRevision: 3 })] });

		await wrapper.get('input').setValue('21.00');
		await wrapper.get('input').trigger('keydown', { key: 'Enter' });
		await flushPromises();

		expect(commit).toHaveBeenCalledWith(
			expect.objectContaining({ expected: { id: 'op-1', version: version(3) } }),
		);
	});

	it('passes an absent expectation from a row with no override', async () => {
		const { wrapper, commit } = mountSection();

		await wrapper.get('input').setValue('19.50');
		await wrapper.get('input').trigger('keydown', { key: 'Enter' });
		await flushPromises();

		expect(commit).toHaveBeenCalledWith(expect.objectContaining({ expected: 'absent' }));
	});

	/**
	 * **The expectation is the one this row LAST KNEW, not the one it is rendering.**
	 *
	 * Reading it at dispatch time defeats the whole guard at exactly the moment it is needed:
	 * `useFieldCommit` deliberately keeps an uncommitted draft while the canonical value moves
	 * underneath it, so a sync or another leaf refreshes the row to a new
	 * `overrideId`/`overrideVersion`, the user's blur then builds `expected` from the REFRESHED
	 * row, and the stale draft saves over the price the user never saw. That is the lost update
	 * the required expectation exists to stop, reintroduced one layer above the command.
	 *
	 * Watched failing against a component that reads the props at dispatch time: the call then
	 * carries version 2, which is this assertion inverted.
	 */
	it('submits the expectation the row had when editing began, not the refreshed one', async () => {
		const { wrapper, commit } = mountSection({
			rows: [row({ override: money('19.50'), overrideRevision: 1 })],
		});

		await wrapper.get('input').setValue('21.00');
		// Another leaf's write, landing under an uncommitted draft.
		await wrapper.setProps({ rows: [row({ override: money('30.00'), overrideRevision: 2 })] });
		await wrapper.get('input').trigger('keydown', { key: 'Enter' });
		await flushPromises();

		expect(commit).toHaveBeenCalledWith(
			expect.objectContaining({ expected: { id: 'op-1', version: version(1) } }),
		);
	});

	/** Slice 16's rule: a rejected commit KEEPS the user's value and shows the error. */
	it('keeps the typed value and shows an inline error when the command refuses', async () => {
		const refusal: ValidationError = {
			category: 'Validation',
			code: 'asset-price.currency-mismatch',
			message: 'developer English',
		};
		const { wrapper } = mountSection({
			// A refusal establishes nothing, so the snapshot must not move.
			commit: () => Promise.resolve({ dispatch: err(refusal), settled: null }),
		});

		await wrapper.get('input').setValue('19.50');
		await wrapper.get('input').trigger('keydown', { key: 'Enter' });
		await flushPromises();

		expect((wrapper.get('input').element as HTMLInputElement).value).toBe('19.50');
		expect(wrapper.get('.rp-field-error__message').text()).toContain(t('en', 'asset-price.currency-mismatch'));
	});

	/**
	 * The guard `RequirementRow` had to learn the hard way: pressing clear on a row with no
	 * override must dispatch NOTHING. A command for a no-op is a read, an event nobody needs and
	 * a gesture standing for a change nobody made.
	 */
	it('offers no removal for a first draft, and discards it without writing', async () => {
		const { wrapper, commit } = mountSection();
		expect(wrapper.find('.rp-asset-price-clear').exists()).toBe(false);
		await wrapper.get('input').setValue('12,50');
		await wrapper.get('input').trigger('blur');
		expect(commit).not.toHaveBeenCalled();
		await wrapper.get('.rp-asset-price-cancel').trigger('click');
		expect((wrapper.get('input').element as HTMLInputElement).value).toBe('');
		expect(commit).not.toHaveBeenCalled();
	});	/**
	 * The other half, which an `override === null` test alone certifies WRONG: type a price into
	 * an empty row, **Tab to the clear button** — so the blur really is a separate commit gesture
	 * — and press it before the vault answers. Treating that as a no-op discards the user's
	 * cancellation and lets the set persist: the gesture the user made is the one thing that does
	 * not happen. Routed through `onCommit` instead, it becomes the queued follow-up the
	 * composable's coalescing already knows how to answer.
	 *
	 * **The keyboard is load-bearing in this setup.** With `@mousedown.prevent` on the button a
	 * CLICK no longer blurs, so a version of this case driven by a click would assert the
	 * opposite of its pointer sibling below and one of the two would have to be wrong. Tab
	 * commits and click does not; that asymmetry is the contract.
	 *
	 * The clear's `expected` names what the SET wrote, which is the whole reason `commit` returns
	 * `settled` rather than a bare `DispatchResult`: the queued clear is built after the set
	 * settles, so with no channel from the set's own result it would submit `'absent'` against a
	 * pair the set had just created and refuse — the user's cancellation failing for the second
	 * time in one gesture.
	 */
	it('locks the row while Apply is writing; cancel is never undo', async () => {
		let release!: () => void;
		const held = new Promise<void>((resolve) => { release = resolve; });
		const { wrapper, commit } = mountSection({ rows: [row({ override: money('19.50') })], commit: async () => { await held; return accepts(); } });
		await wrapper.get('input').setValue('12,50');
		await wrapper.get('.rp-asset-price-apply').trigger('click');
		expect(wrapper.get('input').attributes('disabled')).toBeDefined();
		expect(wrapper.get('.rp-asset-price-cancel').attributes('disabled')).toBeDefined();
		expect(wrapper.get('.rp-asset-price-clear').attributes('disabled')).toBeDefined();
		await wrapper.get('input').trigger('keydown.esc');
		expect(commit).toHaveBeenCalledTimes(1);
		release();
		await flushPromises();
		expect(commit).toHaveBeenCalledTimes(1);
		expect(commit.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ unitCost: money('12.50') }));
	});	/**
	 * The POINTER path, and the guard that makes it differ: a browser blurs the input on the
	 * button's `mousedown`, before the `click` that runs the handler, so one gesture on a dirty
	 * field becomes a set THEN a clear — two writes, two events and two project-wide cascades for
	 * one click, with the discarded price left standing if the clear refuses.
	 *
	 * The real sequence is driven (`mousedown`, then blur, then `click`) rather than `click()`
	 * alone, which jsdom does not expand into it: a case that only clicks passes against a button
	 * with no guard at all.
	 *
	 * **The blur is CONDITIONAL on the mousedown's `defaultPrevented`**, and an unconditional one
	 * inverts this case. jsdom never links `mousedown` to focus loss —
	 * `requirementRowFieldErrors.test.ts`'s identical guard already says so — so hand-firing blur
	 * regardless would fire it whether or not `@mousedown.prevent` ran, and the CORRECT component
	 * would also commit a set before the clear: red on correct and no redder on the mutation. So
	 * the browser's own default action is what is modelled: dispatch a cancelable `mousedown`,
	 * read `defaultPrevented` off that SAME event, and blur only when it reads `false`.
	 *
	 * Watched failing with `@mousedown.prevent` removed: `defaultPrevented` then reads `false`,
	 * the blur fires, and `commit` is called twice with the set first.
	 */
	it('dispatches only the clear when the button is clicked on a dirty field', async () => {
		const { wrapper, commit } = mountSection({ rows: [row({ override: money('19.50') })] });
		const input = wrapper.get('input');
		await input.setValue('25.00');

		const button = wrapper.get('.rp-asset-price-clear');
		const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
		button.element.dispatchEvent(mousedown);
		if (!mousedown.defaultPrevented) await input.trigger('keydown', { key: 'Enter' });
		await button.trigger('click');
		await flushPromises();

		expect(commit).toHaveBeenCalledTimes(1);
		expect(commit).toHaveBeenCalledWith(expect.objectContaining({ kind: 'clear' }));
	});

	/**
	 * Enter commits, and it is a SEPARATE binding from blur rather than a synonym for it: a user
	 * who types a price and presses Enter without leaving the field would otherwise watch it sit
	 * there unsaved, which is the defect `RequirementRow` shipped once and had to bind Enter for.
	 */
	it('dispatches once on Enter', async () => {
		const { wrapper, commit } = mountSection();

		await wrapper.get('input').setValue('19.50');
		await wrapper.get('input').trigger('keydown.enter');
		await flushPromises();

		expect(commit).toHaveBeenCalledTimes(1);
		expect(commit).toHaveBeenCalledWith(expect.objectContaining({ kind: 'set' }));
	});

	/**
	 * **A refusal this field cannot SHOW has to reach the USER, not a log file.**
	 *
	 * FOUR codes go under the field. Everything else — `asset-price.write-failed`,
	 * `delete-failed`, `project-not-found`, `asset-not-found`, `entity-invalid`,
	 * `frontmatter-invalid`, and every `vault.unexpected-failure` a guard mapped — routes to the
	 * banner arm, which `useFieldCommit` converts to `error = null` because this section has no
	 * banner region. That is exactly the silence its required `notify` parameter exists to
	 * prevent, and this binding shipped as a bare `logger.warn` for one round: no inline error,
	 * no toast, no badge. Reported by a reviewer.
	 *
	 * Asserted on `Notice.shown`, never on a logger call: a log assertion passes in BOTH worlds,
	 * which is what let the defect ship. The absence of the inline error is asserted beside it,
	 * because that is what makes the notice the ONLY channel this refusal has.
	 *
	 * `activateNotices()` per test rather than once for the file, for the reason
	 * `inspectorFaults.test.ts` states about its own: the queue DEDUPS on the
	 * `(severity, message)` pair, so a second case raising the same mapped sentence would fold
	 * into a `(×2)` and construct no `Notice` at all.
	 */
	it('reaches the user with a notice for a refusal it cannot place under the field', async () => {
		installObsidianDom();
		activateNotices();
		const before = Notice.shown.length;
		const refusal = {
			category: 'Persistence',
			code: 'asset-price.write-failed',
			message: 'developer English',
		} as const;
		const { wrapper } = mountSection({
			commit: () => Promise.resolve({ dispatch: err(refusal), settled: null }),
		});

		await wrapper.get('input').setValue('19.50');
		await wrapper.get('input').trigger('keydown', { key: 'Enter' });
		await flushPromises();

		expect(Notice.shown.length - before).toBe(1);
		// MAPPED, never the developer English in `message`: `toUserMessage` is the one place an
		// `AppError` becomes copy, and this code has an entry of its own in both locales.
		expect(Notice.shown.at(-1)).toBe(trError(refusal));
		expect(wrapper.find('.rp-field-error__message').exists()).toBe(false);
		disposeNotices();
	});

	/**
	 * The project-wide warning, which is the disclosure that justifies this affordance living on
	 * the project surface rather than on the Inspector's requirement row. Asserted on the
	 * rendered TEXT and asserted ONCE — a per-row repetition would read as a per-row consequence,
	 * which is the opposite of what it says.
	 *
	 * A rendering case rather than a locale case on purpose: a key present in `en.ts` and rendered
	 * nowhere passes every i18n gate this repository has, because `I18N_LITERAL_BAN` fires at a
	 * literal and never at an absent one.
	 */
	it('discloses that a price here reprices every requirement in the project, once', () => {
		const { wrapper } = mountSection({ rows: [row({ assetId: 'a1' }), row({ assetId: 'a2' })] });

		expect(wrapper.findAll('.rp-asset-price-scope')).toHaveLength(1);
		expect(wrapper.get('.rp-asset-price-scope').text()).toBe(t('en', 'view.project.price-scope'));
	});

	/**
	 * The ORPHAN row: `assetStatus: 'orphan'`, so `assetName` and `catalogue` are both null. It
	 * must be VISIBLE and CLEARABLE and must not accept a new price — a set on a missing asset
	 * mints data nothing can price, and `SetAssetPriceOverrideCommand` reads the asset and
	 * refuses, so a live input here dispatches a guaranteed refusal.
	 *
	 * All three are asserted, because each is a different mistake: a component that drops the row
	 * leaves the price unreachable, one that disables the whole row leaves it undeletable, and
	 * one that leaves the input live ships a control that cannot succeed.
	 */
	it('renders an orphaned override with its id, no library price, and only Clear live', () => {
		const { wrapper } = mountSection({
			rows: [row({ assetName: null, catalogue: null, override: money('19.50'), assetStatus: 'orphan' })],
		});

		expect(wrapper.get('.rp-asset-price-name').text()).toBe('a1');
		expect(wrapper.find('.rp-asset-price-catalogue').exists()).toBe(false);
		expect(wrapper.get('.rp-asset-price-orphan').text()).toBe(t('en', 'view.project.price-orphan'));
		expect(wrapper.find('.rp-asset-price-unreadable').exists()).toBe(false);
		expect(wrapper.get('input').attributes('disabled')).toBeDefined();
		expect(wrapper.get('.rp-asset-price-clear').attributes('disabled')).toBeUndefined();
	});

	/**
	 * The UNREADABLE row — an override whose asset note still exists but would not parse today.
	 * `assetName` and `catalogue` are null here too, exactly as on the orphan row, which is
	 * precisely why this case exists separately: a component keying its markup off
	 * `assetName === null` alone cannot tell the two apart and would show the wrong sentence
	 * beside whichever row it guesses.
	 *
	 * The input is DISABLED, not live. `SetAssetPriceOverrideCommand` reads the asset before it
	 * reaches the write and propagates a failed read unchanged, so a set dispatched against this
	 * row refuses EVERY time; an enabled input over a refusal that can never succeed is the
	 * live-control-that-does-nothing slice 14's amendment refuses. Clear stays live, unaffected,
	 * because this asset's continued existence was never in doubt.
	 */
	it('renders an unreadable override with its id, no library price, and a disabled price input', () => {
		const { wrapper } = mountSection({
			rows: [row({ assetName: null, catalogue: null, override: money('19.50'), assetStatus: 'unreadable' })],
		});

		expect(wrapper.get('.rp-asset-price-name').text()).toBe('a1');
		expect(wrapper.find('.rp-asset-price-catalogue').exists()).toBe(false);
		expect(wrapper.get('.rp-asset-price-unreadable').text()).toBe(t('en', 'view.project.price-unreadable'));
		expect(wrapper.find('.rp-asset-price-orphan').exists()).toBe(false);
		expect(wrapper.get('input').attributes('disabled')).toBeDefined();
		expect(wrapper.get('.rp-asset-price-clear').attributes('disabled')).toBeUndefined();
	});

	/**
	 * The increment's central case, at the surface: a GBP project, an EUR catalogue asset, no
	 * override. The submitted `Money` must be GBP.
	 *
	 * Watched failing against a component that mints from the row's own effective currency: the
	 * call then carries EUR, `SetAssetPriceOverrideCommand` refuses it on the coherence rule, and
	 * the dead end this increment exists to close is reachable through the shipped surface.
	 */
	it('submits the typed price in the project currency, not the catalogue currency', async () => {
		const { wrapper, commit } = mountSection({
			rows: [row({ catalogue: money('24.00', 'EUR'), override: null })],
			currency: 'GBP',
		});

		await wrapper.get('input').setValue('19.50');
		await wrapper.get('input').trigger('keydown', { key: 'Enter' });
		await flushPromises();

		expect(commit).toHaveBeenCalledWith(
			expect.objectContaining({
				unitCost: expect.objectContaining({ amount: '19.50', currency: 'GBP' }),
			}),
		);
	});

	/**
	 * A negative price never reaches the command. `Money` is signed on purpose and
	 * `createMoney('-1.00', 'GBP')` SUCCEEDS, so without `useFieldCommit`'s `validate` the
	 * dispatch happens, `AssetPriceOverride.create` refuses with
	 * `asset-price.negative-unit-cost`, and the user is told a price cannot be negative by a
	 * round trip to the vault.
	 *
	 * Watched failing against a component with no negative arm: `commit` is called, which is the
	 * first assertion inverted.
	 */
	it('refuses a negative price at the field, dispatching nothing', async () => {
		const { wrapper, commit } = mountSection();

		await wrapper.get('input').setValue('-1.00');
		await wrapper.get('input').trigger('keydown', { key: 'Enter' });
		await flushPromises();

		expect(commit).not.toHaveBeenCalled();
		expect(wrapper.get('.rp-field-error__message').text()).toContain(t('en', 'view.project.price-negative'));
	});

	/**
	 * The forms `moneyOf` accepts and `createMoney` refuses — the reason the validator uses the
	 * constructor that MINTS. Watched failing against a validator built on `RequirementRow`'s
	 * `canBeMoney`: `+1`, `.5` and `1e3` all pass `LITERAL_PATTERN`, so the commit is reached
	 * holding a `Result` it has no arm for. `abc` is the control that fails either way.
	 */
	it.each(['abc', '.5', '+1', '1e3', '1.234', '1,234.50', '01', '', '-0'])('refuses %s at the field, dispatching nothing', async (draft) => {
		const { wrapper, commit } = mountSection();

		await wrapper.get('input').setValue(draft);
		await wrapper.get('input').trigger('keydown', { key: 'Enter' });
		await flushPromises();

		expect(commit).not.toHaveBeenCalled();
		expect(wrapper.get('.rp-field-error__message').text()).toContain(t('en', 'view.project.price-invalid'));
	});

	/**
	 * Escape DISCARDS, and the discard is the recovery the staleness copy names: it returns the
	 * field to clean, which re-arms the snapshot from the refreshed row. Without that, a field
	 * refused for `asset-price.revision-conflict` could never be submitted again, because its
	 * frozen expectation names a version the vault has moved past.
	 *
	 * Asserted on the SUBMITTED EXPECTATION rather than on the field's text, which is what
	 * discriminates: a component that cleared the draft and kept the frozen snapshot renders
	 * identically and still submits version 1.
	 */
	it('re-arms the expectation from the refreshed row after Escape', async () => {
		const { wrapper, commit } = mountSection({
			rows: [row({ override: money('19.50'), overrideRevision: 1 })],
		});

		const input = wrapper.get('input');
		await input.setValue('21.00');
		await wrapper.setProps({ rows: [row({ override: money('30.00'), overrideRevision: 2 })] });
		await input.trigger('keydown.esc');
		await input.setValue('31.00');
		await input.trigger('keydown', { key: 'Enter' });
		await flushPromises();

		expect(commit).toHaveBeenCalledWith(
			expect.objectContaining({ expected: { id: 'op-1', version: version(2) } }),
		);
	});

	/**
	 * **The hole jsdom cannot see, and this repository has already paid for it once**
	 * (`rp-save-state-error` against a template emitting `rp-save-state-save-error`): jsdom
	 * resolves no CSS, so a class this section emits and no partial declares renders unstyled with
	 * every other case in this file still green.
	 *
	 * The class list is HARVESTED from the mounted DOM rather than transcribed, so renaming one in
	 * either template fails here instead of quietly shipping an unstyled row. Both unhappy rows and
	 * the empty state are mounted, because each draws classes the happy row does not.
	 */
	it('declares a rule for every class it actually emits', () => {
		// Both partials: `rp-visually-hidden` moved to its own partial (`visually-hidden.css`)
		// at its second caller, and this harvest must keep seeing a real declaration for it
		// rather than coincidentally matching prose in a comment.
		const css = readFileSync('styles/asset-prices.css', 'utf8')
			+ readFileSync('styles/visually-hidden.css', 'utf8');
		const emitted = new Set<string>();
		for (const rows of [
			[row({ override: money('19.50') })],
			[row({ assetName: null, catalogue: null, override: money('1.00'), assetStatus: 'orphan' })],
			[row({ assetName: null, catalogue: null, override: money('1.00'), assetStatus: 'unreadable' })],
			[],
		]) {
			const { wrapper } = mountSection({ rows });
			for (const el of wrapper.findAll('[class]')) {
				for (const name of el.element.classList) {
					if (name.startsWith('rp-asset-price') || name === 'rp-visually-hidden') emitted.add(name);
				}
			}
		}

		expect(emitted.size).toBeGreaterThan(8);
		// A trailing boundary, not `toContain`: `rp-asset-price` is a PREFIX of every class here,
		// so a plain substring test would credit `.rp-asset-price-row` to a sheet declaring only
		// `.rp-asset-price-row-something`.
		for (const name of emitted) expect(css).toMatch(new RegExp(`\\.${name}(?![\\w-])`));
	});

	/**
	 * **Ruling 16: a REJECTED round must not release the frozen expectation, and a lost update is
	 * what happens when it does.**
	 *
	 * The chain, and step 3 is the one it hinges on: a round saves, so the snapshot is released
	 * (correct — the field is clean and must follow the vault). The user then types an INVALID
	 * value, which mints a fresh snapshot. Blur: `useFieldCommit` rejects at `validate` and never
	 * dispatches — but `pending` still goes true then false, because `commitOnce` sets it before
	 * its `try` and the `finally` clears it on every non-continuing exit, the `validate` branch's
	 * early `return` included. So the release watcher fires with the ACCEPTANCE of the earlier,
	 * unrelated round still recorded, and clears the snapshot while the invalid draft is on
	 * screen. An external write then moves the row, the user corrects their value, `??=` re-freezes
	 * from the REFRESHED props, and the submit overwrites a price the user never saw instead of
	 * refusing with `asset-price.revision-conflict`.
	 *
	 * Asserted on the SUBMITTED EXPECTATION and on nothing else. The field's text, its error and
	 * the call count all read identically in both worlds; only the version the command is
	 * conditioned on tells a correct build from the lost update.
	 *
	 * Reported by a review bot on the pull request. Watched failing against the build that
	 * shipped: the third call carries version 2 — the refreshed pair — where version 1 is the one
	 * the draft began on.
	 */
	/**
	 * **The other arm, and it needed its own case: the snapshot is RELEASED when the field really
	 * does go clean.** Without it a row would hold the pair its last save established for the life
	 * of the leaf, so an external write between two edits would refuse the second one with
	 * `asset-price.revision-conflict` about a change the user could see on screen — and the only
	 * recovery would be Escape.
	 *
	 * Measured rather than assumed: with the release defeated (`snapshot.value = result.settled`
	 * unconditionally) every other case in this file still passes, so this is the one that pins
	 * it. That is this repository's own rule about a fix that guards one of several gestures —
	 * drop the other arms and run them.
	 */
	it('re-arms the expectation from the refreshed row after a save leaves the field clean', async () => {
		const { wrapper, commit } = mountSection({
			rows: [row({ override: money('19.50'), overrideRevision: 1 })],
			commit: () =>
				Promise.resolve({
					dispatch: ok('wrote' as const),
					settled: { id: 'op-1' as AssetPriceOverrideId, version: version(1) },
				}),
		});
		const input = wrapper.get('input');

		await input.setValue('20.00');
		await input.trigger('keydown', { key: 'Enter' });
		await flushPromises();

		// Somebody else moves the pair while this field is clean, so the row must follow it.
		await wrapper.setProps({ rows: [row({ override: money('30.00'), overrideRevision: 2 })] });

		await input.setValue('21.00');
		await input.trigger('keydown', { key: 'Enter' });
		await flushPromises();

		expect(commit).toHaveBeenCalledTimes(2);
		expect(commit.mock.calls[1]?.[0]).toEqual(
			expect.objectContaining({ expected: { id: 'op-1', version: version(2) } }),
		);
	});

	/**
	 * The same rule, on the path where the release is actually REACHABLE — the COALESCED one.
	 *
	 * The simple chain in the case below is inert, and the measurement is worth more than the
	 * case: on a round rejected at `validate`, `commitOnce` has no `await` before its early
	 * return, so `pending` goes true and false inside ONE synchronous stretch and a default
	 * `flush: 'pre'` watcher — comparing against the last value it observed, which is `false` —
	 * never fires at all. Measured by giving that watcher `flush: 'sync'`, which turns the case
	 * below red at its expectation assertion.
	 *
	 * A rejection that arrives as a coalesced CONTINUATION is different, and this is where the
	 * lost update lives: a first blur dispatches and holds, a second blur queues an invalid
	 * draft, and when the first settles `commitOnce` fires the queued round, which rejects. By
	 * then `pending` has been true across several ticks, so its fall is a real transition the
	 * watcher does see — with the FIRST round's acceptance still recorded. The snapshot is
	 * released under an invalid draft, an external write moves the row, and the corrected submit
	 * re-freezes from the refreshed props and overwrites a price the user never saw.
	 *
	 * Asserted on the SUBMITTED EXPECTATION alone: the field's text, its error and the call count
	 * read identically in both worlds.
	 */
	it('does not queue edits while a price is being saved', async () => {
		let release!: () => void;
		const held = new Promise<void>((resolve) => { release = resolve; });
		const { wrapper, commit } = mountSection({ commit: async () => { await held; return accepts(); } });
		await wrapper.get('input').setValue('20.00');
		await wrapper.get('.rp-asset-price-apply').trigger('click');
		await wrapper.get('input').setValue('21.00');
		release();
		await flushPromises();
		expect(commit).toHaveBeenCalledTimes(1);
	});

	it('keeps the expectation frozen across a round the field refused', async () => {
		const { wrapper, commit } = mountSection({
			rows: [row({ override: money('19.50'), overrideRevision: 1 })],
			// The accepted round settles on the pair the row already shows, so nothing about this
			// case rests on the settled value moving — only on the ACCEPTANCE being recorded.
			commit: () =>
				Promise.resolve({
					dispatch: ok('wrote' as const),
					settled: { id: 'op-1' as AssetPriceOverrideId, version: version(1) },
				}),
		});
		const input = wrapper.get('input');

		// 1. A round that succeeds, which records the acceptance and releases the snapshot.
		await input.setValue('20.00');
		await input.trigger('keydown', { key: 'Enter' });
		await flushPromises();

		// 2. An INVALID draft, which mints a fresh snapshot at the version on screen.
		await input.setValue('abc');
		// 3. Blur: refused at `validate`, nothing dispatched — and `pending` still falls.
		await input.trigger('keydown', { key: 'Enter' });
		await flushPromises();
		expect(commit).toHaveBeenCalledTimes(1);

		// 4. Somebody else moves the pair while the invalid draft is still on screen.
		await wrapper.setProps({ rows: [row({ override: money('30.00'), overrideRevision: 2 })] });

		// 5. The user corrects their value and submits it.
		await input.setValue('21.00');
		await input.trigger('keydown', { key: 'Enter' });
		await flushPromises();

		expect(commit).toHaveBeenCalledTimes(2);
		expect(commit.mock.calls[1]?.[0]).toEqual(
			expect.objectContaining({ expected: { id: 'op-1', version: version(1) } }),
		);
	});

	/**
	 * **The two capture fixes that live entirely in the stylesheet**, held as TEXT rather than by
	 * their classes merely existing — which is all the harvest case above can say. jsdom resolves
	 * no CSS, so a rule one word off draws wrong with every other case in this file green, and
	 * this repository has already shipped that defect once (`rp-save-state-error` against an
	 * emitted `rp-save-state-save-error`).
	 *
	 * Both were found by CAPTURING the page and looking at it, which is the only instrument here
	 * that can see a size or a position, and neither is measurable by any gate:
	 *
	 * - the LABEL took Obsidian's body type and sat above the input at full size, so every row
	 *   read as a titled block and the asset's own name read as a caption;
	 * - the field block's FIXED BASIS is what makes the inputs and buttons form a column. The
	 *   label used to carry the asset name visibly, so it sized its own column and three rows
	 *   started at x=923, x=887 and x=923 — slice 19's `.rp-project-list__overlap` defect (a
	 *   third item in a row moving the other two) on a third surface. The name moved into a
	 *   visually hidden span, which is why the hidden-text rule is asserted in the same case: it
	 *   is the half that keeps the accessible name distinguishing, and without it the fixed basis
	 *   would just be truncating a label.
	 */
	it('declares the type size and the fixed basis the capture asked for', () => {
		const css = readFileSync('styles/asset-prices.css', 'utf8');
		const field = css.slice(css.indexOf('.rp-asset-price-row .rp-field-error {'));
		const label = css.slice(css.indexOf('.rp-asset-price-row .rp-field-error label {'));
		// `.rp-visually-hidden` moved to its own partial at its second caller (this row was the
		// first); read from there rather than from `asset-prices.css`, which no longer holds it.
		const hiddenCss = readFileSync('styles/visually-hidden.css', 'utf8');
		const hidden = hiddenCss.slice(hiddenCss.indexOf('.rp-visually-hidden {'));

		// A basis rather than `flex-grow`: the name takes the slack, and every item after it has
		// to keep its own size or the columns move per row.
		expect(field.slice(0, field.indexOf('}'))).toMatch(/flex: 0 0 /);
		expect(label.slice(0, label.indexOf('}'))).toMatch(/font-size: var\(--font-ui-smaller\);/);
		// Clipped, never `display: none` or `visibility: hidden` — both take the text out of the
		// accessibility tree with the picture and would leave every row labelled `Set a price`.
		expect(hidden.slice(0, hidden.indexOf('}'))).toMatch(/clip-path: inset\(50%\);/);
		expect(hidden.slice(0, hidden.indexOf('}'))).not.toMatch(/display: none|visibility: hidden/);
	});

	/**
	 * The empty state is the LIST's, not the section's: the header and the disclosure stay drawn,
	 * because an empty state that replaces a region hides the thing the region exists to show.
	 */
	it('renders the empty state when the library is empty, keeping the heading and the disclosure', () => {
		const { wrapper } = mountSection({ rows: [] });

		expect(wrapper.get('.rp-asset-price-empty').text()).toBe(t('en', 'view.project.no-assets'));
		expect(wrapper.find('.rp-asset-price-list').exists()).toBe(false);
		expect(wrapper.get('.rp-asset-price-title').text()).toBe(t('en', 'view.project.prices-title'));
		expect(wrapper.find('.rp-asset-price-scope').exists()).toBe(true);
	});
});
