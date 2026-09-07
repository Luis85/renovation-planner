import type { EntityId } from '../../core/identity/EntityId';
import type { ValidationError } from '../../core/errors/AppError';
import { err, ok, type Result } from '../../core/result/Result';

export type TradeId = EntityId<'trade'>;
/** A vault-wide discipline of work, never a person or a project-local label. */
export interface Trade { readonly id: TradeId; readonly name: string }
export function createTrade(id: TradeId, name: string): Result<Trade, ValidationError> {
 if (!id.trim() || !name.trim()) return err({ category: 'Validation', code: 'trade.invalid', message: 'A trade needs an identity and a name.' });
 return ok({ id, name: name.trim() });
}
