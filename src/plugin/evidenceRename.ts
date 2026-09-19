import type { CompositionRoot } from './composition-root';
import { relocateEvidence } from '../infrastructure/obsidian/repositories/relocateEvidence';
import { notifyFault, notifyOperationFailure } from '../presentation/notices/notify';
import { leftWritesBehind, type UncompensatedWrite } from '../application/commands/DispatchOutcome';
import { activeWriteIncidentRegistry } from '../application/incidents/WriteIncidentRegistry';
import type { AppError } from '../core/errors/AppError';

/**
 * One host listener calls this with the live root, including after a settings/root swap.
 *
 * **Its own ad-hoc boundary, and that is why the incident is raised HERE.** ADR-0034 names
 * this listener as one of the three paths outside `guardCommand`, so the stamp
 * `relocateEvidence` now raises would reach nothing if this function did not record it — the
 * exact gap the guarded chokepoint closes everywhere else. Recording is spelled the same way
 * `guardCommand` spells it, against the same module accessor, so the two doors cannot answer
 * about different registries.
 *
 * **Not gated, unlike a guarded command.** An open incident refuses every guarded COMMAND;
 * this listener is not one, so it still runs while an incident is open. That is existing
 * behaviour ADR-0034 records rather than changes, and it is stated here so the next reader
 * does not infer a gate from the presence of a raise.
 */
export async function evidenceRenamed(root: CompositionRoot, oldPath: string, newPath: string): Promise<void> {
 if (!root.persistence) return;
 try {
  const result = await relocateEvidence({ ...root.persistence, events: root.eventBus }, oldPath, newPath);
  if (!result.ok) {
   // `void`, not awaited: `record` resolves rather than rejects for every fault (its own
   // docblock), the in-memory list is appended to before the durable write is attempted, and
   // the user's sentence below must not wait on a file write.
   if (leftWritesBehind(result.error)) void activeWriteIncidentRegistry()?.record(result.error as AppError & UncompensatedWrite);
   notifyOperationFailure(result.error);
  }
 } catch (cause) { notifyFault(cause, root.logger, 'evidence.rename-failed'); }
}
