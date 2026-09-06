import { of } from '../../core/money/Money';
import { err, ok } from '../../core/result/Result';
import { reconcileCosts } from '../cost/reconcileCosts';
import { depthRecords, EVIDENCE_PHASES, EVIDENCE_TYPES, validProcurement, type CostRecord, type Evidence, type PlanningDepth } from './PlanningDepth';
import type { Renovation } from './Renovation';

export function depthError() { return { category: 'Validation' as const, code: 'renovation.depth-invalid', message: 'Resolve the linked planning records before applying this change.' }; }
export function validatePlanningDepth(value: PlanningDepth, renovation: Renovation) {
	const all = depthRecords(value);
	const work = new Map(renovation.work.map(item => [item.id, item]));
	if (all.some(item => !item.id || !item.roomId || !item.targetId || (item.workId && work.get(item.workId)?.roomId !== item.roomId))) return err(depthError());
	const identities = [...all, ...renovation.subjects, ...renovation.work, ...renovation.decisions];
	if (new Set(identities.map(item => item.id)).size !== identities.length || new Set(value.procurement.map(item => item.requirementId)).size !== value.procurement.length) return err(depthError());
	if (value.procurement.some(item => !validProcurement(item))) return err(depthError());
	const materialCosts = value.costs.filter(item => item.requirementId && !item.cancelled);
	if (new Set(materialCosts.map(item => item.requirementId)).size !== materialCosts.length) return err(depthError());
	if (!value.costs.every(validCost)) return err(depthError());
	const linked = new Map([...renovation.subjects, ...renovation.work, ...renovation.decisions, ...value.costs].map(item => [item.id, item.roomId]));
 if (!value.evidence.every(evidence => validEvidence(evidence, linked))) return err(depthError());
 return ok(undefined);
}
function validCost(cost: CostRecord): boolean {
 if (!cost.title.trim() || !['material', 'labor', 'other'].includes(cost.category) || (!cost.planned && !cost.requirementId)) return false;
 // Project currency and derived estimate are checked at the application boundary.
 const example = cost.planned ?? cost.facts[0]?.amount ?? of('0', 'EUR');
 return reconcileCosts(cost, example, example.currency).ok;
}
function validEvidence(evidence: Evidence, linked: ReadonlyMap<string, string>): boolean {
 if (!evidence.path || !evidence.description.trim() || !EVIDENCE_TYPES.includes(evidence.type) || !EVIDENCE_PHASES.includes(evidence.phase)) return false;
 if (evidence.recordId && linked.has(evidence.recordId) && linked.get(evidence.recordId) !== evidence.roomId) return false;
 return !evidence.pin || [evidence.pin.x, evidence.pin.y].every(coordinate => Number.isFinite(coordinate) && coordinate >= 0 && coordinate <= 1);
}
