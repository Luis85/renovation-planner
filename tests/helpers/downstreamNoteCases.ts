import type { EntityId } from '../../src/core/identity/EntityId';
import { createEntityId } from '../../src/core/identity/generateId';
import type { DiagnosticEntityKind } from '../../src/application/ports/diagnostics';
import type { AppError } from '../../src/core/errors/AppError';
import type { Result } from '../../src/core/result/Result';
import type { RepositoryStack } from './vault';
import { expectOk } from './domain';
import { makeProject } from './entities';
import { ObsidianNamedCatalogueRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianNamedCatalogueRepository';
import { ObsidianQuoteRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianQuoteRepository';
import { TRADE_MAPPER, SUPPLIER_MAPPER, type NamedCatalogueMapper } from '../../src/infrastructure/persistence/mappers/namedCatalogueMapper';
import type { Quote, QuoteId } from '../../src/domain/quote/Quote';
import type { SupplierId } from '../../src/domain/supplier/Supplier';
import { of } from '../../src/core/money/Money';
import { expectTargetedUpdatePreservesUserContent } from '../contracts/notePreservation';
interface NoteCase {
 readonly kind: DiagnosticEntityKind;
 readonly reads: string;
 seed(stack: RepositoryStack): Promise<EntityId<string>>;
 read(stack: RepositoryStack, id: EntityId<string>): Promise<Result<unknown, AppError>>;
 drive(stack: RepositoryStack): Promise<unknown>;
}
function namedCase<T extends { readonly id: EntityId<string>; readonly name: string }>(mapper: NamedCatalogueMapper<T>): NoteCase {
 const repo = (stack: RepositoryStack) => new ObsidianNamedCatalogueRepository(stack.deps, 'Library', mapper);
 const entity = () => expectOk(mapper.read({ id: createEntityId(mapper.kind), type: mapper.indexType, name: 'Original catalogue record', 'schema-version': 1, revision: 1 }));
 return {
  kind: mapper.kind, reads: 'Renamed catalogue record',
  seed: async stack => expectOk(await repo(stack).save(entity(), 'absent')).entity.id,
  read: (stack, id) => repo(stack).getById(id),
  async drive(stack) {
   const records = repo(stack), written = expectOk(await records.save(entity(), 'absent'));
   await expectTargetedUpdatePreservesUserContent({ stack, id: written.entity.id, write: () => records.save({ ...written.entity, name: 'Renamed catalogue record' }, written.version), expectOwned: { name: 'Renamed catalogue record' } });
   return expectOk(await records.getById(written.entity.id))?.entity.name;
  },
 };
}
async function seedQuote(stack: RepositoryStack) {
 const project = expectOk(await stack.projects.save(makeProject(), 'absent'));
 const supplier = { id: createEntityId('supplier') as SupplierId, name: 'Local supplier' };
 expectOk(await new ObsidianNamedCatalogueRepository(stack.deps, 'Library', SUPPLIER_MAPPER).save(supplier, 'absent'));
 const quote: Quote = { id: createEntityId('quote') as QuoteId, projectId: project.entity.id, supplierId: supplier.id, title: 'Original offer', issuedOn: '2026-09-07', status: 'draft', items: [{ id: 'line', description: 'Explicit offer', amount: of('19.50', 'EUR'), assetIds: [], work: [] }] };
 return expectOk(await new ObsidianQuoteRepository(stack.deps).save(quote, 'absent'));
}
const quoteCase: NoteCase = {
 kind: 'quote', reads: 'Updated offer',
 seed: async stack => (await seedQuote(stack)).entity.id,
 read: (stack, id) => new ObsidianQuoteRepository(stack.deps).getById(id as QuoteId),
 async drive(stack) {
  const repository = new ObsidianQuoteRepository(stack.deps), written = await seedQuote(stack);
  await expectTargetedUpdatePreservesUserContent({ stack, id: written.entity.id, write: () => repository.save({ ...written.entity, title: 'Updated offer' }, written.version), expectOwned: { title: 'Updated offer' } });
  return expectOk(await repository.getById(written.entity.id))?.entity.title;
 },
};
/** Same real note cases join the existing census, refusal, identity and preservation rules. */
export const DOWNSTREAM_NOTE_CASES = [namedCase(TRADE_MAPPER), namedCase(SUPPLIER_MAPPER), quoteCase];
