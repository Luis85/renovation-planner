import { err, ok } from '../../../core/result/Result';
import { effectiveValue } from '../../../core/derived/DerivedValue';
import { reconcileCosts } from '../../../domain/cost/reconcileCosts';
import { depthError } from '../../../domain/renovation/validatePlanningDepth';
import { EMPTY_DEPTH, depthRecords, type PlanningDepth } from '../../../domain/renovation/PlanningDepth';
import type { Requirement } from '../../../domain/requirement/Requirement';
import { sourceMeasurement } from '../../../domain/requirement/RequirementSource';
import { EMPTY_RENOVATION, type Renovation } from '../../../domain/renovation/Renovation';
import type { PlanningBaseline } from './PlanningServices';
import { contextOf, hasRoomContext, type RoomContext } from '../../../domain/renovation/SharedLinks';
import { originRoomId, requirementContext } from '../../../domain/requirement/RequirementOrigin';

/** What still uses requirement `id`: a cost by its title, evidence by its description, and an order — which has no name of its own — by `orderName`, else its id. */
export function materialReferents(depth: PlanningDepth | undefined, id: string, orderName?: string): readonly string[] {
	return [...depth?.costs.filter(item => item.requirementId === id).map(item => item.title) ?? [],
		...depth?.evidence.filter(item => item.recordId === id).map(item => item.description) ?? [],
		...depth?.procurement.filter(item => item.requirementId === id).map(item => orderName ?? item.id) ?? []];
}
export function validateMaterialLinks(requirement: Requirement, baseline: PlanningBaseline, renovation = baseline.plan.entity.renovation ?? EMPTY_RENOVATION) {
	const source = requirement.source;
	if (!source) return ok(undefined);
	const room = originRoomId(requirement.origin), context = requirementContext(requirement).roomId;
	if (source.planId !== baseline.plan.entity.id || (room !== undefined && !baseline.geometry.document.objects.some(item => item.id === room))) return err(depthError());
	if (source.workId && !renovation.work.some(item => item.id === source.workId && hasRoomContext(item, context))) return err(depthError());
	if (source.outcomeId && !renovation.subjects.some(item => item.id === source.outcomeId && item.planned && contextOf(item) === context)) return err(depthError());
	if (!sourceMeasurement(source, room, baseline.geometry.document, requirement.unit, requirement.assetId).ok) return err(depthError());
	return ok(undefined);
}
export function validateDepthLinks(renovation: Renovation, baseline: PlanningBaseline) {
	const depth = renovation.depth ?? EMPTY_DEPTH;
	const subjects = new Map(renovation.subjects.map(item => [item.id, item]));
	const records = new Map<string, RoomContext>([...renovation.subjects, ...renovation.work, ...depth.costs].map(item => [item.id, item]));
	// A decision has no targetId of its own; it inherits its context from its subject (ADR-0030).
	for (const item of renovation.decisions) records.set(item.id, { roomId: item.roomId, targetId: subjects.get(item.subjectId)?.targetId ?? '' });
	for (const material of baseline.materials) {
		records.set(material.entity.id, requirementContext(material.entity));
		const check = validateMaterialLinks(material.entity, baseline, renovation);
		if (!check.ok) return check;
	}
	const rooms = new Set(baseline.geometry.document.objects.map(item => item.id));
	if (depthRecords(depth).some(item => item.roomId !== undefined && !rooms.has(item.roomId))) return err(depthError());
	if (!validProcurementLinks(depth, baseline)) return err(depthError());
	const costs = validCostLinks(depth, baseline);
	if (!costs.ok) return costs;
	if (depth.evidence.some(item => item.recordId && !hasRoomContext(records.get(item.recordId), contextOf(item)))) return err(depthError());
	return ok(undefined);
}

function validProcurementLinks(depth: PlanningDepth, baseline: PlanningBaseline): boolean {
 return depth.procurement.every(item => {
 const requirement = baseline.materials.find(material => material.entity.id === item.requirementId)?.entity;
 return !!requirement && requirementContext(requirement).roomId === contextOf(item) && requirement.unit === item.unit;
 });
}
function validCostLinks(depth: PlanningDepth, baseline: PlanningBaseline) {
	for (const item of depth.costs) {
		const requirement = baseline.materials.find(material => material.entity.id === item.requirementId)?.entity;
		if (item.requirementId && (!requirement || requirementContext(requirement).roomId !== contextOf(item))) return err(depthError());
		const result = reconcileCosts(item, requirement ? effectiveValue(requirement.estimatedCost) : null, baseline.currency);
		if (!result.ok) return result;
	}
	return ok(undefined);
}
