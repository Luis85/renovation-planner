import type { ReferenceError, ValidationError } from '../../core/errors/AppError';
import type { AssetId } from './AssetId';

export function assetError(code: string, message: string): ValidationError {
	return { category: 'Validation', code: `asset.${code}`, message };
}

/**
 * "There is no such asset" — one spelling, because two commands now ask it and a refusal
 * spelled out longhand at each door is how the count of the places it disagrees becomes
 * unknowable. `Reference` rather than `Validation`: nothing about the input is wrong, the
 * thing it names is not there.
 *
 * Deliberately NOT collapsed with a failed READ at either call site. A vault that could not
 * be read reported as an asset that is gone is the relabel this repository has already paid
 * for twice, and it tells a user their catalogue entry no longer exists about a note whose
 * bytes are sitting on disk.
 */
export function assetNotFound(assetId: AssetId): ReferenceError {
	return { category: 'Reference', code: 'asset.not-found', message: `Asset ${assetId} not found.` };
}
