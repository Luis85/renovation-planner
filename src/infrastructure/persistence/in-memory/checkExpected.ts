import type { ValidationError } from '../../../core/errors/AppError';
import { externalModification, revisionConflict, type Expected, type Loaded } from '../../../application/ports/versioning';

/**
 * The ONE comparison behind every in-memory mutating method — "every write is
 * conditional", and a second copy of the compare would be a second chance to get it
 * wrong. Two comparisons, really: revision first (another plugin writer), then the
 * observed token (a change no plugin made). Distinct codes, because the caller's
 * recovery differs.
 */
export function checkExpected(
	entity: string,
	id: string,
	current: Loaded<unknown> | undefined,
	expected: Expected,
): ValidationError | null {
	if (expected === 'absent') {
		return current === undefined ? null : revisionConflict(entity, id);
	}
	if (current === undefined || current.version.revision !== expected.revision) {
		return revisionConflict(entity, id);
	}
	if (current.version.observed !== expected.observed) {
		return externalModification(entity, id);
	}
	return null;
}
