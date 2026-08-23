import type { ValidationError } from '../../core/errors/AppError';

export function zoneError(code: string, message: string): ValidationError {
	return { category: 'Validation', code: `zone.${code}`, message };
}
