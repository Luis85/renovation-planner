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
import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { err, ok } from '../../../src/core/result/Result';
import type { ValidationError } from '../../../src/core/errors/AppError';
import type { AssetPriceOverrideId } from '../../../src/domain/asset-price/AssetPriceOverrideId';
import { t } from '../../../src/presentation/i18n/strings';
import { trError } from '../../../src/presentation/i18n/toUserMessage';
import { activateNotices, disposeNotices } from '../../../src/presentation/notices/notify';
import { installObsidianDom } from '../../helpers/dom';
import { Notice } from '../../helpers/obsidian-mock';
import { accepts, money, mountSection, openEditor, row, version } from './assetPriceFixtures';

describe('AssetPriceList', () => {
	it('renders one row per asset, with the library price and an empty field where there is no override', async () => {
		const { wrapper } = mountSection({
			rows: [row({ assetId: 'a1', assetName: 'Oak flooring' }), row({ assetId: 'a2', assetName: 'Paint' })],
		});

		expect(wrapper.findAll('.rp-asset-price-row')).toHaveLength(2);
		expect(wrapper.get('.rp-asset-price-catalogue').text()).toContain('24.00');
		expect(wrapper.get('.rp-asset-price-catalogue').text()).toContain(t('en', 'view.project.price-catalogue'));
		// Both rows REST: P04 draws one open editor, so the section is two read-only readings and
		// two invitations rather than two live controls nobody asked to open.
		expect(wrapper.findAll('input')).toHaveLength(0);
		expect(wrapper.findAll('.rp-asset-price-edit')).toHaveLength(2);
		expect(wrapper.get('.rp-asset-price-edit').text()).toBe(t('en', 'view.project.price-set'));

		expect(((await openEditor(wrapper)).element as HTMLInputElement).value).toBe('');
		expect(wrapper.findAll('input')).toHaveLength(1);
	});

	it('renders the project’s own price in the field where there is one', async () => {
		const { wrapper } = mountSection({ rows: [row({ override: money('19.50') })] });
		await openEditor(wrapper);

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
	it('names the project’s currency on the field’s own label', async () => {
		const { wrapper } = mountSection({ rows: [row({ catalogue: money('24.00', 'EUR') })], currency: 'GBP' });
		await openEditor(wrapper);

		expect(wrapper.get('label').text()).toContain('GBP');
		expect(wrapper.get('label').text()).toContain(t('en', 'view.project.price-set'));
		// The asset name stays IN the accessible name, visually hidden: `Set a price (GBP)` on
		// every row is a set of identical labels, and a screen-reader user moving between them by
		// form control would hear the same words each time.
		expect(wrapper.get('label').text()).toContain('Oak flooring');
		expect(wrapper.find('label .rp-visually-hidden').exists()).toBe(true);
	});

	it.each([['0', '0'], ['12,50', '12.50'], ['12.5', '12.5'], ['1,23', '1.23']])('applies the decimal input %s without grouping or floating-point conversion', async (draft, amount) => {
		const { wrapper, commit } = mountSection();
		const input = await openEditor(wrapper);
		await input.setValue(draft);
		await wrapper.get('.rp-asset-price-apply').trigger('click'); await flushPromises();
		expect(commit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ kind: 'set', unitCost: expect.objectContaining({ amount, currency: 'GBP' }) }));
		expect(wrapper.find('.rp-asset-price-apply').exists()).toBe(false);
	});

	it('dispatches a set for a typed price on explicit Apply', async () => {
		const { wrapper, commit } = mountSection();
		await openEditor(wrapper);

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
		await openEditor(wrapper);

		await wrapper.get('input').setValue('21.00');
		await wrapper.get('input').trigger('keydown', { key: 'Enter' });
		await flushPromises();

		expect(commit).toHaveBeenCalledWith(
			expect.objectContaining({ expected: { id: 'op-1', version: version(3) } }),
		);
	});

	it('passes an absent expectation from a row with no override', async () => {
		const { wrapper, commit } = mountSection();
		await openEditor(wrapper);

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
	 * `overrideId`/`overrideVersion`, the user's Enter then builds `expected` from the REFRESHED
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
		await openEditor(wrapper);

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
		await openEditor(wrapper);

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
		await openEditor(wrapper);
		expect(wrapper.find('.rp-asset-price-clear').exists()).toBe(false);
		await wrapper.get('input').setValue('12,50');
		await wrapper.get('input').trigger('blur');
		expect(commit).not.toHaveBeenCalled();
		await wrapper.get('.rp-asset-price-cancel').trigger('click');
		// Cancel discards the draft AND closes the editor, so the row is back to the invitation
		// it started as — asserted on the absent input, because a retained draft behind a closed
		// editor would re-appear on the next Edit and read as the user's own value.
		expect(wrapper.findAll('input')).toHaveLength(0);
		expect(wrapper.get('.rp-asset-price-edit').text()).toBe(t('en', 'view.project.price-set'));
		expect(commit).not.toHaveBeenCalled();
		expect(((await openEditor(wrapper)).element as HTMLInputElement).value).toBe('');
	});

	/**
	 * `pricePaused` (`price.pending.value || refreshBlocked`) is what locks the row while
	 * Apply's write is in flight — `readonly` and `aria-disabled` on the input, `aria-disabled`
	 * on Clear/Cancel, never `:disabled` (ruling R2), so focus stays on the field through the
	 * commit rather than being dropped to `body`.
	 *
	 * Escape while paused is not undo: `onPriceCancel` returns early on `price.pending.value`,
	 * so the queued write still lands once the vault answers. There is no `draftToken` and no
	 * blur commit on this path — Apply's click is what dispatched, and the single `commit` call
	 * this case asserts carries the value that was actually applied.
	 */
	it('locks the row while Apply is writing; cancel is never undo', async () => {
		let release!: () => void;
		const held = new Promise<void>((resolve) => { release = resolve; });
		const { wrapper, commit } = mountSection({ rows: [row({ override: money('19.50') })], commit: async () => { await held; return accepts(); } });
		await openEditor(wrapper);
		await wrapper.get('input').setValue('12,50');
		await wrapper.get('.rp-asset-price-apply').trigger('click');
		expect(wrapper.get('input').attributes('readonly')).toBeDefined();
		expect(wrapper.get('input').attributes('aria-disabled')).toBe('true');
		expect(wrapper.get('.rp-asset-price-cancel').attributes('aria-disabled')).toBe('true');
		expect(wrapper.get('.rp-asset-price-clear').attributes('aria-disabled')).toBe('true');
		// `aria-disabled` ALONE left all three focusable and clickable over handlers that
		// silently returned — the live-control-that-does-nothing shape, on the one surface whose
		// whole promise is that a dispatched write cannot be taken back. The BUTTONS are really
		// `disabled`; the INPUT deliberately is not, which the case below this one is about.
		expect(wrapper.get('.rp-asset-price-apply').attributes('disabled')).toBeDefined();
		expect(wrapper.get('.rp-asset-price-cancel').attributes('disabled')).toBeDefined();
		expect(wrapper.get('.rp-asset-price-clear').attributes('disabled')).toBeDefined();
		await wrapper.get('input').trigger('keydown.esc');
		expect(commit).toHaveBeenCalledTimes(1);
		release();
		await flushPromises();
		expect(commit).toHaveBeenCalledTimes(1);
		expect(commit.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ unitCost: money('12.50') }));
	});

	/**
	 * V1: `5b4031ae` added `price.pending` to the input's `:disabled` and deleted its blur
	 * commit. Disabling the focused control moves focus with nothing to restore it — Chromium
	 * blurs it to `body` — so a user who presses Enter loses their place mid-commit. Ruling R2:
	 * a paused control is `readonly` + `aria-disabled`, never `:disabled`, so it stays focusable
	 * (`RequirementRow.vue`'s house shape).
	 */
	it('keeps focus on the price input while a commit is pending, instead of disabling it', async () => {
		const host = document.createElement('div');
		document.body.append(host);
		let release!: () => void;
		const held = new Promise<void>((resolve) => { release = resolve; });
		const { wrapper } = mountSection({ commit: async () => { await held; return accepts(); }, attachTo: host });
		await openEditor(wrapper);
		const input = wrapper.get('input').element as HTMLInputElement;

		input.focus();
		await wrapper.get('input').setValue('12.50');
		await wrapper.get('input').trigger('keydown', { key: 'Enter' });
		await flushPromises();

		expect(document.activeElement).toBe(input);
		expect(input.getAttribute('aria-disabled')).toBe('true');
		expect(input.hasAttribute('readonly')).toBe(true);

		release();
		await flushPromises();
		wrapper.unmount();
		host.remove();
	});

	/**
	 * `pricePaused` is `price.pending.value || refreshBlocked`, and this is the OTHER half of
	 * that `||`: a refresh in flight pauses the row with no commit of its own pending. Asserted
	 * beside `aria-busy`, which must stay `false` here — it names an in-flight WRITE, not a
	 * paused field, and a row blocked only by a refresh has made neither.
	 */
	it('pauses the price input while a refresh is blocked, with no commit in flight', async () => {
		const { wrapper } = mountSection();
		const field = await openEditor(wrapper);
		await wrapper.setProps({ refreshBlocked: true });
		const input = field.element as HTMLInputElement;

		expect(input.getAttribute('aria-disabled')).toBe('true');
		expect(input.hasAttribute('readonly')).toBe(true);
		expect(input.getAttribute('aria-busy')).toBe('false');
	});

	/**
	 * The same pause met from the RESTING side, which is where a blocked row is found in
	 * practice: the price read failed, so nothing here may be edited at all. The invitation is
	 * genuinely `disabled` rather than merely styled, because a control that opens an editor
	 * whose every action then refuses is the live-control-that-does-nothing shape.
	 */
	it('refuses to open an editor at all while a refresh is blocked', async () => {
		const { wrapper } = mountSection({ refreshBlocked: true });

		expect(wrapper.get('.rp-asset-price-edit').attributes('disabled')).toBeDefined();
		await wrapper.get('.rp-asset-price-edit').trigger('click');
		expect(wrapper.findAll('input')).toHaveLength(0);
	});

	/**
	 * `refreshBlocked` freezes the row PAST its keystrokes: before this guard, Apply's
	 * `:disabled="priceDisabled"` had been replaced with `aria-disabled` alone (colour only —
	 * `styles/editor-shell.css:267`), so nothing stopped Enter, Apply's click or Cancel's click
	 * from reaching `price.onCommit()`/`price.onCancel()` while a concurrent price change had the
	 * row visually paused. `refreshBlocked` flips true AFTER the draft exists — `onPriceInput`
	 * itself refuses to record a draft while blocked, so a row mounted already-blocked could never
	 * reach a dirty state to test Apply/Cancel/Enter against. All three gestures are asserted in
	 * one continuous case — none of them succeeds, so the draft and the mock's call count both
	 * carry forward unchanged from one to the next, which is itself part of what is being checked.
	 */
	it('ignores Enter, Apply and Cancel on a dirty draft while a refresh is blocked', async () => {
		const { wrapper, commit } = mountSection();
		await (await openEditor(wrapper)).setValue('12.50');
		await wrapper.setProps({ refreshBlocked: true });

		await wrapper.get('input').trigger('keydown', { key: 'Enter' });
		expect(commit).not.toHaveBeenCalled();

		await wrapper.get('.rp-asset-price-apply').trigger('click');
		expect(commit).not.toHaveBeenCalled();

		await wrapper.get('.rp-asset-price-cancel').trigger('click');
		expect(commit).not.toHaveBeenCalled();
		expect((wrapper.get('input').element as HTMLInputElement).value).toBe('12.50');
	});

	/**
	 * `@mousedown.prevent` on Clear exists to stop a stray commit from firing before the click
	 * reaches `onClear` — real when the input committed on blur, which it no longer does: there
	 * is no `draftToken` and no blur handler left on this input at all.
	 *
	 * With nothing left for the guard to prevent, `if (!mousedown.defaultPrevented)` is what
	 * keeps this a real mutation check rather than a vacuous one: remove `.prevent` and the
	 * branch fires an Enter commit in its place, turning the single `commit` call below into two
	 * and failing the assertion. The sequence is driven as a real cancelable `mousedown` followed
	 * by `click` rather than `click()` alone, which jsdom does not expand into a `mousedown` at
	 * all — a version that only clicks would pass against a button with no guard whatsoever.
	 */
	it('dispatches only the clear when the button is clicked on a dirty field', async () => {
		const { wrapper, commit } = mountSection({ rows: [row({ override: money('19.50') })] });
		await openEditor(wrapper);
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
		await openEditor(wrapper);

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
		await openEditor(wrapper);

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
		// The editor never OPENS on this row, which is where the old disabled input's guarantee
		// moved: a set on a missing asset refuses every time, so the invitation is what has to
		// refuse rather than a control the user has already been let into.
		expect(wrapper.get('.rp-asset-price-edit').attributes('disabled')).toBeDefined();
		expect(wrapper.findAll('input')).toHaveLength(0);
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
	it('renders an unreadable override with its id, no library price, and no way into the editor', () => {
		const { wrapper } = mountSection({
			rows: [row({ assetName: null, catalogue: null, override: money('19.50'), assetStatus: 'unreadable' })],
		});

		expect(wrapper.get('.rp-asset-price-name').text()).toBe('a1');
		expect(wrapper.find('.rp-asset-price-catalogue').exists()).toBe(false);
		expect(wrapper.get('.rp-asset-price-unreadable').text()).toBe(t('en', 'view.project.price-unreadable'));
		expect(wrapper.find('.rp-asset-price-orphan').exists()).toBe(false);
		expect(wrapper.get('.rp-asset-price-edit').attributes('disabled')).toBeDefined();
		expect(wrapper.findAll('input')).toHaveLength(0);
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
		await openEditor(wrapper);

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
		await openEditor(wrapper);

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
	it.each(['abc', '.5', '+1', '1e3', '1,234.50', '01', '', '-0', '1,234', '1.234', '1,2345'])('refuses %s at the field, dispatching nothing', async (draft) => {
		const { wrapper, commit } = mountSection();
		await openEditor(wrapper);

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
		await openEditor(wrapper);

		const input = wrapper.get('input');
		await input.setValue('21.00');
		await wrapper.setProps({ rows: [row({ override: money('30.00'), overrideRevision: 2 })] });
		await input.trigger('keydown.esc');
		// Escape closes the editor with the draft, so the second edit is a fresh one — which is
		// the point: it freezes from the row the user is now looking at.
		const reopened = await openEditor(wrapper);
		await reopened.setValue('31.00');
		await reopened.trigger('keydown', { key: 'Enter' });
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
	it('declares a rule for every class it actually emits', async () => {
		// Both partials: `rp-visually-hidden` moved to its own partial (`visually-hidden.css`)
		// at its second caller, and this harvest must keep seeing a real declaration for it
		// rather than coincidentally matching prose in a comment.
		// THREE partials: P04's own layout, the resting/editing states and the markers live in
		// `project-prices.css`, which is imported straight after the shared row's partial.
		const css = readFileSync('styles/asset-prices.css', 'utf8')
			+ readFileSync('styles/project-prices.css', 'utf8')
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
		// The EDITING row draws a whole second set of classes — the field, the currency, the
		// actions and the unsaved marker — and none of them appears in a resting mount, so a
		// harvest that never opened an editor would certify half the section.
		{
			const { wrapper } = mountSection({ rows: [row({ override: money('19.50') })] });
			await (await openEditor(wrapper)).setValue('20.00');
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
		await openEditor(wrapper);
		const input = wrapper.get('input');

		await input.setValue('20.00');
		await input.trigger('keydown', { key: 'Enter' });
		await flushPromises();

		// Somebody else moves the pair while this field is clean, so the row must follow it.
		await wrapper.setProps({ rows: [row({ override: money('30.00'), overrideRevision: 2 })] });

		const reopened = await openEditor(wrapper);
		await reopened.setValue('21.00');
		await reopened.trigger('keydown', { key: 'Enter' });
		await flushPromises();

		expect(commit).toHaveBeenCalledTimes(2);
		expect(commit.mock.calls[1]?.[0]).toEqual(
			expect.objectContaining({ expected: { id: 'op-1', version: version(2) } }),
		);
	});

	/**
	 * There is no coalescing to lose an edit to here, and that is the whole of the answer:
	 * `onPriceInput` returns early on `price.pending.value` (`AssetPriceRow.vue:99`), so the
	 * second `setValue` below never reaches `useFieldCommit` at all — no draft is recorded and no
	 * round is queued. `useFieldCommit`'s own coalescing, the mechanism `RequirementRow`'s fields
	 * rely on, never engages here. One `commit` call is the whole of what this case can see,
	 * because it is the whole of what happens: the field ignores every keystroke between Apply's
	 * click and the write settling.
	 */
	it('does not queue edits while a price is being saved', async () => {
		let release!: () => void;
		const held = new Promise<void>((resolve) => { release = resolve; });
		const { wrapper, commit } = mountSection({ commit: async () => { await held; return accepts(); } });
		await openEditor(wrapper);
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
		await openEditor(wrapper);
		const input = wrapper.get('input');

		// 1. A round that succeeds, which closes the editor and settles on its own pair.
		await input.setValue('20.00');
		await input.trigger('keydown', { key: 'Enter' });
		await flushPromises();

		// 2. An INVALID draft, which mints a fresh snapshot at the version on screen.
		const reopened = await openEditor(wrapper);
		await reopened.setValue('abc');
		// 3. Blur: refused at `validate`, nothing dispatched — and `pending` still falls.
		await reopened.trigger('keydown', { key: 'Enter' });
		await flushPromises();
		expect(commit).toHaveBeenCalledTimes(1);

		// 4. Somebody else moves the pair while the invalid draft is still on screen.
		await wrapper.setProps({ rows: [row({ override: money('30.00'), overrideRevision: 2 })] });

		// 5. The user corrects their value and submits it.
		await reopened.setValue('21.00');
		await reopened.trigger('keydown', { key: 'Enter' });
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
	it('declares the type size and the shared columns the capture asked for', () => {
		const css = readFileSync('styles/asset-prices.css', 'utf8');
		const layout = readFileSync('styles/project-prices.css', 'utf8');
		const columns = layout.slice(layout.indexOf('.rp-asset-price-headings,'));
		const label = css.slice(css.indexOf('.rp-asset-price-row .rp-field-error label {'));
		// `.rp-visually-hidden` moved to its own partial at its second caller (this row was the
		// first); read from there rather than from `asset-prices.css`, which no longer holds it.
		const hiddenCss = readFileSync('styles/visually-hidden.css', 'utf8');
		const hidden = hiddenCss.slice(hiddenCss.indexOf('.rp-visually-hidden {'));

		// Shared GRID TRACKS rather than a basis on the editor: the heading strip and every row —
		// resting rows included, which a basis on the editor could never reach — are laid out by
		// one declaration, so no row's own content can move another row's columns. `minmax(0, …)`
		// is the half that keeps a long name inside its track instead of widening the grid.
		expect(columns.slice(0, columns.indexOf('}'))).toMatch(/grid-template-columns: minmax\(0, /);
		// The fixed basis it replaced is GONE rather than merely overridden: left standing it is
		// what stops the editor filling the line at narrow.
		expect(css).not.toMatch(/flex: 0 0 /);
		// **Apply's fill is ROW-SCOPED, and a bare class cannot carry it.** Obsidian's own
		// app.css declares `button:not(.clickable-icon) { background-color: … }` — a functional
		// pseudo-class taking its argument's specificity, so (0,1,1) — which outranks
		// `.rp-asset-price-apply` and left the primary action drawing exactly like Cancel.
		// Measured in a browser off the computed colour, because jsdom resolves no CSS and no
		// gate here can see a colour; this is the assertion that keeps the selector from being
		// flattened back.
		expect(layout).toMatch(/\.rp-asset-price-row \.rp-asset-price-apply \{/);
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
