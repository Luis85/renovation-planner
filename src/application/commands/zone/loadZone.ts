import { err, ok, type Result } from '../../../core/result/Result';
import type { ReferenceError } from '../../../core/errors/AppError';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { Zone } from '../../../domain/zone/Zone';
import type { Loaded } from '../../ports/versioning';
import type { ZoneRepository } from '../../ports/ZoneRepository';
import type { RepositoryError } from '../../ports/repositoryErrors';
import { referenceError } from '../../errors';

/**
 * The load-or-fail preamble both Zone commands share: a failed read is surfaced as
 * itself, a missing zone becomes this command family's ReferenceError, and only a real
 * `Loaded<Zone>` proceeds.
 */
export async function loadZone(
	zones: ZoneRepository,
	zoneId: ZoneId,
): Promise<Result<Loaded<Zone>, ReferenceError | RepositoryError>> {
	const found = await zones.getById(zoneId);
	if (!found.ok) {
		return found;
	}
	if (found.value === null) {
		return err(referenceError('zone.zone-not-found', `Zone ${zoneId} not found.`));
	}
	return ok(found.value);
}
