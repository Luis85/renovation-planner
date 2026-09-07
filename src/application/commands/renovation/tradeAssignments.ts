import type { AppError } from '../../../core/errors/AppError';
import { err, ok, type Result } from '../../../core/result/Result';
import type { Trade, TradeId } from '../../../domain/trade/Trade';
import type { Renovation } from '../../../domain/renovation/Renovation';
import type { NamedRecordRepository } from '../../ports/NamedRecordRepository';

/** Existing unresolved assignments survive unrelated edits; a new assignment must resolve now. */
export async function validateTradeAssignments(next: Renovation, previous: Renovation, trades: NamedRecordRepository<Trade>): Promise<Result<void, AppError>> {
 for (const work of next.work) {
  if (work.responsibility !== 'trade') continue;
  const former = previous.work.find(item => item.id === work.id);
  if (former?.responsibility === 'trade' && former.tradeId === work.tradeId) continue;
  const found = await trades.getById(work.tradeId as TradeId);
  if (!found.ok) return found;
  if (!found.value) return err({ category: 'Reference', code: 'renovation.trade-missing', message: 'The selected trade is no longer readable.' });
 }
 return ok(undefined);
}
