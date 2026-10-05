import type { CompositionRoot } from './composition-root';
import { relocateEvidence } from '../infrastructure/obsidian/repositories/relocateEvidence';
import { notifyFault, notifyOperationFailure } from '../presentation/notices/notify';
import { activeWriteIncidentRegistry } from '../application/incidents/WriteIncidentRegistry';

/**
 * One host listener calls this with the live root, including after a settings/root swap.
 *
 * **Its own ad-hoc boundary, and it records NOTHING itself.** ADR-0034 names this listener as
 * one of the three paths outside `guardCommand`, and it used to record `relocateEvidence`'s stamp
 * here for that reason. Since owner ruling 13 `markUncompensated` records every stamp where it is
 * made, through the same module accessor, so a record here would count this one twice.
 *
 * **Not gated, unlike a guarded command.** An open incident refuses every guarded COMMAND;
 * this listener is not one, so it still runs while an incident is open. That is existing
 * behaviour ADR-0034 records rather than changes, and it is stated here so the next reader
 * does not infer a gate from the presence of a raise.
 *
 * **Held for its whole relocation** (owner ruling 16): it is outside both doors
 * `WriteIncidentRegistry.hold()` names and its stamp reads the holder when it is made, late in the
 * relocation, so the registry `activeWriteIncidentRegistry()` answers at its start is held
 * synchronously until the `finally` — a session disposing while a rename is in flight keeps the
 * record for its stamp. The `finally` is what releases it on a throw as well as on a refusal.
 */
export async function evidenceRenamed(root: CompositionRoot, oldPath: string, newPath: string): Promise<void> {
 if (!root.persistence) return;
 const release = activeWriteIncidentRegistry()?.hold();
 try {
  const result = await relocateEvidence({ ...root.persistence, ledger: root.persistence.vaultDeps.ledger, events: root.eventBus }, oldPath, newPath);
  if (!result.ok) notifyOperationFailure(result.error);
 } catch (cause) { notifyFault(cause, root.logger, 'evidence.rename-failed'); } finally { release?.(); }
}
