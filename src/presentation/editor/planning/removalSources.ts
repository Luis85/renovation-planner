import type { PlanEditorContext } from '../PlanEditorContext';
import type { PlanId } from '../../../domain/plan/PlanId';
import { ok } from '../../../core/result/Result';
/** Fresh names shown before geometry removal; the repository repeats the referential check at write time. */
export async function removalSources(context: Pick<PlanEditorContext, 'planId' | 'commands'>, ids: readonly string[]) {
 if (!context.commands.planning) return ok<string[]>([]);
 const read = await context.commands.planning.read(context.planId as PlanId);
 if (!read.ok) return read;
 const names = read.value.materials.filter(({ entity }) => ids.includes(entity.origin.zoneId) || (entity.source && ids.includes(entity.source.targetId)))
  .map(({ entity }) => read.value.catalogue.find(item => item.asset.id === entity.assetId)?.asset.name ?? entity.id);
 return ok(names);
}
