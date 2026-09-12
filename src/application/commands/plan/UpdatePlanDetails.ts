import { isErr, ok, type Result } from '../../../core/result/Result';
import type { ReferenceError, ValidationError } from '../../../core/errors/AppError';
import type { EventBus } from '../../../core/events/EventBus';
import type { Plan, PlanDetails } from '../../../domain/plan/Plan';
import type { PlanId } from '../../../domain/plan/PlanId';
import { planDetailsChanged } from '../../../domain/plan/Plan.events';
import type { Command } from '../Command';
import type { PlanRepository } from '../../ports/PlanRepository';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { Loaded } from '../../ports/versioning';
import { loadPlan } from './loadPlan';
import { savePlan } from './savePlan';

export interface UpdatePlanDetailsInput extends PlanDetails {
	readonly planId: PlanId;
}

export type UpdatePlanDetailsError = ReferenceError | RepositoryError | ValidationError;

/**
 * The one write for an existing plan's LABEL fields — kind and sibling order (ADR-0029). Loads,
 * applies `withDetails` (the domain's own validation, so a plan is updated under the rules it was
 * constructed under), and saves on the version it read, exactly as `SetPlanBackgroundCommand`
 * does. Frontmatter only: no sidecar, no geometry lock.
 *
 * A reorder is several of these in sequence (`usePlanReorder`), deliberately NOT one transaction:
 * two notes cannot be written atomically here, and a half-applied swap is a visible order the
 * user can redo, not data loss.
 */
export class UpdatePlanDetailsCommand implements Command<UpdatePlanDetailsInput, Result<{ plan: Loaded<Plan> }, UpdatePlanDetailsError>> {
	constructor(
		private readonly plans: PlanRepository,
		private readonly events: EventBus,
	) {}

	// Annotated rather than inferred, for the reason `SetPlanBackground` states: inference
	// produces a union of `Result`s a caller cannot narrow with `isErr`.
	async execute(input: UpdatePlanDetailsInput): Promise<Result<{ plan: Loaded<Plan> }, UpdatePlanDetailsError>> {
		const found = await loadPlan(this.plans, input.planId);
		if (isErr(found)) return found;
		const updated = found.value.entity.withDetails({ kind: input.kind, order: input.order });
		if (isErr(updated)) return updated;
		const saved = await savePlan(this.plans, this.events, updated.value, found.value.version, planDetailsChanged);
		if (isErr(saved)) return saved;
		return ok({ plan: saved.value });
	}
}
