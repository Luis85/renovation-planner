import { isErr, ok, type Result } from '../../../core/result/Result';
import type { PersistenceError, ReferenceError, ValidationError } from '../../../core/errors/AppError';
import type { Command } from '../Command';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import type { EntityVersion } from '../../ports/versioning';
import { loadRequirement } from './loadRequirement';

export interface DeleteRequirementInput {
	readonly requirementId: RequirementId;
	/**
	 * Absent for a caller deleting from its own read; the delete resolutions' undo
	 * supplies the version its execute() produced, because pre-state revisions are
	 * already stale by the time the resolution returns.
	 */
	readonly expected?: EntityVersion;
}

/** The one plain removal in the requirement family — `remove-references` resolves through it. */
export class DeleteRequirementCommand
	implements
		Command<DeleteRequirementInput, Result<{ requirementId: RequirementId }, ReferenceError | ValidationError | PersistenceError>>
{
	constructor(private readonly requirements: RequirementRepository) {}

	async execute(
		input: DeleteRequirementInput,
	): Promise<Result<{ requirementId: RequirementId }, ReferenceError | ValidationError | PersistenceError>> {
		const loaded = await loadRequirement(this.requirements, input.requirementId);
		if (isErr(loaded)) return loaded;
		const deleted = await this.requirements.delete(
			input.requirementId,
			input.expected ?? loaded.value.version,
		);
		if (isErr(deleted)) return deleted;
		return ok({ requirementId: input.requirementId });
	}
}
