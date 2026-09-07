import type { CompositionRoot } from './composition-root';
import type { ProjectId } from '../domain/project/ProjectId';
import { readQuoteComparison, saveQuote, type QuoteInput, type QuoteServices } from '../application/commands/quote/QuoteServices';
import { guardCommand } from '../application/errors/guardAgainstThrowing';
import { disposeAll, subscribeAll } from '../application/events/subscriptions';
import { createSupplier } from '../domain/supplier/Supplier';
import { guardedNamedCatalogue } from './namedCatalogueServices';
import { VAULT_EXCEPTION_MAPPER } from './guardedServices';
export function quoteServices(root: CompositionRoot): QuoteServices | undefined {
 const persistence = root.persistence;
 if (!persistence) return undefined;
 const read = guardCommand({ execute: (id: ProjectId) => readQuoteComparison(persistence, id) }, 'quote.read-failed', root.logger, VAULT_EXCEPTION_MAPPER);
 const save = guardCommand({ execute: async (input: QuoteInput) => {
  const result = await saveQuote(persistence, input);
  if (result.ok) await root.eventBus.publish({ type: 'QuoteSaved', payload: { projectId: input.quote.projectId, id: input.quote.id } });
  return result;
 } }, 'quote.save-failed', root.logger, VAULT_EXCEPTION_MAPPER);
 return { read: id => read.execute(id), save: input => save.execute(input),
  suppliers: guardedNamedCatalogue({ kind: 'supplier', repository: persistence.suppliers, create: createSupplier }, root.eventBus, root.logger),
  onChanged: listener => disposeAll(subscribeAll(root.eventBus, ['ProjectIndexRebuilt', 'ProjectIndexEntryChanged', 'QuoteSaved', 'SupplierCreated', 'PlanRenovationChanged'], listener)),
 };
}
