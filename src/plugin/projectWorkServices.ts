import type { Vault, Workspace } from 'obsidian';
import type { CompositionRoot } from './composition-root';
import type { ProjectId } from '../domain/project/ProjectId';
import { readProjectWork, type ProjectWorkServices } from '../application/queries/schedule/ProjectWork';
import { guardQuery } from '../application/errors/guardAgainstThrowing';
import { disposeAll, subscribeAll, changedEntry } from '../application/events/subscriptions';
import { planningEditorServices } from './planningEditorServices';
import { VAULT_EXCEPTION_MAPPER } from './guardedServices';

export function projectWorkServices(root: CompositionRoot, vault: Vault, workspace: Workspace): ProjectWorkServices | undefined {
 const persistence = root.persistence;
 if (!persistence) return undefined;
 const services = planningEditorServices(root, vault, workspace);
 if (!services.renovation || !services.tradeCatalogue) return undefined;
 // A READ, so no ADR-0034 write gate (owner ruling 74): a pause drew "Saved · refresh needed" and no rows.
 const read = guardQuery({ execute: (id: ProjectId) => readProjectWork(persistence, id) }, 'project.work-read-failed', root.logger, VAULT_EXCEPTION_MAPPER);
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
