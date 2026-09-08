import type { QuoteComparisonRead } from '../../../application/commands/quote/QuoteServices';
import type { QuoteItem } from '../../../domain/quote/Quote';
export interface QuoteScopeRow { readonly key: string; readonly labels: readonly { readonly id: string; readonly name: string | null }[]; readonly unmapped: boolean; readonly cells: ReadonlyMap<string, readonly QuoteItem[]> }
/** Only explicit matching link sets align. Unmapped lines remain separate per offer. */
export function quoteComparisonRows(read: QuoteComparisonRead): readonly QuoteScopeRow[] {
 const assets = new Map(read.assets.map(asset => [asset.id, asset.name]));
 const work = new Map(read.work.rows.map(row => [JSON.stringify([row.planId, row.work.id]), row.floor + ' · ' + row.work.title]));
 const rows = new Map<string, { key: string; labels: { id: string; name: string | null }[]; unmapped: boolean; cells: Map<string, QuoteItem[]> }>();
 for (const { entity: quote } of read.offers) {
  for (const item of quote.items) {
   const works = item.work.map(link => JSON.stringify([link.planId, link.workId])).toSorted();
   const assetIds = item.assetIds.toSorted(), unmapped = works.length === 0 && assetIds.length === 0;
   const key = unmapped ? JSON.stringify([quote.id, item.id]) : JSON.stringify([assetIds, works]);
   const row = rows.get(key) ?? { key, labels: [...assetIds.map(id => ({ id, name: assets.get(id) ?? null })), ...works.map(id => ({ id, name: work.get(id) ?? null }))], unmapped, cells: new Map<string, QuoteItem[]>() };
   row.cells.set(quote.id, [...row.cells.get(quote.id) ?? [], item]); rows.set(key, row);
  }
 }
 return Array.from(rows.values());
}
