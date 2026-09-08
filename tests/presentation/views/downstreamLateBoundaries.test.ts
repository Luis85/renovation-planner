// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { downstreamStack } from '../../helpers/downstream';
import { downstreamView } from '../../helpers/downstreamView';
import { expectDefined, expectOk } from '../../helpers/domain';
import { installObsidianDom } from '../../helpers/dom';
import { defer } from '../../helpers/async';
import { createSupplier, type SupplierId } from '../../../src/domain/supplier/Supplier';
import { saveQuote } from '../../../src/application/commands/quote/QuoteServices';
import type { Quote, QuoteId } from '../../../src/domain/quote/Quote';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import { of } from '../../../src/core/money/Money';
import { tr } from '../../../src/presentation/i18n/strings';
import * as notices from '../../../src/presentation/notices/notify';

installObsidianDom();
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

it('retains an unresolved Supplier and raw Quote draft after an external note failure, then saves only on explicit recovery', async () => {
	const rig = await downstreamStack(), supplier = expectOk(createSupplier('supplier-late' as SupplierId, 'Local craft'));
	expectOk(await rig.persistence.suppliers.save(supplier, 'absent'));
	const quote: Quote = { id: 'quote-late' as QuoteId, projectId: rig.plan.projectId, supplierId: supplier.id, title: 'Floor offer', issuedOn: '2026-09-07', status: 'draft',
		items: [{ id: 'line', description: 'Floor preparation', amount: of('594.005', 'EUR'), assetIds: [], work: [{ planId: rig.plan.id, workId: 'work-sand' }] }] };
	const saved = expectOk(await saveQuote(rig.persistence, { quote, expected: 'absent' })), view = await downstreamView(rig, 'quotes');
	try {
		(view.button(tr('quote.edit')).element as HTMLButtonElement).click(); await flushPromises();
		const form = view.wrapper.get('.rp-quote-form'), amount = form.get<HTMLInputElement>('input[name="item-amount"]');
		await amount.setValue('812,345');
		const path = expectDefined(rig.persistence.index.getPath(supplier.id), 'Supplier note');
		const original = expectDefined(rig.stack.vault.entries.get(path), 'Supplier bytes'), damaged = original.replace(/^name:.*$/m, 'name: []');
		expect(damaged).not.toBe(original);
		// External note bytes pass through the actual cache/repositories, not a fabricated listing.
		rig.stack.vault.entries.set(path, damaged); rig.stack.metadataCache.catchUp();
		await rig.root.eventBus.publish({ type: 'ProjectIndexRebuilt' }); await flushPromises();
		const supplierField = form.get<HTMLSelectElement>('select[name="supplier"]');
		expect(supplierField.element.value).toBe(supplier.id);
		expect(supplierField.get(`option[value="${supplier.id}"]`).attributes('disabled')).toBeDefined();
		expect(supplierField.text()).toContain(tr('quote.unresolved', { id: supplier.id }));
		const bytes = [...rig.stack.vault.entries], writes = vi.spyOn(rig.persistence.quotes, 'save');
		form.get<HTMLButtonElement>('button[type="submit"]').element.click(); await flushPromises();
		form.get<HTMLButtonElement>('button[type="submit"]').element.click(); await flushPromises();
		expect(form.find('[role="alert"]').exists()).toBe(true); expect(form.text()).not.toContain(tr('quote.conflict'));
		expect(amount.element.value).toBe('812,345'); expect(writes).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
		rig.stack.vault.entries.set(path, original); rig.stack.metadataCache.catchUp();
		await rig.root.eventBus.publish({ type: 'ProjectIndexRebuilt' }); await flushPromises();
		expect(supplierField.get(`option[value="${supplier.id}"]`).attributes('disabled')).toBeUndefined();
		expect(amount.element.value).toBe('812,345'); expect(writes).not.toHaveBeenCalled();
		form.get<HTMLButtonElement>('button[type="submit"]').element.click(); await flushPromises();
		expect(writes).toHaveBeenCalledOnce();
		expect(expectDefined(expectOk(await rig.persistence.quotes.getById(saved.entity.id)), 'saved Quote').entity.items[0].amount.amount).toBe('812.345');
		expect(rig.stack.vault.entries.get(path)).toBe(original);
	} finally { view.dispose(); }
});

it('ignores repeated native Work Edit while the original baseline read is still pending', async () => {
	const rig = await downstreamStack(), view = await downstreamView(rig, 'schedule'), entered = defer<void>(), release = defer<void>();
	const original = view.work.renovation.read.bind(view.work.renovation);
	const read = vi.spyOn(view.work.renovation, 'read').mockImplementationOnce(async id => {
		const actual = await original(id); entered.resolve(); await release.promise; return actual;
	});
	try {
		const bytes = [...rig.stack.vault.entries], opener = view.button(tr('renovation.edit.work'));
		(opener.element as HTMLButtonElement).click(); await entered.promise; await flushPromises();
		expect(opener.attributes('aria-disabled')).toBe('true');
		(opener.element as HTMLButtonElement).click(); await flushPromises();
		expect(read).toHaveBeenCalledOnce(); expect(view.wrapper.find('.rp-dialog').exists()).toBe(false);
		release.resolve(); await flushPromises();
		expect(view.wrapper.findAll('[data-rp-form="renovation"]')).toHaveLength(1); expect(read).toHaveBeenCalledOnce();
		view.wrapper.get<HTMLButtonElement>('[data-rp-action="cancel"]').element.click(); await flushPromises();
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	} finally { release.resolve(); view.dispose(); }
});

it('retains an authorized Work Undo that lands before leaf disposal without late read-back, notices or focus changes', async () => {
	const rig = await downstreamStack(), view = await downstreamView(rig, 'schedule'), landed = defer<DispatchResult>(), release = defer<void>();
	const before = expectDefined(expectOk(await rig.persistence.plans.getById(rig.plan.id)), 'initial Plan').entity.renovation;
	const original = view.work.renovation.command.bind(view.work.renovation);
	vi.spyOn(view.work.renovation, 'command').mockImplementationOnce((...args) => {
		const command = original(...args);
		return { execute: () => command.execute(), undo: async () => { const actual = await command.undo(); landed.resolve(actual); await release.promise; return actual; } };
	});
	let disposed = false;
	try {
		(view.button(tr('renovation.edit.work')).element as HTMLButtonElement).click(); await flushPromises();
		const form = view.wrapper.get('[data-rp-form="renovation"]'); await form.get('input[name="schedule-start"]').setValue('2026-09-21');
		form.get<HTMLButtonElement>('button[type="submit"]').element.click(); await flushPromises();
		form.get<HTMLButtonElement>('button[type="submit"]').element.click(); await flushPromises();
		expect(expectDefined(expectOk(await rig.persistence.plans.getById(rig.plan.id)), 'edited Plan').entity.renovation?.work[0].schedule?.start).toBe('2026-09-21');
		const writes = vi.spyOn(rig.persistence.plans, 'save');
		(view.button(tr('editor.context.undo')).element as HTMLButtonElement).click(); expectOk(await landed.promise);
		expect(expectDefined(expectOk(await rig.persistence.plans.getById(rig.plan.id)), 'restored Plan').entity.renovation).toEqual(before);
		const bytes = [...rig.stack.vault.entries]; view.dispose(); disposed = true;
		const read = vi.spyOn(view.work, 'read'), notice = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
		const fault = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined);
		const outside = document.createElement('button'); outside.textContent = 'Other leaf'; document.body.append(outside); outside.focus();
		try {
			release.resolve(); await flushPromises();
			expect(writes).toHaveBeenCalledOnce(); expect(read).not.toHaveBeenCalled(); expect(notice).not.toHaveBeenCalled(); expect(fault).not.toHaveBeenCalled();
			expect(document.activeElement).toBe(outside); expect(view.context.session?.canLeave).toBeUndefined(); expect(document.querySelector('.rp-dialog')).toBeNull();
			expect([...rig.stack.vault.entries]).toEqual(bytes);
		} finally { outside.remove(); }
	} finally { release.resolve(); if (!disposed) view.dispose(); }
});
