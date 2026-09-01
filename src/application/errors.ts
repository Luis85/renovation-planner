import type { CalculationError, PersistenceError, ReferenceError } from '../core/errors/AppError';

/**
 * The vault-side failure factory. It lives HERE rather than beside the note reader that
 * used to own it because `application/` may not import `infrastructure/`, and since the
 * listings skip-and-count a QUERY is now a raise site: `ListReassignmentTargets` refuses
 * when the zones it must offer are incomplete. One definition with two importers cannot
 * drift; two factories for one shape is the second derivation this project keeps deleting.
 *
 * `cause` is spread rather than assigned so an absent one leaves no key at all — a
 * `cause: undefined` reads as "there was a cause and it was nothing".
 */
export function persistenceError(code: string, message: string, cause?: unknown): PersistenceError {
	return { category: 'Persistence', code, message, ...(cause === undefined ? {} : { cause }) };
}

/**
 * Plain-data factory for the error category that shadows JavaScript's global of the same
 * name — `new ReferenceError(...)` would construct the built-in, never this shape.
 */
export function referenceError(code: string, message: string): ReferenceError {
	return { category: 'Reference', code, message };
}

/**
 * The failed-RECALCULATION error: the figures could not be produced (an input no longer
 * resolves, an engine stage refused), which is a calculation outcome rather than a command
 * refusal — raised on the path where the stale marker has already been persisted.
 */
export function calculationError(code: string, message: string, cause?: unknown): CalculationError {
	return { category: 'Calculation', code, message, cause };
}
