import { err, ok, type Result } from '../../../core/result/Result';
import type { ReferenceError } from '../../../core/errors/AppError';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import type { Requirement } from '../../../domain/requirement/Requirement';
import type { Loaded } from '../../ports/versioning';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import { referenceError } from '../../errors';

/**
 * The load-or-fail preamble the requirement commands share: a failed read is surfaced as
 * itself, a missing requirement becomes this command family's ReferenceError, and only a
 * real `Loaded<Requirement>` proceeds.
 */
export async function loadRequirement(
	requirements: RequirementRepository,
	requirementId: RequirementId,
): Promise<Result<Loaded<Requirement>, ReferenceError | RepositoryError>> {
	const loaded = await requirements.getById(requirementId);
	if (!loaded.ok) {
		return loaded;
	}
	if (loaded.value === null) {
		return err(referenceError('requirement.not-found', `Requirement ${requirementId} not found.`));
	}
	return ok(loaded.value);
}
