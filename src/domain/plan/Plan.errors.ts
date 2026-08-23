import type { ValidationError } from '../../core/errors/AppError';

export function planError(code: string, message: string): ValidationError {
	return { category: 'Validation', code: `plan.${code}`, message };
}
