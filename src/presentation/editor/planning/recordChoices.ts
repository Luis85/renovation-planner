import type { PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';
import { EMPTY_RENOVATION, subjectLabel } from '../../../domain/renovation/Renovation';
import { contextOf, hasRoomContext } from '../../../domain/renovation/SharedLinks';
import { requirementContext } from '../../../domain/requirement/RequirementOrigin';

/** Human labels for non-spatial links; record IDs remain stable persisted keys. `context` is a CONTEXT id (zone or room-less target). */
export function recordChoices(baseline: PlanningBaseline, context: string) {
 const renovation = baseline.plan.entity.renovation ?? EMPTY_RENOVATION;
 const subjectContext = new Map(renovation.subjects.map(item => [item.id, contextOf(item)]));
 return [
  ...baseline.materials.filter(item => requirementContext(item.entity).roomId === context).map(({ entity }) => ({ id: entity.id, label: baseline.catalogue.find(item => item.asset.id === entity.assetId)?.asset.name ?? entity.id })),
  ...renovation.work.filter(item => hasRoomContext(item, context)).map(item => ({ id: item.id, label: item.title })),
  ...renovation.subjects.filter(item => contextOf(item) === context).map(item => ({ id: item.id, label: subjectLabel(item) })),
  ...renovation.decisions.filter(item => (item.roomId ?? subjectContext.get(item.subjectId)) === context).map(item => ({ id: item.id, label: item.question })),
  ...renovation.depth?.costs.filter(item => contextOf(item) === context).map(item => ({ id: item.id, label: item.title })) ?? [],
 ];
}
