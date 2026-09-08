import { EMPTY_DEPTH, type PlanningDepth } from './PlanningDepth';
import { EMPTY_RENOVATION, type Renovation } from './Renovation';

function content(value: Renovation): unknown {
	return [depthContent(value.depth ?? EMPTY_DEPTH), value.subjects.map(s => [s.id, s.roomId, s.targetId, s.kind,
		s.existing ? [s.existing.description, s.existing.condition] : null,
		s.planned ? [s.planned.change, s.planned.description] : null]),
	value.work.map(w => [w.id, w.roomId, w.targetId, w.title, w.description, w.order, w.progress, w.responsibility, w.outcomes, w.dependencies]),
	value.decisions.map(d => [d.id, d.roomId, d.subjectId, d.question, d.resolution, d.resolved])];
}
/** Compare owned facts, independent of mapper property insertion order. */
export function sameRenovation(a: Renovation | undefined, b: Renovation | undefined): boolean {
	return JSON.stringify(content(a ?? EMPTY_RENOVATION)) === JSON.stringify(content(b ?? EMPTY_RENOVATION));
}

const context = (item: { id: string; roomId: string; targetId: string; workId: string }) => [item.id, item.roomId, item.targetId, item.workId];
function depthContent(depth: PlanningDepth): unknown {
 return [depth.procurement.map(item => [...context(item), item.requirementId, item.unit, item.purchased, item.reserved]),
 depth.costs.map(item => [...context(item), item.title, item.category, item.requirementId, item.planned ? [item.planned.amount, item.planned.currency] : null, item.cancelled,
 item.facts.map(fact => [fact.id, fact.stage, fact.amount.amount, fact.amount.currency, fact.description, fact.commitmentId, fact.cancelled])]),
 depth.evidence.map(item => [...context(item), item.description, item.type, item.phase, item.path, item.subpath, item.recordId, item.pin ? [item.pin.x, item.pin.y] : null])];
}
