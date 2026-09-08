import type { AppError, ValidationError } from '../../../core/errors/AppError';
import type { EntityId } from '../../../core/identity/EntityId';
import type { EventBus } from '../../../core/events/EventBus';
import { err, ok, type Result } from '../../../core/result/Result';
import type { NamedRecordListing, NamedRecordRepository } from '../../ports/NamedRecordRepository';
import { changedEntry, disposeAll, subscribeAll } from '../../events/subscriptions';

export interface NamedCatalogueCreate { readonly id: string; readonly name: string }
export interface NamedCatalogueServices<T extends { readonly id: EntityId<string>; readonly name: string }> {
 list(): Promise<Result<NamedRecordListing<T>, AppError>>;
 create(input: NamedCatalogueCreate): Promise<Result<T, AppError>>;
 onChanged(listener: () => void): () => void;
}
export interface NamedCatalogueSource<T extends { readonly id: EntityId<string>; readonly name: string }> {
 readonly kind: 'trade' | 'supplier';
 readonly repository: NamedRecordRepository<T>;
 create(id: T['id'], name: string): Result<T, ValidationError>;
}
export function namedCatalogueServices<T extends { readonly id: EntityId<string>; readonly name: string }>(source: NamedCatalogueSource<T>, events: EventBus): NamedCatalogueServices<T> {
 const changed = source.kind === 'trade' ? 'TradeCreated' : 'SupplierCreated';
 return {
  list: () => source.repository.listAll(),
  async create(input) {
   const value = source.create(input.id as T['id'], input.name);
   if (!value.ok) return value;
   const existing = await source.repository.getById(value.value.id);
   if (!existing.ok) return existing;
   if (existing.value) return existing.value.entity.name === value.value.name ? ok(existing.value.entity)
    : err({ category: 'Validation', code: source.kind + '.create-conflict', message: 'This draft was already saved with a different name. Refresh the catalogue.' });
   const saved = await source.repository.save(value.value, 'absent');
   if (!saved.ok) return saved;
   await events.publish({ type: changed, payload: { id: saved.value.entity.id } });
   return ok(saved.value.entity);
  },
  onChanged(listener) {
   return disposeAll([
    ...subscribeAll(events, ['ProjectIndexRebuilt', changed], listener),
    ...subscribeAll(events, ['ProjectIndexEntryChanged'], event => { if (changedEntry(event).entityType === 'renovation-' + source.kind) listener(); }),
   ]);
  },
 };
}
