import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { ReferenceError } from '../../../core/errors/AppError';
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
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { Loaded } from '../../ports/versioning';

export interface CreatePlanInput {
	readonly projectId: ProjectId;
	readonly name: string;
	readonly background?: PlanBackgroundRef | null;
	readonly layers?: readonly string[];
}

export type CreatePlanError = ReferenceError | RepositoryError;

export class CreatePlanCommand
	implements
		Command<
			CreatePlanInput,
			Result<{ plan: Loaded<Plan> }, CreatePlanError>
		>
{
	constructor(
		private readonly plans: PlanRepository,
		private readonly projects: ProjectRepository,
		private readonly events: EventBus,
	) {}

	// The return type is ANNOTATED, not inferred, for the reason `SetPlanBackground` states
	// at length: inference produces a union of `Result`s — one arm per error type the body
	// returns — which is not the same type as one `Result` over a union of errors, and the
	// difference only shows up in a caller. This command had no production caller until the
	// sample-project seed became one, and `isErr` could not narrow the union it got.
	async execute(
		input: CreatePlanInput,
	): Promise<Result<{ plan: Loaded<Plan> }, CreatePlanError>> {
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
