import type { PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';

/** Resolve leaf focus through canonical records; a stale or foreign-room ID carries no link. */
export function planningSelectionContext(baseline: PlanningBaseline, roomId: string, focusedId: string) {
	const renovation = baseline.plan.entity.renovation ?? EMPTY_RENOVATION;
	const empty = { targetId: roomId, workId: '', outcomeId: '', requirementId: '', recordId: '' };
	const records = [
		...baseline.materials.map(({ entity }) => ({ ...empty, id: entity.id, roomId: entity.origin.zoneId, ...entity.source, requirementId: entity.id, recordId: entity.id })),
		...renovation.work.map(item => ({ ...empty, ...item, workId: item.id, recordId: item.id })),
		...renovation.subjects.map(item => ({ ...empty, ...item, outcomeId: item.planned ? item.id : '', recordId: item.id })),
		...renovation.decisions.map(item => ({ ...empty, ...item, targetId: renovation.subjects.find(subject => subject.id === item.subjectId)?.targetId ?? item.roomId, recordId: item.id })),
		...(renovation.depth?.costs ?? []).map(item => ({ ...empty, ...item, requirementId: '', recordId: item.id })),
		...(renovation.depth?.evidence ?? []).map(item => ({ ...empty, ...item })),
	];
	return records.find(item => item.id === focusedId && item.roomId === roomId) ?? empty;
}
