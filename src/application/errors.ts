import type { CalculationError, ReferenceError } from '../core/errors/AppError';

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
