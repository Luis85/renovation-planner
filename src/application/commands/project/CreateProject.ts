import { isErr, ok, type Result } from '../../../core/result/Result';
import type { PersistenceError, ValidationError } from '../../../core/errors/AppError';
import type { EventBus } from '../../../core/events/EventBus';
import type { Money } from '../../../core/money/Money';
import { Project } from '../../../domain/project/Project';
import { createProjectId } from '../../../domain/project/ProjectId';
import type { ProjectStatus } from '../../../domain/project/ProjectStatus';
import { projectCreated } from '../../../domain/project/Project.events';
import type { Command } from '../Command';
import type { ProjectRepository } from '../../ports/ProjectRepository';
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

export class CreateProjectCommand
	implements
		Command<
			CreateProjectInput,
			Result<{ project: Loaded<Project> }, ValidationError | PersistenceError>
		>
{
	constructor(
		private readonly projects: ProjectRepository,
		private readonly events: EventBus,
	) {}

	async execute(input: CreateProjectInput) {
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
