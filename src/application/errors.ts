import type { ReferenceError } from '../core/errors/AppError';

/**
 * Plain-data factory for the error category that shadows JavaScript's global of the same
 * name — `new ReferenceError(...)` would construct the built-in, never this shape.
 */
export function referenceError(code: string, message: string): ReferenceError {
	return { category: 'Reference', code, message };
}
