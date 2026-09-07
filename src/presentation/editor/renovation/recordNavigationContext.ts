import type { Renovation } from '../../../domain/renovation/Renovation';
import type { PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';
import { spatialContexts, type SharedSpatialContext, type SpatialLink } from '../../../domain/renovation/SharedLinks';
import type { RenovationMode } from './renovationSession';
import { inRenovationScope } from './renovationSummary';

export interface NavigationRecords { renovation: Renovation; materials: PlanningBaseline['materials'] }
function recordContext(records: NavigationRecords, id: string): SharedSpatialContext | undefined {
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

function linkedEvidenceContext(records: NavigationRecords, id: string, mode: RenovationMode | undefined, roomId: string, current: SpatialLink | null): SpatialLink | null {
 const type = mode === 'documents' ? 'document' : mode === 'photos' ? 'photo' : mode === 'notes' ? 'note' : null;
 if (!type) return null;
 const linked = records.renovation.depth?.evidence.filter(item => item.recordId === id && item.type === type) ?? [];
 if (!linked.length) return null;
 if (current && linked.every(item => inRenovationScope(item, current.roomId, current.targetId))) return current;
 const contexts = linked.flatMap(item => spatialContexts(item));
 const context = contexts.find(item => item.roomId === roomId) ?? contexts[0];
 return linked.length === 1 ? context : { roomId: context.roomId, targetId: context.roomId };
}

/** An explicit record link must reveal its destination without changing canonical ownership. */
export function recordNavigationContext(records: NavigationRecords, id: string, requestedRoom: string, current: SpatialLink | null, mode?: RenovationMode): SpatialLink | null {
 const linked = linkedEvidenceContext(records, id, mode, requestedRoom, current);
 if (linked) return linked;
 const record = recordContext(records, id);
 if (!record) return null;
 if (current && inRenovationScope(record, current.roomId, current.targetId)) return current;
 const contexts = spatialContexts(record);
 return contexts.find(item => item.roomId === requestedRoom) ?? contexts[0];
}
