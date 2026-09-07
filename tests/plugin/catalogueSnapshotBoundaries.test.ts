// @vitest-environment jsdom
// Real repository snapshots across peer edits and index reconciliation.
import { afterEach, expect, it, vi } from 'vitest';
import { downstreamStack } from '../helpers/downstream';
import { expectDefined, expectErr, expectOk } from '../helpers/domain';
import { makeAsset } from '../helpers/entities';
import { parseFrontmatter } from '../helpers/vault';
import { createEntityId } from '../../src/core/identity/generateId';
import { of } from '../../src/core/money/Money';
import { createSupplier } from '../../src/domain/supplier/Supplier';
import { createTrade } from '../../src/domain/trade/Trade';
import type { Quote } from '../../src/domain/quote/Quote';
import { saveQuote } from '../../src/application/commands/quote/QuoteServices';
import { fileAt } from '../../src/infrastructure/obsidian/repositories/NoteVaultDeps';
import { versionOfFrontmatter } from '../../src/infrastructure/obsidian/repositories/versionCheck';
import { buildProjectIndexEntries } from '../../src/infrastructure/persistence/index/buildProjectIndexEntries';
import { QuoteFrontmatterSchemaV1 } from '../../src/infrastructure/persistence/dto/quoteFrontmatter';

type Rig = Awaited<ReturnType<typeof downstreamStack>>;
const rigs: Rig[] = [];
afterEach(() => { for (const rig of rigs.splice(0)) rig.dispose(); vi.restoreAllMocks(); });
async function setup() { const rig = await downstreamStack(); rigs.push(rig); return rig; }
function reconcile(rig: Rig): void {
	rig.stack.metadataCache.catchUp();
	const scan = buildProjectIndexEntries({ ...rig.stack.deps, echo: rig.persistence.vaultDeps.echo });
	rig.persistence.index.rebuild(scan.entries, scan.exclusions);
}

it('refuses to overwrite an invalid persisted Quote even when its current raw version matches', async () => {
	const rig = await setup();
	const supplier = expectOk(createSupplier(createEntityId('supplier'), 'Quote contractor'));
	expectOk(await rig.persistence.suppliers.save(supplier, 'absent'));
	const quote: Quote = { id: createEntityId('quote'), projectId: rig.plan.projectId, supplierId: supplier.id,
		title: 'Dated quotation', issuedOn: '2026-09-07', validUntil: '2026-09-30', status: 'draft',
		items: [{ id: 'line', description: 'Floor work', amount: of('120', 'EUR'), assetIds: [rig.asset.id], work: [{ planId: rig.plan.id, workId: 'work-sand' }] }] };
	expectOk(await saveQuote(rig.persistence, { quote, expected: 'absent' }));
	const file = expectDefined(fileAt(rig.stack.deps.vault, rig.persistence.index.getPath(quote.id)), 'Quote note');
	await rig.persistence.vaultDeps.fileManager.processFrontMatter(file, raw => { raw.validUntil = '2026-09-01'; });
	rig.stack.metadataCache.catchUp();
	const raw = parseFrontmatter(await rig.stack.deps.vault.read(file)).frontmatter;
	expect(QuoteFrontmatterSchemaV1.safeParse(raw).success).toBe(true);
	expect(expectErr(await rig.persistence.quotes.getById(quote.id)).code).toBe('quote.entity-invalid');
	const currentVersion = versionOfFrontmatter(raw), bytes = [...rig.stack.vault.entries];
	const modify = vi.spyOn(rig.stack.deps.vault, 'modify');
	expect(expectErr(await rig.persistence.quotes.save(quote, currentVersion)).code).toBe('quote.invalid');
	expect(modify).not.toHaveBeenCalled();
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('reports an Asset read refusal without a stale path when reconciliation overtakes the listing snapshot', async () => {
	const rig = await setup(), survivor = makeAsset({ name: 'Surviving asset' });
	expectOk(await rig.persistence.assets.save(survivor, 'absent'));
	const path = expectDefined(rig.persistence.index.getPath(rig.asset.id), 'Asset path');
	const file = expectDefined(fileAt(rig.stack.deps.vault, path), 'Asset note');
	await rig.stack.deps.vault.modify(file, '# Personal asset notes\n\nPlanner ownership removed.\n');
	rig.stack.metadataCache.catchUp();
	expect(rig.persistence.index.getPath(rig.asset.id)).toBe(path);
	const read = rig.persistence.assets.getById.bind(rig.persistence.assets);
	let failureCode = '';
	vi.spyOn(rig.persistence.assets, 'getById').mockImplementation(async id => {
		const result = await read(id);
		if (id === rig.asset.id) {
			failureCode = expectErr(result).code;
			reconcile(rig);
		}
		return result;
	});
	const bytes = [...rig.stack.vault.entries], modify = vi.spyOn(rig.stack.deps.vault, 'modify');
	const listing = expectOk(await rig.persistence.assets.listAll());
	expect(rig.persistence.index.getPath(rig.asset.id)).toBeUndefined();
	expect(failureCode).not.toBe('');
	expect(listing.loaded.map(item => item.entity.id)).toEqual([survivor.id]);
	expect(listing.skipped).toEqual([{ assetId: rig.asset.id, code: failureCode, path: '' }]);
	expect(modify).not.toHaveBeenCalled();
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('keeps surviving Trades and the real refusal when a failed read is unindexed before listing resumes', async () => {
	const rig = await setup();
	const converted = expectOk(createTrade(createEntityId('trade'), 'Converted trade'));
	const survivor = expectOk(createTrade(createEntityId('trade'), 'Surviving trade'));
	expectOk(await rig.persistence.trades.save(converted, 'absent'));
	expectOk(await rig.persistence.trades.save(survivor, 'absent'));
	const path = expectDefined(rig.persistence.index.getPath(converted.id), 'Trade path');
	const file = expectDefined(fileAt(rig.stack.deps.vault, path), 'Trade note');
	await rig.stack.deps.vault.modify(file, '# Personal trade notes\n\nPlanner ownership removed.\n');
	rig.stack.metadataCache.catchUp();
	expect(rig.persistence.index.getPath(converted.id)).toBe(path);
	const read = rig.persistence.trades.getById.bind(rig.persistence.trades);
	let failureCode = '';
	vi.spyOn(rig.persistence.trades, 'getById').mockImplementation(async id => {
		const result = await read(id);
		if (id === converted.id) {
			failureCode = expectErr(result).code;
			reconcile(rig);
		}
		return result;
	});
	const bytes = [...rig.stack.vault.entries], modify = vi.spyOn(rig.stack.deps.vault, 'modify');
	const listing = expectOk(await rig.persistence.trades.listAll());
	expect(rig.persistence.index.getPath(converted.id)).toBeUndefined();
	expect(failureCode).not.toBe('');
	expect(listing.loaded.map(item => item.entity)).toEqual([survivor]);
	expect(listing.refused).toEqual([{ id: converted.id, code: failureCode, path: '' }]);
	expect(modify).not.toHaveBeenCalled();
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});
