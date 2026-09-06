import type { CompositionRoot } from './composition-root';
import { relocateEvidence } from '../infrastructure/obsidian/repositories/relocateEvidence';
import { notifyFault, notifyOperationFailure } from '../presentation/notices/notify';

/** One host listener calls this with the live root, including after a settings/root swap. */
export async function evidenceRenamed(root: CompositionRoot, oldPath: string, newPath: string): Promise<void> {
 if (!root.persistence) return;
 try {
  const result = await relocateEvidence({ ...root.persistence, events: root.eventBus }, oldPath, newPath);
  if (!result.ok) notifyOperationFailure(result.error);
 } catch (cause) { notifyFault(cause, root.logger, 'evidence.rename-failed'); }
}
