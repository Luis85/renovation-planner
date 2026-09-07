import type { AppError } from '../../../core/errors/AppError';
import { err, ok, type Result } from '../../../core/result/Result';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { PlanId } from '../../../domain/plan/PlanId';
import { EMPTY_RENOVATION, blockingWork, orderedWork, type WorkPackage } from '../../../domain/renovation/Renovation';
import type { Project } from '../../../domain/project/Project';
import type { ProjectRepository } from '../../ports/ProjectRepository';
import type { PlanRepository } from '../../ports/PlanRepository';
import type { ZoneRepository } from '../../ports/ZoneRepository';
import type { Trade } from '../../../domain/trade/Trade';
import type { NamedCatalogueServices } from '../../commands/catalogue/NamedCatalogueServices';
import type { RenovationServices } from '../../commands/renovation/RenovationCommand';

export interface ProjectWorkRow {
 readonly planId: PlanId;
 readonly floor: string;
 readonly rooms: readonly { readonly id: string; readonly name: string | null }[];
 readonly work: WorkPackage;
 readonly blocking: readonly WorkPackage[];
}
export interface ProjectWorkRead {
 readonly project: Project;
 readonly rows: readonly ProjectWorkRow[];
 readonly rooms: readonly { readonly id: string; readonly name: string }[];
 readonly unreadablePlans: number;
 readonly roomsIncomplete: boolean;
}
export interface ProjectWorkServices {
 read(projectId: ProjectId): Promise<Result<ProjectWorkRead, AppError>>;
 readonly renovation: RenovationServices;
 readonly trades: NamedCatalogueServices<Trade>;
 onChanged(listener: () => void): () => void;
}
export interface ProjectWorkDeps {
 readonly projects: ProjectRepository;
 readonly plans: PlanRepository;
 readonly zones: ZoneRepository;
}
/** Each Plan owns its Work register. Shared outcomes never duplicate a Work row. */
export async function readProjectWork(deps: ProjectWorkDeps, projectId: ProjectId): Promise<Result<ProjectWorkRead, AppError>> {
 const project = await deps.projects.getById(projectId);
 if (!project.ok) return project;
 if (!project.value) return err({ category: 'Reference', code: 'project.not-found', message: 'The project no longer exists.' });
 const [plans, zones] = await Promise.all([deps.plans.listByProject(projectId), deps.zones.listByProject(projectId)]);
 if (!plans.ok) return plans;
 const names = new Map(zones.ok ? zones.value.loaded.map(item => [item.entity.id as string, item.entity.name]) : []);
 const rows: ProjectWorkRow[] = [];
 for (const loaded of plans.value.loaded) {
  const plan = loaded.entity;
  const value = plan.renovation ?? EMPTY_RENOVATION;
  const subjects = new Map(value.subjects.map(item => [item.id, item]));
  for (const work of orderedWork(value)) {
   const roomIds = new Set([work.roomId, ...work.links?.map(link => link.roomId) ?? []]);
   for (const id of work.outcomes) { const subject = subjects.get(id); if (subject) roomIds.add(subject.roomId); }
   rows.push({ planId: plan.id, floor: plan.name, work, blocking: blockingWork(value, work),
    rooms: Array.from(roomIds, id => ({ id, name: names.get(id) ?? null })) });
  }
 }
 return ok({ project: project.value.entity, rows, rooms: zones.ok ? zones.value.loaded.filter(item => item.entity.zoneType === 'Room').map(item => ({ id: item.entity.id, name: item.entity.name })) : [], unreadablePlans: plans.value.refused, roomsIncomplete: !zones.ok || zones.value.refused > 0 });
}
