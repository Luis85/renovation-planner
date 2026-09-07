// @vitest-environment jsdom
import type { Workspace } from 'obsidian';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downstreamStack } from '../helpers/downstream';
import { expectDefined, expectErr, expectOk } from '../helpers/domain';
import type { AppError } from '../../src/core/errors/AppError';
import type { Result } from '../../src/core/result/Result';
import { isTechnicalFault } from '../../src/core/errors/technical-fault';
import { of } from '../../src/core/money/Money';
import type { Quote, QuoteId } from '../../src/domain/quote/Quote';
import type { Trade } from '../../src/domain/trade/Trade';
import type { Supplier } from '../../src/domain/supplier/Supplier';
import type { NamedRecordListing } from '../../src/application/ports/NamedRecordRepository';
import { SessionWriteLedger } from '../../src/application/editor/WriteLedger';
import { createCompositionRoot } from '../../src/plugin/composition-root';
import { projectWorkServices } from '../../src/plugin/projectWorkServices';
import { quoteServices } from '../../src/plugin/quoteServices';

const mounted: Awaited<ReturnType<typeof downstreamStack>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.dispose(); vi.restoreAllMocks(); });
async function setup() {
	const rig = await downstreamStack(); mounted.push(rig);
	const work = expectDefined(projectWorkServices(rig.root, rig.stack.deps.vault, {} as Workspace), 'composed project Work');
	const quotes = expectDefined(quoteServices(rig.root), 'composed Quotes');
	const report = vi.spyOn(rig.root.logger, 'error');
	return { ...rig, work, quotes, report };
}
function mapped(rig: Awaited<ReturnType<typeof setup>>, result: Result<unknown, AppError>, event: string, cause: Error): void {
	const error = expectErr(result);
	expect(error).toMatchObject({ category: 'Persistence', code: 'vault.unexpected-failure', cause });
	expect(isTechnicalFault(error)).toBe(true);
	expect(rig.report).toHaveBeenCalledExactlyOnceWith(event, { cause });
}
async function quoteFixture(rig: Awaited<ReturnType<typeof setup>>): Promise<Quote> {
	const supplier = expectOk(await rig.quotes.suppliers.create({ id: 'supplier-guard', name: 'Local supplier' }));
	return { id: 'quote-guard' as QuoteId, projectId: rig.plan.projectId, supplierId: supplier.id,
		title: 'Floor offer', issuedOn: '2026-09-07', status: 'draft', items: [{ id: 'line-guard',
			description: 'Prepare floor', amount: of('594.005', 'EUR'), assetIds: [rig.asset.id],
			work: [{ planId: rig.plan.id, workId: 'work-sand' }] }] };
}

describe.each(['trade', 'supplier'] as const)('composed %s catalogue fault boundary', kind => {
	it('maps and logs a repository listing exception without changing vault contents', async () => {
		const rig = await setup(), cause = new Error('Catalogue listing unavailable');
		const repository = kind === 'trade' ? rig.persistence.trades : rig.persistence.suppliers;
		const services = kind === 'trade' ? rig.work.trades : rig.quotes.suppliers;
		const bytes = [...rig.stack.vault.entries];
		vi.spyOn(repository, 'listAll').mockRejectedValueOnce(cause);
		mapped(rig, await services.list(), kind + '.list-failed', cause);
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it.each(['read', 'write'] as const)('refuses a creation when the repository %s throws, preserving its retry identity', async boundary => {
		const rig = await setup(), cause = new Error('Catalogue creation unavailable');
		const repository = kind === 'trade' ? rig.persistence.trades : rig.persistence.suppliers;
		const services = kind === 'trade' ? rig.work.trades : rig.quotes.suppliers;
		const input = { id: kind + '-guard-create', name: 'Local catalogue entry' };
		const bytes = [...rig.stack.vault.entries], publish = vi.spyOn(rig.root.eventBus, 'publish');
		if (boundary === 'read') vi.spyOn(repository, 'getById').mockRejectedValueOnce(cause);
		else vi.spyOn(repository, 'save').mockRejectedValueOnce(cause);
		mapped(rig, await services.create(input), kind + '.create-failed', cause);
		expect(publish).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
		const saved = expectOk<Trade | Supplier>(await services.create(input));
		expect(saved).toMatchObject(input);
		expect(expectOk<NamedRecordListing<Trade | Supplier>>(await services.list()).loaded.filter(item => item.entity.id === input.id)).toHaveLength(1);
	});
});

describe('composed downstream read and save boundaries', () => {
	it.each(['quotes', 'assets'] as const)('maps a rejected %s read without publishing partial comparison data', async source => {
		const rig = await setup(), cause = new Error('Comparison source unavailable'), bytes = [...rig.stack.vault.entries];
		if (source === 'quotes') vi.spyOn(rig.persistence.quotes, 'listByProject').mockRejectedValueOnce(cause);
		else vi.spyOn(rig.persistence.assets, 'listAll').mockRejectedValueOnce(cause);
		mapped(rig, await rig.quotes.read(rig.plan.projectId), 'quote.read-failed', cause);
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it.each(['read', 'write'] as const)('maps a Quote save repository %s exception without a QuoteSaved event or partial write', async boundary => {
		const rig = await setup(), quote = await quoteFixture(rig), cause = new Error('Quote save unavailable');
		const bytes = [...rig.stack.vault.entries], publish = vi.spyOn(rig.root.eventBus, 'publish');
		if (boundary === 'read') vi.spyOn(rig.persistence.quotes, 'getById').mockRejectedValueOnce(cause);
		else vi.spyOn(rig.persistence.quotes, 'save').mockRejectedValueOnce(cause);
		mapped(rig, await rig.quotes.save({ quote, expected: 'absent' }), 'quote.save-failed', cause);
		expect(publish).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
		const saved = expectOk(await rig.quotes.save({ quote, expected: 'absent' }));
		expect(saved.entity).toEqual(quote); expect(publish).toHaveBeenCalledOnce();
		expect(publish).toHaveBeenCalledWith({ type: 'QuoteSaved', payload: { projectId: quote.projectId, id: quote.id } });
	});
	it('maps a ProjectWork listing exception instead of returning a partial floor list', async () => {
		const rig = await setup(), cause = new Error('Work plans unavailable'), bytes = [...rig.stack.vault.entries];
		vi.spyOn(rig.persistence.plans, 'listByProject').mockRejectedValueOnce(cause);
		mapped(rig, await rig.work.read(rig.plan.projectId), 'project.work-read-failed', cause);
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it('maps an edit baseline repository exception through the composed Work renovation read', async () => {
		const rig = await setup(), cause = new Error('Work baseline unavailable'), bytes = [...rig.stack.vault.entries];
		vi.spyOn(rig.persistence.plans, 'getById').mockRejectedValueOnce(cause);
		mapped(rig, await rig.work.renovation.read(rig.plan.id), 'renovation.read.failed', cause);
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it.each(['execute', 'undo'] as const)('retains the real Work transaction when its %s Plan write throws', async direction => {
		const rig = await setup(), baseline = expectOk(await rig.work.renovation.read(rig.plan.id));
		const value = expectDefined(baseline.plan.entity.renovation, 'Work register');
		const input = { renovation: { ...value, work: value.work.map(item => ({ ...item, title: 'Revised ' + item.title })) }, intended: baseline.geometry.document.intended };
		const command = rig.work.renovation.command(baseline, input, new SessionWriteLedger());
		if (direction === 'undo') expectOk(await command.execute());
		const bytes = [...rig.stack.vault.entries], cause = new Error('Work Plan write unavailable');
		const publish = vi.spyOn(rig.root.eventBus, 'publish');
		vi.spyOn(rig.persistence.plans, 'save').mockRejectedValueOnce(cause);
		// RenovationCommand handles transaction exceptions internally, before the outer guard.
		expect(expectErr(await command[direction]())).toMatchObject({ category: 'Persistence', code: 'renovation.write-failed', cause });
		expect(publish).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it('leaves downstream services unavailable when settings recovery prevents persistence composition', async () => {
		const rig = await setup(), bytes = [...rig.stack.vault.entries];
		const root = createCompositionRoot(null, rig.root.logger, rig.stack.deps);
		expect(root.persistence).toBeNull();
		expect(projectWorkServices(root, rig.stack.deps.vault, {} as Workspace)).toBeUndefined();
		expect(quoteServices(root)).toBeUndefined(); expect(rig.report).not.toHaveBeenCalled();
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
});
