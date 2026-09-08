import type { EntityId } from '../../core/identity/EntityId';
import type { ValidationError } from '../../core/errors/AppError';
import { err, ok, type Result } from '../../core/result/Result';

export type SupplierId = EntityId<'supplier'>;
/** A shared party identity. Received offers and prices belong to Quotes. */
export interface Supplier { readonly id: SupplierId; readonly name: string }
export function createSupplier(id: SupplierId, name: string): Result<Supplier, ValidationError> {
 if (!id.trim() || !name.trim()) return err({ category: 'Validation', code: 'supplier.invalid', message: 'A supplier needs an identity and a name.' });
 return ok({ id, name: name.trim() });
}
