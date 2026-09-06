import { effectiveValue } from '../../../core/derived/DerivedValue';
import { add, sameMoney, zero, type Money } from '../../../core/money/Money';
import { prepareMaterial, type PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';
import { EMPTY_DEPTH, outstanding, type CostRecord } from '../../../domain/renovation/PlanningDepth';
import { reconcileCosts } from '../../../domain/cost/reconcileCosts';
import type { Requirement } from '../../../domain/requirement/Requirement';
import type { EvidenceFiles } from '../../../application/ports/EvidenceFiles';

function sourceOf(requirement: Requirement, baseline: PlanningBaseline) {
	return requirement.source ?? { planId: baseline.plan.entity.id, targetId: requirement.origin.zoneId, workId: '', outcomeId: '', state: 'current' as const, rule: 'room-area' as const, manual: '0', coverage: '1', lot: '', minimum: '' };
}
export function materialRows(baseline: PlanningBaseline) {
	return baseline.materials.map(({ entity }) => {
		const source = sourceOf(entity, baseline), selected = baseline.catalogue.find(item => item.asset.id === entity.assetId);
		const current = prepareMaterial(baseline, { id: entity.id, roomId: entity.origin.zoneId, assetId: entity.assetId, source,
			waste: entity.wasteFactor.toString(), override: entity.quantity.override?.value.toString() ?? '' });
		// The recorded source measurement is compared as well as the figures derived from it, the way
		// `buildRequirementRow`'s `inputsStillMatch` does: packaging rounds to a whole lot, so a room
		// or wall that moved a little can leave quantity and cost unchanged while `zoneArea` still
		// records the old measurement — provenance the shopping list must not read as current.
		const stale = entity.recalculationStatus === 'stale' || !current.ok || !entity.quantity.calculated.value.eq(current.value.quantity.calculated.value)
			|| !entity.calculatedFrom.zoneArea.value.eq(current.value.calculatedFrom.zoneArea.value)
			|| !sameMoney(entity.estimatedCost.calculated, current.value.estimatedCost.calculated) || !sameMoney(entity.calculatedFrom.unitCost, current.value.calculatedFrom.unitCost);
		const procurement = baseline.plan.entity.renovation?.depth?.procurement.find(item => item.requirementId === entity.id);
		return { entity, source, name: selected?.asset.name ?? entity.assetId, stale, refused: !current.ok, procurement,
			needed: effectiveValue(entity.quantity).value, outstanding: outstanding(effectiveValue(entity.quantity).value, procurement), cost: effectiveValue(entity.estimatedCost),
			price: entity.calculatedFrom.unitCost, priceChanged: !!selected && !sameMoney(selected.price, entity.calculatedFrom.unitCost) };
	});
}
export function costRows(baseline: PlanningBaseline, roomId: string) {
	const materials = materialRows(baseline).filter(item => item.entity.origin.zoneId === roomId);
	const saved = (baseline.plan.entity.renovation?.depth ?? EMPTY_DEPTH).costs.filter(item => item.roomId === roomId);
	const derived: CostRecord[] = materials.filter(item => !saved.some(cost => cost.requirementId === item.entity.id && !cost.cancelled)).map(item => ({
		id: `estimate:${item.entity.id}`, roomId, targetId: item.source.targetId, workId: item.source.workId, title: item.name, category: 'material', requirementId: item.entity.id,
		planned: null, facts: [], cancelled: false }));
	return [...saved, ...derived].map(record => {
		const material = materials.find(item => item.entity.id === record.requirementId);
		return { record, stale: !record.planned && !!material?.stale, totals: reconcileCosts(record, material?.cost ?? null, baseline.currency) };
	});
}
export function aggregateCosts(rows: ReturnType<typeof costRows>, currency: string): Record<'planned' | 'committed' | 'actual' | 'openCommitment' | 'remaining', Money> | null {
	const totals = { planned: zero(currency), committed: zero(currency), actual: zero(currency), openCommitment: zero(currency), remaining: zero(currency) };
	for (const row of rows) {
		if (!row.totals.ok || row.stale) return null;
		for (const key of Object.keys(totals) as (keyof typeof totals)[]) { const sum = add(totals[key], row.totals.value[key]); if (!sum.ok) return null; totals[key] = sum.value; }
	}
	return totals;
}
export type PlanningFinding = { kind: 'stale' | 'reconciliation' | 'missing-file'; roomId: string; id: string; description: string; mode: 'materials' | 'costs' | 'documents' | 'photos' | 'notes' };
function financialFindings(baseline: PlanningBaseline): PlanningFinding[] {
 return baseline.geometry.document.objects.flatMap(room => costRows(baseline, room.id)
  .filter(row => !row.totals.ok || row.totals.value.remaining.amount.startsWith('-'))
  .map(row => ({ kind: 'reconciliation' as const, roomId: room.id, id: row.record.id, description: row.record.title, mode: 'costs' as const })));
}
export function planningFindings(baseline: PlanningBaseline, files?: EvidenceFiles): PlanningFinding[] {
 const stale: PlanningFinding[] = materialRows(baseline).filter(item => item.stale).map(item => ({ kind: 'stale', roomId: item.entity.origin.zoneId, id: item.entity.id, description: item.name, mode: 'materials' }));
 const missing: PlanningFinding[] = (baseline.plan.entity.renovation?.depth?.evidence ?? [])
  .filter(item => files && !files.resolve(item.path + item.subpath, baseline.plan.entity.id).ok)
  .map(item => ({ kind: 'missing-file', roomId: item.roomId, id: item.id, description: item.description, mode: item.type === 'photo' ? 'photos' : item.type === 'note' ? 'notes' : 'documents' }));
 return [...stale, ...financialFindings(baseline), ...missing].toSorted((a, b) => a.kind.localeCompare(b.kind, 'en') || a.id.localeCompare(b.id, 'en'));
}
export function shoppingBody(baseline: PlanningBaseline): string | null {
	const rows = materialRows(baseline).filter(item => item.outstanding.gt(0));
	if (rows.some(item => item.stale)) return null;
	// One row per requirement deliberately preserves pricing/source context; no unsafe name-based merge.
	return rows.map(item => `- [ ] ${item.name.replace(/[\r\n[\]<>]/g, ' ')}: ${item.outstanding.toString()} ${item.entity.unit} · ${item.price.amount} ${item.price.currency}/${item.entity.unit}\n  [[rp-id:${item.entity.id}]] · [[rp-id:${item.entity.origin.zoneId}]] · ${item.source.state}/${item.source.rule} · waste ${item.entity.wasteFactor.mul(100).toString()}% · lot ${item.source.lot || '—'} · minimum ${item.source.minimum || '—'}`).join('\n');
}
