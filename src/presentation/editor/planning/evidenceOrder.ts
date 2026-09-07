import type { Evidence } from '../../../domain/renovation/PlanningDepth';

/** Date order uses only recorded dates. Undated records follow, retaining source order for ties. */
export function orderEvidenceByDate(rows: readonly Evidence[]): Evidence[] {
 return rows.toSorted((a, b) => {
  if (a.date === b.date) return 0;
  if (a.date === undefined) return 1;
  if (b.date === undefined) return -1;
  return a.date < b.date ? -1 : 1;
 });
}
