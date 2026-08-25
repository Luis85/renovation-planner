import { isErr, ok, type Result } from '../../../core/result/Result';
import type { EventBus } from '../../../core/events/EventBus';
import type { Money } from '../../../core/money/Money';
import { Project } from '../../../domain/project/Project';
import { createProjectId } from '../../../domain/project/ProjectId';
import type { ProjectStatus } from '../../../domain/project/ProjectStatus';
import { projectCreated } from '../../../domain/project/Project.events';
import type { Command } from '../Command';
import type { ProjectRepository } from '../../ports/ProjectRepository';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { Loaded } from '../../ports/versioning';

export interface CreateProjectInput {
	readonly name: string;
	readonly description?: string | null;
	readonly status?: ProjectStatus;
	readonly start?: Date | null;
	readonly targetCompletion?: Date | null;
	readonly budget?: Money | null;
	readonly contingency?: Money | null;
	readonly locationDescription?: string | null;
}

export type CreateProjectError = RepositoryError;

export class CreateProjectCommand
	implements
		Command<
			CreateProjectInput,
			Result<{ project: Loaded<Project> }, CreateProjectError>
		>
{
	constructor(
		private readonly projects: ProjectRepository,
		private readonly events: EventBus,
	) {}

	// The return type is ANNOTATED, not inferred, for the reason `SetPlanBackground` states
	// at length: inference produces a union of `Result`s — one arm per error type the body
	// returns — which is not the same type as one `Result` over a union of errors, and the
	// difference only shows up in a caller. This command had no production caller until the
	// sample-project seed became one, and `isErr` could not narrow the union it got.
	async execute(
		input: CreateProjectInput,
	): Promise<Result<{ project: Loaded<Project> }, CreateProjectError>> {
		const created = Project.create({ ...input, id: createProjectId() });
		if (isErr(created)) {
			return created;
		}
		// 'absent': a create must not overwrite whatever already holds this ID.
		const saved = await this.projects.save(created.value, 'absent');
		if (isErr(saved)) {
			return saved;
		}
		await this.events.publish(projectCreated({ projectId: saved.value.entity.id }));
		return ok({ project: saved.value });
	}
}
