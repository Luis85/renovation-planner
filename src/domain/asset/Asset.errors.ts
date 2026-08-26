import type { ValidationError } from '../../core/errors/AppError';

export function assetError(code: string, message: string): ValidationError {
	return { category: 'Validation', code: `asset.${code}`, message };
}
