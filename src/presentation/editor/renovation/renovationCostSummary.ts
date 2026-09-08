import type { PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';
import { aggregateCosts, costRows, materialRows } from '../planning/planningProjection';
import { inRenovationScope } from './renovationSummary';

/** Reuse reconciliation, including derived material estimates and its stale/mixed-currency refusal. */
export function renovationCostSummary(baseline: PlanningBaseline, roomId = '', targetId = '') {
	const roomIds = roomId && (!targetId || targetId === roomId) ? [roomId] : baseline.geometry.document.objects.map(item => item.id);
	const prepared = materialRows(baseline);
	const rows = roomIds.flatMap(id => costRows(baseline, id, prepared)).filter(row => !roomId || inRenovationScope(row.record, roomId, targetId));
	return { rows, count: rows.filter(row => !row.record.cancelled).length, totals: aggregateCosts(rows, baseline.currency) };
}
