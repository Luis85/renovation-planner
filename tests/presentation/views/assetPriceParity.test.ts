/**
 * @vitest-environment jsdom
 *
 * P04's own acceptance criteria for the project price section: the price actually in force, the
 * resting/editing split, the unsaved and saved markers, the pair a confirmed write establishes,
 * and the column strip.
 *
 * Beside `assetPriceList.test.ts` rather than inside it because that file reached the 450-line
 * budget; the fixtures both drive are shared through `./assetPriceFixtures`, never copied.
 * Driven through `AssetPriceList` for the same reason its sibling is: the row exists only inside
 * this list, and a case that mounted it alone would certify a component nothing composes.
 */
import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { ok } from '../../../src/core/result/Result';
import type { AssetPriceOverrideId } from '../../../src/domain/asset-price/AssetPriceOverrideId';
import { t } from '../../../src/presentation/i18n/strings';
import { money, mountSection, openEditor, row, version } from './assetPriceFixtures';

describe('the project price section against P04', () => {
	/**
	 * **P04's own Gherkin, and it is the acceptance criterion this section had no rendering
	 * for at all**: a 46.50 draft over a 49.90 catalogue price with no Apply still USES 49.90.
	 * The resolved candidate existed and drove only the foreign-currency and no-usable-price
	 * flags, so the one figure that answers "what does this project actually pay" was never
	 * drawn.
	 *
	 * Asserted with the draft ON SCREEN rather than before it is typed, because that is the only
	 * arrangement in which a component reading its draft and a component reading its props
	 * differ.
	 */
	it('uses the saved price while a draft stands unapplied', async () => {
		const { wrapper } = mountSection({
			rows: [row({ catalogue: money('49.90'), override: null })],
		});
		await (await openEditor(wrapper)).setValue('46,50');

		expect(wrapper.get('.rp-asset-price-used').text()).toContain(t('en', 'view.project.price-used'));
		expect(wrapper.get('.rp-asset-price-used').text()).toContain('49.90');
		expect(wrapper.get('.rp-asset-price-used').text()).not.toContain('46');
	});

	/**
	 * The override wins where there is one, and the row says so plainly rather than leaving the
	 * reader to work out which of two figures is in force. Missing is never rendered as zero —
	 * the second row asserts the sentence, not a `0.00`.
	 */
	it('uses the override over the catalogue price, and says so where neither is usable', () => {
		const { wrapper } = mountSection({
			rows: [
				row({ assetId: 'a1', override: money('19.50') }),
				row({ assetId: 'a2', catalogue: null, override: null }),
			],
		});
		const used = wrapper.findAll('.rp-asset-price-used');

		expect(used[0]?.text()).toContain('19.50 GBP');
		expect(used[1]?.text()).toContain(t('en', 'view.project.price-none-usable'));
		expect(used[1]?.text()).not.toContain('0');
	});

	/**
	 * **The draft's state was legible only from which BUTTONS happened to be on screen.**
	 * Apply/Cancel appearing is a fact about what the user may do next, not a statement that
	 * their number is unsaved — and after a confirmed write the row said nothing at all, so a
	 * successful save and a discarded one drew identically.
	 *
	 * The word and not only the dot: colour is not a channel every reader has, which is
	 * `states-and-navigation.md`'s own rule and the reason the dot is `aria-hidden`.
	 */
	it('marks a draft unsaved, then confirms it saved once the write lands', async () => {
		const { wrapper } = mountSection();
		const input = await openEditor(wrapper);

		expect(wrapper.find('.rp-asset-price-unsaved').exists()).toBe(false);
		await input.setValue('19.50');
		expect(wrapper.get('.rp-asset-price-unsaved').text()).toBe(t('en', 'view.project.price-unsaved'));
		expect(wrapper.find('.rp-asset-price-saved').exists()).toBe(false);

		await wrapper.get('.rp-asset-price-apply').trigger('click');
		await flushPromises();

		expect(wrapper.find('.rp-asset-price-unsaved').exists()).toBe(false);
		expect(wrapper.get('.rp-asset-price-saved').text()).toBe(t('en', 'view.project.price-saved'));
		// A confirmation is about the LAST write, so it goes the moment there is a new draft it
		// would otherwise be standing over.
		await (await openEditor(wrapper)).setValue('20.00');
		expect(wrapper.find('.rp-asset-price-saved').exists()).toBe(false);
	});

	/**
	 * **`settled` is the pair the command ESTABLISHED, and it was being read as a boolean.**
	 *
	 * The window this is about is between a confirmed write and the re-read landing: `props.row`
	 * still describes the PRE-write pair there, so a row that released its freeze and a user who
	 * edited again straight away submitted a version the vault had already moved past — their
	 * own save refusing their next edit with `asset-price.revision-conflict`. A failed refresh
	 * locks the row, which is the only thing that was hiding this.
	 *
	 * Watched failing against `snapshot.value = null`: the second call then carries the row's
	 * stale `{ op-1, revision 1 }`, which is this assertion inverted. Asserted on the submitted
	 * expectation and nothing else — every visible thing about the row reads identically either
	 * way.
	 */
	it('submits the pair the confirmed write established, before the re-read lands', async () => {
		const settled = { id: 'op-2' as AssetPriceOverrideId, version: version(9) };
		const { wrapper, commit } = mountSection({
			rows: [row({ override: money('19.50'), overrideRevision: 1 })],
			commit: () => Promise.resolve({ dispatch: ok('wrote' as const), settled }),
		});

		await (await openEditor(wrapper)).setValue('20.00');
		await wrapper.get('.rp-asset-price-apply').trigger('click');
		await flushPromises();

		// No `setProps`: this is the row as it stands while the section's own re-read is still
		// in flight, which is exactly when the props are behind the vault.
		await (await openEditor(wrapper)).setValue('21.00');
		await wrapper.get('.rp-asset-price-apply').trigger('click');
		await flushPromises();

		expect(commit).toHaveBeenCalledTimes(2);
		expect(commit.mock.calls[1]?.[0]).toEqual(expect.objectContaining({ expected: settled }));
	});

	/**
	 * **The dirty-navigation dialog says the draft was discarded, and on a refresh-blocked row it
	 * was not.** `draftReset` routed through `onPriceCancel`, which returns early while the row
	 * is paused — so the one gesture whose whole purpose is to make that sentence true was the
	 * one the pause swallowed. `pending` is blocked upstream by `canLeave`, which is why the
	 * reset bypasses `refreshBlocked` alone rather than every guard.
	 *
	 * Watched failing against the shared `onPriceCancel`: the input is still on screen holding
	 * `12.50` after the reset.
	 */
	it('discards the draft on a reset even while a refresh is blocked', async () => {
		const { wrapper } = mountSection();
		await (await openEditor(wrapper)).setValue('12.50');
		await wrapper.setProps({ refreshBlocked: true });

		await wrapper.setProps({ draftReset: 1 });

		expect(wrapper.findAll('input')).toHaveLength(0);
		await wrapper.setProps({ refreshBlocked: false });
		expect(((await openEditor(wrapper)).element as HTMLInputElement).value).toBe('');
	});

	/**
	 * **`aria-describedby` takes an ID LIST and the two producers here overwrote each other**:
	 * `:aria-describedby="readOnlyReason"` sat before `v-bind="aria"`, so the field error's id
	 * replaced the read-only reason for exactly as long as the error was showing.
	 *
	 * Driven through a prop transition rather than a mount, and the reason is worth stating: a
	 * read-only row cannot open an editor at all today (`beginEdit` refuses), so no user path
	 * reaches this pair — this case is what holds the join, and it holds it as the correct
	 * spelling of a binding whose two halves must not be able to displace one another.
	 *
	 * Watched failing against the original order: the attribute carries the error id alone.
	 */
	it('describes the field by its error and its read-only reason together', async () => {
		const { wrapper } = mountSection();
		const input = await openEditor(wrapper);
		await input.setValue('abc');
		await input.trigger('keydown', { key: 'Enter' });
		await flushPromises();
		await wrapper.setProps({ readOnly: true, readOnlyReasonId: 'why-read-only' });

		const described = wrapper.get('input').attributes('aria-describedby')?.split(' ') ?? [];
		expect(described).toContain('why-read-only');
		expect(described).toContain(wrapper.get('.rp-field-error__message').attributes('id'));
	});

	/**
	 * The mockup's column strip, drawn ONCE for the whole section and hidden from the
	 * accessibility tree: every row already carries its own label for each figure, so announcing
	 * these again per row is the duplication the labels exist to avoid. Presentational — no
	 * table role, no focus stop.
	 *
	 * FOUR cells and not five: the mockup's unit column is refused because `AssetPriceRowDto`
	 * has no unit field, which is P04's own instruction.
	 */
	it('heads the columns once, decoratively, with no unit column', () => {
		const { wrapper } = mountSection({ rows: [row({ assetId: 'a1' }), row({ assetId: 'a2' })] });
		const headings = wrapper.findAll('.rp-asset-price-headings');

		expect(headings).toHaveLength(1);
		expect(headings[0]?.attributes('aria-hidden')).toBe('true');
		expect(headings[0]?.element.children).toHaveLength(4);
		expect(headings[0]?.text()).toContain(t('en', 'view.project.price-used'));
		expect(wrapper.find('[role="table"]').exists()).toBe(false);
		expect(wrapper.find('.rp-asset-price-headings button').exists()).toBe(false);
	});

	it('draws no column strip over an empty library', () => {
		const { wrapper } = mountSection({ rows: [] });

		expect(wrapper.find('.rp-asset-price-headings').exists()).toBe(false);
	});

	/**
	 * The first heading cell was empty while no key named the column, which left the strip
	 * three labels over four tracks — the one arrangement in which a reader counts columns from
	 * the right and lands on the wrong figure. `view.project.column-asset` is the noun this
	 * plugin already spends on the entity (`Objekt` in German), not the mockup's `Material`.
	 */
	/**
	 * **A foreign candidate is not a price in force.** `resolveEffectiveUnitCost` refuses a
	 * currency that is not the project's and nothing here converts, so a catalogue figure in
	 * another currency answers "what does this project pay" with a number the project cannot
	 * pay — P04's "a catalogue price in another currency is not automatically usable in this
	 * project", met at the one cell that decides it.
	 *
	 * Found in a capture and by nothing else: the row drew `11.90 EUR` and `Different currency;
	 * not usable in this project` in the same cell, each correct on its own.
	 */
	it('refuses a foreign-currency candidate as the used price, and says why once', () => {
		const { wrapper } = mountSection({
			currency: 'GBP',
			rows: [row({ assetId: 'a1', catalogue: money('11.90', 'EUR') })],
		});

		expect(wrapper.get('.rp-asset-price-used').text()).not.toContain('11.90');
		expect(wrapper.get('.rp-asset-price-foreign').text()).toBe(t('en', 'view.project.price-foreign'));
		// One sentence, not two: the foreign one already names the absence it explains.
		expect(wrapper.find('.rp-asset-price-unusable').exists()).toBe(false);
	});

	it('names the asset column rather than leaving its heading blank', () => {
		const { wrapper } = mountSection({ rows: [row({ assetId: 'a1' })] });
		const cells = [...wrapper.get('.rp-asset-price-headings').element.children];

		expect(cells[0]?.textContent).toBe(t('en', 'view.project.column-asset'));
	});

	/**
	 * **An absent project price is STATED, never left as an empty cell** — P04's "missing price
	 * is not zero", read at the one place it is decided. Beside a catalogue figure in the column
	 * to its left, a blank third track reads as a price of nothing; the row says so instead.
	 *
	 * Asserted in BOTH directions, because the label's whole job is to be the resting state: a
	 * row that already has an override must not draw it, or the section would claim an absence
	 * over a value it is displaying two cells away.
	 */
	it('says a row has no project price rather than leaving the cell empty', () => {
		const without = mountSection({ rows: [row({ assetId: 'a1' })] }).wrapper;
		const with_ = mountSection({ rows: [row({ assetId: 'a2', override: money('41.50') })] }).wrapper;

		expect(without.get('.rp-asset-price-none').text()).toBe(t('en', 'view.project.price-none'));
		expect(with_.find('.rp-asset-price-none').exists()).toBe(false);
	});
});
