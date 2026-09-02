import type { ValidationError } from '../../core/errors/AppError';

export function assetPriceError(code: string, message: string): ValidationError {
	return { category: 'Validation', code: `asset-price.${code}`, message };
}
