import type { ValidationError } from '../../../core/errors/AppError';
import { err } from '../../../core/result/Result';
import type { RefreshedHistory } from './with-state-refresh';

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
 * refused while `isStale()`; `undo` and `redo` pass — their inverse is the ledger's snapshot,
 * presented with the version the history recorded and refused by the repository on a
 * conflict, none of which reads the stale projection. A function rather than the store so a
 * node test drives both arms with a flag.
 */
export function withStaleGate(dispatcher: RefreshedHistory, isStale: () => boolean): RefreshedHistory {
	return {
		run: (command) => (isStale() ? Promise.resolve(err(staleWriteRefusal())) : dispatcher.run(command)),
		undo: () => dispatcher.undo(),
		redo: () => dispatcher.redo(),
	};
}
