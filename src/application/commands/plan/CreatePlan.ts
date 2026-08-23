import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { PersistenceError, ReferenceError, ValidationError } from '../../../core/errors/AppError';
import type { EventBus } from '../../../core/events/EventBus';
import type { ProjectId } from '../../../domain/project/ProjectId';
import { Plan } from '../../../domain/plan/Plan';
import { createPlanId } from '../../../domain/plan/PlanId';
import type { PlanBackgroundRef } from '../../../domain/plan/PlanBackgroundRef';
import { planCreated } from '../../../domain/plan/Plan.events';
import { referenceError } from '../../errors';
import type { Command } from '../Command';
import type { PlanRepository } from '../../ports/PlanRepository';
import type { ProjectRepository } from '../../ports/ProjectRepository';
import type { Loaded } from '../../ports/versioning';

export interface CreatePlanInput {
	readonly projectId: ProjectId;
	readonly name: string;
	readonly background?: PlanBackgroundRef | null;
	readonly layers?: readonly string[];
}

export class CreatePlanCommand
	implements
		Command<
			CreatePlanInput,
			Result<{ plan: Loaded<Plan> }, ValidationError | ReferenceError | PersistenceError>
		>
{
	constructor(
		private readonly plans: PlanRepository,
		private readonly projects: ProjectRepository,
		private readonly events: EventBus,
	) {}

	async execute(input: CreatePlanInput) {
		const found = await this.projects.getById(input.projectId);
		if (isErr(found)) {
			return found;
		}
		if (found.value === null) {
			return err(referenceError('plan.project-not-found', `Project ${input.projectId} not found.`));
		}
		const created = Plan.create({ ...input, id: createPlanId() });
		if (isErr(created)) {
			return created;
		}
		const saved = await this.plans.save(created.value, 'absent');
		if (isErr(saved)) {
			return saved;
		}
		await this.events.publish(
			planCreated({ planId: saved.value.entity.id, projectId: saved.value.entity.projectId }),
		);
		return ok({ plan: saved.value });
	}
}
