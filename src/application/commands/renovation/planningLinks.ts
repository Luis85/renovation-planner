import { err, ok } from '../../../core/result/Result';
import { effectiveValue } from '../../../core/derived/DerivedValue';
import { reconcileCosts } from '../../../domain/cost/reconcileCosts';
import { depthError } from '../../../domain/renovation/validatePlanningDepth';
import { EMPTY_DEPTH, depthRecords, type PlanningDepth } from '../../../domain/renovation/PlanningDepth';
import type { Requirement } from '../../../domain/requirement/Requirement';
import { sourceMeasurement } from '../../../domain/requirement/RequirementSource';
import { EMPTY_RENOVATION, type Renovation } from '../../../domain/renovation/Renovation';
import type { PlanningBaseline } from './PlanningServices';
import { hasRoomContext, type RoomContext } from '../../../domain/renovation/SharedLinks';

export function materialReferents(depth: PlanningDepth | undefined, id: string): readonly string[] {
	return [...depth?.costs.filter(item => item.requirementId === id).map(item => item.title) ?? [],
		...depth?.evidence.filter(item => item.recordId === id).map(item => item.description) ?? [],
		...depth?.procurement.filter(item => item.requirementId === id).map(item => item.id) ?? []];
}
export function validateMaterialLinks(requirement: Requirement, baseline: PlanningBaseline, renovation = baseline.plan.entity.renovation ?? EMPTY_RENOVATION) {
	const source = requirement.source;
	if (!source) return ok(undefined);
	if (source.planId !== baseline.plan.entity.id || !baseline.geometry.document.objects.some(room => room.id === requirement.origin.zoneId)) return err(depthError());
	if (source.workId && !renovation.work.some(item => item.id === source.workId && hasRoomContext(item, requirement.origin.zoneId))) return err(depthError());
	if (source.outcomeId && !renovation.subjects.some(item => item.id === source.outcomeId && item.planned && item.roomId === requirement.origin.zoneId)) return err(depthError());
	if (!sourceMeasurement(source, requirement.origin.zoneId, baseline.geometry.document, requirement.unit, requirement.assetId).ok) return err(depthError());
	return ok(undefined);
}
export function validateDepthLinks(renovation: Renovation, baseline: PlanningBaseline) {
	const depth = renovation.depth ?? EMPTY_DEPTH;
	const records = new Map<string, RoomContext>([...renovation.subjects, ...renovation.work, ...renovation.decisions, ...depth.costs].map(item => [item.id, item]));
	for (const material of baseline.materials) {
		records.set(material.entity.id, { roomId: material.entity.origin.zoneId });
		const check = validateMaterialLinks(material.entity, baseline, renovation);
		if (!check.ok) return check;
	}
	const rooms = new Set(baseline.geometry.document.objects.map(item => item.id));
	if (depthRecords(depth).some(item => !rooms.has(item.roomId))) return err(depthError());
	if (!validProcurementLinks(depth, baseline)) return err(depthError());
	for (const item of depth.costs) {
		const requirement = baseline.materials.find(material => material.entity.id === item.requirementId)?.entity;
		if (item.requirementId && requirement?.origin.zoneId !== item.roomId) return err(depthError());
		const result = reconcileCosts(item, requirement ? effectiveValue(requirement.estimatedCost) : null, baseline.currency);
		if (!result.ok) return result;
	}
	if (depth.evidence.some(item => item.recordId && !hasRoomContext(records.get(item.recordId), item.roomId))) return err(depthError());
	return ok(undefined);
}

function validProcurementLinks(depth: PlanningDepth, baseline: PlanningBaseline): boolean {
 return depth.procurement.every(item => {
 const requirement = baseline.materials.find(material => material.entity.id === item.requirementId)?.entity;
 return !!requirement && requirement.origin.zoneId === item.roomId && requirement.unit === item.unit;
 });
}
