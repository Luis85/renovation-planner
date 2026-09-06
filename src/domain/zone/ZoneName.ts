import type { ValidationError } from '../../core/errors/AppError';
import { err, ok, type Result } from '../../core/result/Result';
import { zoneError } from './Zone.errors';

/** The existing creation rule, shared by creation, renaming and form validation. */
export function zoneName(text: string): Result<string, ValidationError> {
	const name = text.trim();
	return name ? ok(name) : err(zoneError('empty-name', 'A zone needs a non-empty name.'));
}
