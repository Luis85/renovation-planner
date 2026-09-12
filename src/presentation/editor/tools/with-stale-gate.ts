import type { AppError, ValidationError } from '../../../core/errors/AppError';
import { err } from '../../../core/result/Result';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';
import type { RefreshedHistory } from './with-state-refresh';

/**
 * A draft task's refused write, the one way every draft task records it: the draft keeps the error,
 * and a conflict — a write boundary or a superseded undo — marks it stale and re-reads the floor,
 * so it is never retried against a baseline another write has replaced.
 */
export async function recordDraftFailure(draft: { error: AppError | null; conflict: boolean }, error: AppError, refresh: () => Promise<void>): Promise<void> {
	draft.error = error;
	draft.conflict = WRITE_BOUNDARY_CODES.some(code => error.code.endsWith(code)) || error.code === 'undo.superseded';
	if (draft.conflict) await refresh();
}

/** The one code a stale gate refuses with; the locale key of the same name is its copy. */
export const STALE_WRITE_REFUSED = 'editor.stale-write-refused';

/**
 * Validation on purpose: `affectsSaveState` classes it pre-write, so the indicator settles
 * neutral and the badge cannot move — nothing was written, and "Save error" over a refusal
 * would be the false badge four measurements of that predicate went to avoid. Minted here as
 * a literal the way `deleteZoneFlow.ts` mints its own; there is no `validationError` factory.
 */
export function staleWriteRefusal(): ValidationError {
	return {
		category: 'Validation',
		code: STALE_WRITE_REFUSED,
		message: 'The last read-back failed; new writes are refused until a re-read succeeds.',
	};
}

/**
 * The trust path's gate (design spec §2.2), one decorator on the one dispatcher. `run` is
 * refused while `isStale()`. Spatial-only stale history can use versioned ledger snapshots;
 * `unsafeHistory()` separately refuses Undo/Redo after a planning read failure or unrecovered
 * operation. Both predicates are supplied by the owning runtime, so the legacy spatial-only
 * callers retain their existing version-checked history behavior.
 */
export function withStaleGate(dispatcher: RefreshedHistory, isStale: () => boolean, unsafeHistory: () => boolean = () => false): RefreshedHistory {
	return {
		run: (command) => (isStale() ? Promise.resolve(err(staleWriteRefusal())) : dispatcher.run(command)),
		undo: () => unsafeHistory() ? Promise.resolve(err(staleWriteRefusal())) : dispatcher.undo(),
		redo: () => unsafeHistory() ? Promise.resolve(err(staleWriteRefusal())) : dispatcher.redo(),
	};
}
