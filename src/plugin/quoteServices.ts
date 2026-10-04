import type { CompositionRoot } from './composition-root';
import type { ProjectId } from '../domain/project/ProjectId';
import { readQuoteComparison, saveQuote, type QuoteInput, type QuoteServices } from '../application/commands/quote/QuoteServices';
import { guardCommand, guardQuery } from '../application/errors/guardAgainstThrowing';
import { createQuoteChangeSource } from '../application/events/quoteChangeSource';
import { createSupplier } from '../domain/supplier/Supplier';
import { guardedNamedCatalogue } from './namedCatalogueServices';
import { VAULT_EXCEPTION_MAPPER } from './guardedServices';
export function quoteServices(root: CompositionRoot): QuoteServices | undefined {
 const persistence = root.persistence;
 if (!persistence) return undefined;
 // A READ, so no ADR-0034 write gate (owner ruling 74); the save below keeps it.
 const read = guardQuery({ execute: (id: ProjectId) => readQuoteComparison(persistence, id) }, 'quote.read-failed', root.logger, VAULT_EXCEPTION_MAPPER);
 const save = guardCommand({ execute: async (input: QuoteInput) => {
  const result = await saveQuote(persistence, input);
  if (result.ok) await root.eventBus.publish({ type: 'QuoteSaved', payload: { projectId: input.quote.projectId, id: input.quote.id } });
  return result;
 } }, 'quote.save-failed', root.logger, VAULT_EXCEPTION_MAPPER);
 return { read: id => read.execute(id), save: input => save.execute(input),
  suppliers: guardedNamedCatalogue({ kind: 'supplier', repository: persistence.suppliers, create: createSupplier }, root.eventBus, root.logger),
  onChanged: createQuoteChangeSource(root.eventBus),
 };
}
