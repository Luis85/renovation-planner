import type { Vault, Workspace } from 'obsidian';
import type { CompositionRoot } from './composition-root';
import type { ProjectId } from '../domain/project/ProjectId';
import { readProjectWork, type ProjectWorkServices } from '../application/queries/schedule/ProjectWork';
import { guardCommand } from '../application/errors/guardAgainstThrowing';
import { disposeAll, subscribeAll, changedEntry } from '../application/events/subscriptions';
import { planningEditorServices } from './planningEditorServices';
import { VAULT_EXCEPTION_MAPPER } from './guardedServices';

export function projectWorkServices(root: CompositionRoot, vault: Vault, workspace: Workspace): ProjectWorkServices | undefined {
 const persistence = root.persistence;
 if (!persistence) return undefined;
 const services = planningEditorServices(root, vault, workspace);
 if (!services.renovation || !services.tradeCatalogue) return undefined;
 const read = guardCommand({ execute: (id: ProjectId) => readProjectWork(persistence, id) }, 'project.work-read-failed', root.logger, VAULT_EXCEPTION_MAPPER);
 return { read: id => read.execute(id), renovation: services.renovation, trades: services.tradeCatalogue,
  onChanged(listener) {
   return disposeAll([
    ...subscribeAll(root.eventBus, ['ProjectIndexRebuilt', 'PlanRenovationChanged', 'PlanCreated', 'ZoneCreated', 'ZoneDeleted', 'ZoneRenamed'], listener),
    ...subscribeAll(root.eventBus, ['ProjectIndexEntryChanged'], event => {
     if (['renovation-project', 'renovation-plan', 'renovation-zone'].includes(changedEntry(event).entityType ?? '')) listener();
    }),
   ]);
  },
 };
}
