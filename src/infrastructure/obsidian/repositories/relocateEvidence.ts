import type { PlanRepository } from '../../../application/ports/PlanRepository';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';
import type { EventBus } from '../../../core/events/EventBus';
import type { PlanId } from '../../../domain/plan/PlanId';
import { withPlanRenovation } from '../../../domain/plan/Plan';
import { ok } from '../../../core/result/Result';

/** The host already moved the user file. Update only matching links with conditional Plan writes. */
export async function relocateEvidence(deps: { plans: PlanRepository; index: ProjectIndex; events: EventBus }, oldPath: string, newPath: string) {
 for (const id of deps.index.getIdsByType('renovation-plan')) {
  const read = await deps.plans.getById(id as PlanId);
  if (!read.ok) return read;
  const loaded = read.value, renovation = loaded?.entity.renovation;
  if (!loaded || !renovation?.depth) continue;
  const depth = renovation.depth;
  if (!depth.evidence.some(item => moved(item.path, oldPath))) continue;
  const evidence = depth.evidence.map(item => moved(item.path, oldPath) ? { ...item, path: newPath + item.path.slice(oldPath.length) } : item);
  const changed = withPlanRenovation(loaded.entity, { ...renovation, depth: { ...depth, evidence } });
  if (!changed.ok) return changed;
  const saved = await deps.plans.save(changed.value, loaded.version);
  if (!saved.ok) return saved;
  await deps.events.publish({ type: 'PlanRenovationChanged', payload: { planId: loaded.entity.id, projectId: loaded.entity.projectId } });
 }
 return ok(undefined);
}
function moved(path: string, previous: string): boolean { return path === previous || path.startsWith(previous + '/'); }
