import type { ValidationError } from '../../core/errors/AppError';

/**
 * Project's error-code catalog (SDD §64: no category enumerates its codes centrally;
 * the catalog lives beside the module that raises it). Codes are namespaced `project.*`
 * so a log line or a surfaced error names its owner.
 */
export function projectError(code: string, message: string): ValidationError {
	return { category: 'Validation', code: `project.${code}`, message };
}
