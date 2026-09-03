import { isErr, ok, type Result } from '../../../core/result/Result';
import type { ReferenceError } from '../../../core/errors/AppError';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { Command } from '../Command';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import type { EntityVersion } from '../../ports/versioning';
import type { EventBus } from '../../../core/events/EventBus';
import { requirementDeleted } from '../../../domain/requirement/Requirement.events';
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
		Command<DeleteRequirementInput, Result<{ requirementId: RequirementId }, ReferenceError | RepositoryError>>
{
	constructor(
		private readonly requirements: RequirementRepository,
		private readonly events: EventBus,
	) {}

	async execute(
		input: DeleteRequirementInput,
	): Promise<Result<{ requirementId: RequirementId }, ReferenceError | RepositoryError>> {
		const loaded = await loadRequirement(this.requirements, input.requirementId);
		if (isErr(loaded)) return loaded;
		const deleted = await this.requirements.delete(
			input.requirementId,
			input.expected ?? loaded.value.version,
		);
		if (isErr(deleted)) return deleted;
		// AFTER the write, per SDD §32 — an event is a statement that something happened.
		// The project comes off the entity this command has already loaded, so nothing is
		// re-read to supply it.
		await this.events.publish(
			requirementDeleted({
				requirementId: input.requirementId,
				projectId: loaded.value.entity.projectId,
			}),
		);
		return ok({ requirementId: input.requirementId });
	}
}
