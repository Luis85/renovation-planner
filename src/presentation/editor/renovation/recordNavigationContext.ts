import type { Renovation } from '../../../domain/renovation/Renovation';
import type { PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';
import { spatialContexts, type SharedSpatialContext, type SpatialLink } from '../../../domain/renovation/SharedLinks';
import { inRenovationScope } from './renovationSummary';

interface Records { renovation: Renovation; materials: PlanningBaseline['materials'] }
function recordContext(records: Records, id: string): SharedSpatialContext | undefined {
 const { renovation, materials } = records;
 const subjectId = renovation.decisions.find(item => item.id === id)?.subjectId ?? id;
 const record = renovation.subjects.find(item => item.id === subjectId)
  ?? renovation.work.find(item => item.id === id)
  ?? renovation.depth?.costs.find(item => item.id === id)
  ?? renovation.depth?.evidence.find(item => item.id === id);
 if (record) return record;
 const materialId = id.startsWith('estimate:') ? id.slice('estimate:'.length) : id;
 const material = materials.find(item => item.entity.id === materialId)?.entity;
 if (!material) return undefined;
 return { roomId: material.origin.zoneId, targetId: material.source?.targetId ?? material.origin.zoneId };
}

/** An explicit record link must reveal its destination without changing canonical ownership. */
export function recordNavigationContext(records: Records, id: string, requestedRoom: string, current: SpatialLink | null): SpatialLink | null {
 const record = recordContext(records, id);
 if (!record) return null;
 if (current && inRenovationScope(record, current.roomId, current.targetId)) return current;
 const contexts = spatialContexts(record);
 return contexts.find(item => item.roomId === requestedRoom) ?? contexts[0];
}
