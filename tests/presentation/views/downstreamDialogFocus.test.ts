// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { downstreamStack } from '../../helpers/downstream';
import { downstreamView } from '../../helpers/downstreamView';
import { expectDefined, expectOk } from '../../helpers/domain';
import { installObsidianDom } from '../../helpers/dom';
import { SessionWriteLedger } from '../../../src/application/editor/WriteLedger';
import { of } from '../../../src/core/money/Money';
import type { Quote, QuoteId } from '../../../src/domain/quote/Quote';
import { createSupplier, type SupplierId } from '../../../src/domain/supplier/Supplier';
import { tr } from '../../../src/presentation/i18n/strings';

installObsidianDom();
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
async function quotes() {
	const rig = await downstreamStack();
	const supplier = expectOk(await rig.persistence.suppliers.save(expectOk(createSupplier('focus-supplier' as SupplierId, 'Local craft')), 'absent'));
	const quote: Quote = { id: 'focus-quote' as QuoteId, projectId: rig.plan.projectId, supplierId: supplier.entity.id,
		title: 'Floor offer', issuedOn: '2026-09-07', status: 'draft', items: [{ id: 'focus-line', description: 'Floor preparation',
			amount: of('594.005', 'EUR'), assetIds: [], work: [{ planId: rig.plan.id, workId: 'work-sand' }] }] };
	expectOk(await rig.persistence.quotes.save(quote, 'absent'));
	return { rig, quote, view: await downstreamView(rig, 'quotes') };
}
async function open(view: Awaited<ReturnType<typeof downstreamView>>, label: string) {
	const opener = view.button(label).element as HTMLButtonElement;
	opener.focus(); opener.click(); await flushPromises(); return opener;
}
function expectReturn(view: Awaited<ReturnType<typeof downstreamView>>): void {
	const back = view.wrapper.get<HTMLButtonElement>('.rp-project-detail__back').element;
	expect(back.isConnected).toBe(true); expect(document.activeElement).toBe(back);
}

describe('downstream dialog focus after its source control disappears', () => {
	it('returns to the Project control after an edited draft becomes received and removes its Edit button', async () => {
		const { rig, quote, view } = await quotes();
		try {
			const opener = await open(view, tr('quote.edit')), form = view.wrapper.get('.rp-quote-form');
			await form.get('select[name="quote-status"]').setValue('received');
			const writes = vi.spyOn(rig.persistence.quotes, 'save');
			await form.trigger('submit'); await flushPromises(); expect(writes).not.toHaveBeenCalled();
			await form.trigger('submit'); await flushPromises();
			expect(writes).toHaveBeenCalledOnce(); expect(expectOk(await rig.persistence.quotes.getById(quote.id))?.entity.status).toBe('received');
			expect(opener.isConnected).toBe(false); expect(view.wrapper.find('.rp-dialog').exists()).toBe(false); expectReturn(view);
		} finally { view.dispose(); }
	});
	it.each(['quote.edit', 'quote.revise'] as const)('returns safely after the peer deletes the offer while %s is open, then native Cancel writes nothing', async action => {
		const { rig, quote, view } = await quotes();
		try {
			const opener = await open(view, tr(action)), form = view.wrapper.get('.rp-quote-form');
			await form.get('input[name="title"]').setValue('Retained offer draft');
			// External note deletion is observed through the existing index invalidation source.
			rig.stack.vault.entries.delete(expectDefined(rig.persistence.index.getPath(quote.id), 'Quote source path'));
			await rig.root.eventBus.publish({ type: 'ProjectIndexRebuilt' }); await flushPromises();
			expect(opener.isConnected).toBe(false); expect(view.wrapper.find('.rp-dialog').exists()).toBe(true);
			expect(form.get<HTMLInputElement>('input[name="title"]').element.value).toBe('Retained offer draft');
			const bytes = [...rig.stack.vault.entries], writes = vi.spyOn(rig.persistence.quotes, 'save');
			view.wrapper.get<HTMLButtonElement>('[data-rp-action="cancel"]').element.click(); await flushPromises();
			expect(view.wrapper.find('.rp-dialog').exists()).toBe(false); expectReturn(view);
			expect(writes).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
		} finally { view.dispose(); }
	});
	it('returns safely after an independent Work removal refreshes the row while its edit draft remains open', async () => {
		const rig = await downstreamStack(), view = await downstreamView(rig, 'schedule');
		try {
			const opener = await open(view, tr('renovation.edit.work')), form = view.wrapper.get('[data-rp-form="renovation"]');
			await form.get('input[name="schedule-start"]').setValue('2026-09-12');
			const baseline = expectOk(await view.work.renovation.read(rig.plan.id));
			const renovation = expectDefined(baseline.plan.entity.renovation, 'Work register');
			expectOk(await view.work.renovation.command(baseline, { renovation: { ...renovation, work: [] }, intended: baseline.geometry.document.intended }, new SessionWriteLedger()).execute());
			await flushPromises(); expect(opener.isConnected).toBe(false); expect(view.wrapper.find('.rp-dialog').exists()).toBe(true);
			expect(form.get<HTMLInputElement>('input[name="schedule-start"]').element.value).toBe('2026-09-12');
			const bytes = [...rig.stack.vault.entries], writes = vi.spyOn(rig.persistence.plans, 'save');
			view.wrapper.get<HTMLButtonElement>('[data-rp-action="cancel"]').element.click(); await flushPromises();
			expect(view.wrapper.find('.rp-dialog').exists()).toBe(false); expectReturn(view);
			expect(writes).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
		} finally { view.dispose(); }
	});
});
