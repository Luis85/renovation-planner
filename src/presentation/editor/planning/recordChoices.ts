import type { PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { hasRoomContext } from '../../../domain/renovation/SharedLinks';

/** Human labels for non-spatial links; record IDs remain stable persisted keys. */
export function recordChoices(baseline: PlanningBaseline, roomId: string) {
 const renovation = baseline.plan.entity.renovation ?? EMPTY_RENOVATION;
 return [
  ...baseline.materials.filter(item => item.entity.origin.zoneId === roomId).map(({ entity }) => ({ id: entity.id, label: baseline.catalogue.find(item => item.asset.id === entity.assetId)?.asset.name ?? entity.id })),
  ...renovation.work.filter(item => hasRoomContext(item, roomId)).map(item => ({ id: item.id, label: item.title })),
  ...renovation.subjects.filter(item => item.roomId === roomId).map(item => ({ id: item.id, label: item.planned?.description || item.existing?.description || item.id })),
  ...renovation.decisions.filter(item => item.roomId === roomId).map(item => ({ id: item.id, label: item.question })),
  ...renovation.depth?.costs.filter(item => item.roomId === roomId).map(item => ({ id: item.id, label: item.title })) ?? [],
 ];
}
