import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRepositoryStack, parseFrontmatter } from '../../../helpers/vault';
import { expectDefined, expectOk } from '../../../helpers/domain';
import { ObsidianNamedCatalogueRepository } from '../../../../src/infrastructure/obsidian/repositories/ObsidianNamedCatalogueRepository';
import { TRADE_MAPPER, SUPPLIER_MAPPER } from '../../../../src/infrastructure/persistence/mappers/namedCatalogueMapper';
import { createTrade, type Trade, type TradeId } from '../../../../src/domain/trade/Trade';
import { createSupplier, type SupplierId } from '../../../../src/domain/supplier/Supplier';
import { namedCatalogueServices } from '../../../../src/application/commands/catalogue/NamedCatalogueServices';
import { err } from '../../../../src/core/result/Result';
import type { NamedRecordRepository } from '../../../../src/application/ports/NamedRecordRepository';
import { freshNotePath } from '../../../../src/infrastructure/obsidian/repositories/paths';
afterEach(() => { vi.restoreAllMocks(); });
function setup() { const stack = createRepositoryStack(); const trades: NamedRecordRepository<Trade> = new ObsidianNamedCatalogueRepository(stack.deps, 'Shared/Library', TRADE_MAPPER); return { stack, trades }; }
describe('canonical shared Trade and Supplier notes', () => {
 it('returns a real host create refusal without publishing and retries the same catalogue identity', async () => {
  const { stack, trades } = setup(), services = namedCatalogueServices({ kind: 'trade', repository: trades, create: createTrade }, stack.events);
  const input = { id: 'trade-create-retry', name: 'Floor finishing' }, trade = expectOk(createTrade(input.id as TradeId, input.name));
  const path = freshNotePath(stack.deps.vault, 'Shared/Library/Trades', trade.name, trade.id), failure = 'create:' + path;
  const publish = vi.spyOn(stack.events, 'publish'), before = [...stack.vault.entries];
  stack.vault.failures.add(failure);
  try {
   expect(await services.create(input)).toMatchObject({ ok: false, error: { code: 'trade.write-failed' } });
   expect(stack.vault.failedOps).toContain(failure); expect(publish).not.toHaveBeenCalled();
   expect([...stack.vault.entries]).toEqual(before); expect(stack.index.getPath(trade.id)).toBeUndefined();
   stack.vault.failures.delete(failure);
   expect(expectOk(await services.create(input))).toEqual(trade);
   expect(expectOk(await trades.listAll()).loaded.map(item => item.entity)).toEqual([trade]);
   expect(publish).toHaveBeenCalledExactlyOnceWith({ type: 'TradeCreated', payload: { id: trade.id } });
  } finally { stack.vault.failures.delete(failure); }
 });
 it('stores separate stable identities outside projects and reads their custom names', async () => {
  const { stack, trades } = setup(), suppliers = new ObsidianNamedCatalogueRepository(stack.deps, 'Shared/Library', SUPPLIER_MAPPER);
  const trade = expectOk(createTrade('trade-a' as TradeId, ' Custom finishing '));
  const supplier = expectOk(createSupplier('supplier-a' as SupplierId, ' Finishing business '));
  expectOk(await trades.save(trade, 'absent')); expectOk(await suppliers.save(supplier, 'absent'));
  expect(stack.index.getPath(trade.id)).toMatch(/^Shared\/Library\/Trades\//);
  expect(stack.index.getPath(supplier.id)).toMatch(/^Shared\/Library\/Suppliers\//);
  expect(stack.index.entries().every(item => item.projectId === undefined)).toBe(true);
  expect(expectOk(await trades.listAll()).loaded[0].entity).toEqual(trade);
  expect(expectOk(await suppliers.listAll()).loaded[0].entity).toEqual(supplier);
  expectOk(await suppliers.save({ ...supplier, name: 'Renamed party' }, expectDefined(expectOk(await suppliers.getById(supplier.id)), 'supplier').version));
  expect(expectOk(await suppliers.getById(supplier.id))?.entity.name).toBe('Renamed party');
 });
 it('preserves unowned frontmatter and body through rename, but refuses stale owned changes', async () => {
  const { stack, trades } = setup(), trade = expectOk(createTrade('trade' as TradeId, 'Plumbing'));
  const saved = expectOk(await trades.save(trade, 'absent')), path = expectDefined(stack.index.getPath(trade.id), 'trade path');
  stack.vault.entries.set(path, expectDefined(stack.vault.entries.get(path), 'bytes').replace('---\n', '---\ncontact-note: keep\n') + '\nPrivate body\n');
  const renamed = expectOk(await trades.save({ ...trade, name: 'Water services' }, saved.version));
  expect(parseFrontmatter(expectDefined(stack.vault.entries.get(path), 'saved bytes')).frontmatter['contact-note']).toBe('keep'); expect(stack.vault.entries.get(path)).toContain('Private body');
  expect(await trades.save({ ...trade, name: 'Stale edit' }, saved.version)).toMatchObject({ ok: false, error: { code: 'trade.revision-conflict' } });
  expect(expectOk(await trades.getById(trade.id))?.entity).toEqual(renamed.entity);
  const moved = 'Elsewhere/Trade.md'; stack.vault.entries.set(moved, expectDefined(stack.vault.entries.get(path), 'renamed bytes')); stack.vault.entries.delete(path); stack.metadataCache.catchUp(); stack.rebuildIndex();
  expect(expectOk(await trades.getById(trade.id))?.entity.name).toBe('Water services'); expect(stack.index.getPath(trade.id)).toBe(moved);
 });
 it('reports unreadable future schemas and excludes missing notes without pretending the catalogue is empty', async () => {
  const { stack, trades } = setup(), bad = expectOk(createTrade('bad' as TradeId, 'Future'));
  expect(expectOk(await trades.listAll())).toEqual({ loaded: [], refused: [] });
  expectOk(await trades.save(bad, 'absent')); const path = expectDefined(stack.index.getPath(bad.id), 'path');
  stack.vault.entries.set(path, expectDefined(stack.vault.entries.get(path), 'bytes').replace('schema-version: 1', 'schema-version: 99'));
  expect(expectOk(await trades.listAll())).toMatchObject({ loaded: [], refused: [{ id: bad.id, path, code: 'trade.schema-version-unsupported' }] });
  stack.vault.entries.delete(path); expect(expectOk(await trades.getById(bad.id))).toBeNull();
 });
 it('keeps a create retry on its original identity and stops subscriptions after disposal', async () => {
  const { stack, trades } = setup(), services = namedCatalogueServices({ kind: 'trade', repository: trades, create: createTrade }, stack.events);
  const listener = vi.fn<() => void>(), dispose = services.onChanged(listener), save = vi.spyOn(trades, 'save');
  const input = { id: 'stable-trade', name: 'Plumbing' };
  expectOk(await services.create(input)); expectOk(await services.create(input));
  expect(save).toHaveBeenCalledOnce(); expect(listener).toHaveBeenCalledOnce();
  expect(await services.create({ ...input, name: 'Different draft' })).toMatchObject({ ok: false, error: { code: 'trade.create-conflict' } });
  expect(await services.create({ id: 'invalid', name: ' ' })).toMatchObject({ ok: false, error: { category: 'Validation' } });
  const failure = { category: 'Persistence' as const, code: 'test.read', message: 'unavailable' };
  vi.spyOn(trades, 'getById').mockResolvedValueOnce(err(failure)); expect(await services.create({ id: 'new', name: 'New' })).toEqual(err(failure));
  await stack.events.publish({ type: 'ProjectIndexEntryChanged', payload: { entityType: 'renovation-trade' } }); expect(listener).toHaveBeenCalledTimes(2);
  await stack.events.publish({ type: 'ProjectIndexEntryChanged', payload: { entityType: 'renovation-asset' } }); expect(listener).toHaveBeenCalledTimes(2);
  dispose(); await stack.events.publish({ type: 'ProjectIndexRebuilt' }); expect(listener).toHaveBeenCalledTimes(2);
 });
});
