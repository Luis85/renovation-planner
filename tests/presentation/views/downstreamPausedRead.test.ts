// @vitest-environment jsdom
/**
 * **Owner ruling 74's principle, applied to the three display reads it did not name: a write pause
 * refuses writes, not reads.** `planEditorPausedRead.test.ts` carries the ruling for the planning
 * panel; the trade catalogue's `list`, the project work `read` and the quote `read` were the same
 * defect, each wrapped by `guardCommand` and so refused under ANY open incident:
 *
 * - the work section drew "Saved · refresh needed", a "Try again" and no rows;
 * - the quotes section drew a "Try again" and no offers;
 * - a trade-assigned Work item drew "Unresolved trade: … · Trade catalogue unavailable".
 *
 * Driven over the PRODUCTION composition (`projectWorkServices` and `quoteServices` over a real
 * root), because the defect was a wiring choice no fake reaches. "Writes nothing" is the vault's
 * bytes, not a spy on a door somebody listed.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { downstreamStack } from '../../helpers/downstream';
import { downstreamView } from '../../helpers/downstreamView';
import { expectDefined, expectOk } from '../../helpers/domain';
import { installObsidianDom } from '../../helpers/dom';
import { installOpenWriteIncident } from '../../helpers/writeIncidents';
import { of } from '../../../src/core/money/Money';
import type { Quote, QuoteId } from '../../../src/domain/quote/Quote';
import type { WorkPackage } from '../../../src/domain/renovation/Renovation';
import { installWriteIncidentRegistry } from '../../../src/application/incidents/WriteIncidentRegistry';
import { WRITES_PAUSED_CODE, writesPausedRefusal } from '../../../src/application/errors/guardAgainstThrowing';
import { provideTradeCatalogue } from '../../../src/presentation/catalogue/tradeCatalogue';
import { projectWorkServices } from '../../../src/plugin/projectWorkServices';
import { quoteServices } from '../../../src/plugin/quoteServices';
import TradeResponsibility from '../../../src/presentation/catalogue/TradeResponsibility.vue';
import { tr } from '../../../src/presentation/i18n/strings';
import { trError } from '../../../src/presentation/i18n/toUserMessage';

installObsidianDom();
afterEach(() => { installWriteIncidentRegistry(null); document.body.replaceChildren(); });

type Rig = Awaited<ReturnType<typeof downstreamStack>>;
const disabled = (root: { findAll(selector: string): { text(): string }[] }): string[] => root.findAll('[aria-disabled="true"]').map(item => item.text());

describe('the downstream sections during a write pause (owner ruling 74)', () => {
	it('the work section reads and draws its rows, with no refresh-needed badge and no retry, and stays blocked', async () => {
		const rig = await downstreamStack(), bytes = [...rig.stack.vault.entries];
		await installOpenWriteIncident();
		const view = await downstreamView(rig, 'schedule');
		try {
			const text = view.wrapper.text();
			// Anchored on what the pause DOES draw, so a broken render cannot pass the absences below.
			expect(text).toContain(tr('schedule.unrecovered'));
			expect(text).toContain('Sand floor');
			expect(text).not.toContain(tr('save-state.saved-refresh-needed'));
			expect(view.wrapper.find('.rp-project-downstream__retry').exists()).toBe(false);
			expect(disabled(view.wrapper)).toContain(tr('trade.add'));
			expect([...rig.stack.vault.entries]).toEqual(bytes);
		} finally { view.dispose(); }
	});

	it('the quotes section reads and draws, with no retry, says writing is paused and keeps its write controls blocked', async () => {
		const rig = await downstreamStack(), bytes = [...rig.stack.vault.entries];
		await installOpenWriteIncident();
		const view = await downstreamView(rig, 'quotes');
		try {
			const text = view.wrapper.text();
			expect(text).toContain(tr('quote.empty'));
			expect(text).toContain(trError(writesPausedRefusal()));
			expect(view.wrapper.find('.rp-project-downstream__retry').exists()).toBe(false);
			expect(disabled(view.wrapper)).toEqual(expect.arrayContaining([tr('supplier.add'), tr('quote.add')]));
			expect([...rig.stack.vault.entries]).toEqual(bytes);
		} finally { view.dispose(); }
	});

	it('the trade picker lists and names an assigned trade, not "catalogue unavailable"', async () => {
		const rig = await downstreamStack(), services = composed(rig);
		const trade = expectOk(await services.work.trades.create({ id: 'trade-paused', name: 'Tiler' }));
		const work: WorkPackage = { ...expectDefined(expectOk(await services.work.read(rig.plan.projectId)).rows[0], 'a work row').work, responsibility: 'trade', tradeId: trade.id };
		await installOpenWriteIncident();
		const host = mount(defineComponent({ setup() { provideTradeCatalogue(services.work.trades, rig.root.logger); return () => h(TradeResponsibility, { work }); } }), { attachTo: document.body });
		try {
			await flushPromises();
			expect(host.text()).toBe('Tiler');
		} finally { host.unmount(); rig.dispose(); }
	});

	/**
	 * The category: every member of the three bundles is a READ named below or a write door, and the
	 * reads must answer while every write door refuses with writes-paused and writes nothing. The
	 * member lists are asserted EXACTLY, so a new member forces a decision here rather than going
	 * undriven. `work.renovation` is excluded by name: its `read` stays behind the gate (it is only
	 * read as a write baseline) and `planEditorPausedRead.test.ts` drives that same bundle's writes.
	 */
	it('answers every read and refuses every write door with writes-paused, writing nothing', async () => {
		const rig = await downstreamStack(), services = composed(rig);
		const supplier = expectOk(await services.quotes.suppliers.create({ id: 'supplier-paused', name: 'Local supplier' }));
		const quote: Quote = { id: 'quote-paused' as QuoteId, projectId: rig.plan.projectId, supplierId: supplier.id, title: 'Floor offer', issuedOn: '2026-09-07', status: 'draft',
			items: [{ id: 'line-paused', description: 'Prepare floor', amount: of('594.005', 'EUR'), assetIds: [rig.asset.id], work: [{ planId: rig.plan.id, workId: 'work-sand' }] }] };
		await installOpenWriteIncident();
		const bytes = [...rig.stack.vault.entries];
		expect(Object.keys(services.work).toSorted()).toEqual(['onChanged', 'read', 'renovation', 'trades']);
		expect(Object.keys(services.quotes).toSorted()).toEqual(['onChanged', 'read', 'save', 'suppliers']);
		try {
			expectOk(await services.work.read(rig.plan.projectId));
			expectOk(await services.quotes.read(rig.plan.projectId));
			expectOk(await services.work.trades.list());
			expectOk(await services.quotes.suppliers.list());
			const writes: Record<string, () => Promise<unknown>> = {
				'work.trades.create': () => services.work.trades.create({ id: 'trade-refused', name: 'Plasterer' }),
				'quotes.suppliers.create': () => services.quotes.suppliers.create({ id: 'supplier-refused', name: 'Other supplier' }),
				'quotes.save': () => services.quotes.save({ quote, expected: 'absent' }),
			};
			for (const bundle of [services.work.trades, services.quotes.suppliers]) expect(Object.keys(bundle).toSorted()).toEqual(['create', 'list', 'onChanged']);
			const refused: Record<string, unknown> = {};
			for (const [door, run] of Object.entries(writes)) refused[door] = await run();
			const paused = { ok: false, error: { code: WRITES_PAUSED_CODE } };
			expect(refused).toMatchObject(Object.fromEntries(Object.keys(writes).map(door => [door, paused])));
			expect([...rig.stack.vault.entries]).toEqual(bytes);
		} finally { rig.dispose(); }
	});
});

function composed(rig: Rig) {
	return { work: expectDefined(projectWorkServices(rig.root, rig.stack.deps.vault, {} as never), 'work services'), quotes: expectDefined(quoteServices(rig.root), 'quote services') };
}

