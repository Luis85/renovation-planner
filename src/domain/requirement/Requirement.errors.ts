import type { ValidationError } from '../../core/errors/AppError';

export function requirementError(code: string, message: string): ValidationError {
	return { category: 'Validation', code: `requirement.${code}`, message };
}
