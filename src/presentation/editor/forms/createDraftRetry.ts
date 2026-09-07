import type { Logger } from '../../../application/ports/Logger';
import { notifyFault } from '../../notices/notify';

/** A read-only draft retry reports unexpected query failures only while its leaf is alive. */
export function createDraftRetry(refresh: () => Promise<void>, isAlive: () => boolean, logger: Logger): () => Promise<void> {
 return async () => {
  try { await refresh(); }
  catch (cause) { if (isAlive()) notifyFault(cause, logger, 'editor.refresh.failed'); }
 };
}
