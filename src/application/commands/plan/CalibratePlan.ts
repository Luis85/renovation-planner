import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type {
	CalculationError,
	PersistenceError,
	ReferenceError,
	ValidationError,
} from '../../../core/errors/AppError';
import type { Point } from '../../../core/geometry/Point';
import type { EventBus } from '../../../core/events/EventBus';
import type { PlanId } from '../../../domain/plan/PlanId';
import { planCalibrated } from '../../../domain/plan/Plan.events';
import type { Plan } from '../../../domain/plan/Plan';
import { referenceError } from '../../errors';
import type { Command } from '../Command';
import type { PlanRepository } from '../../ports/PlanRepository';
import type { Loaded } from '../../ports/versioning';

export interface CalibratePlanInput {
	readonly planId: PlanId;
	/** Measured in the background's pixel space (SDD §25). */
	readonly pointA: Point;
	readonly pointB: Point;
	/** World units (mm) — like every length here (ADR-009). */
	readonly knownDistance: number;
}

/**
 * Plain, non-undoable for this slice; slice 7 upgrades it to an `UndoableCommand` once
 * slice 6's undo/redo exists.
 */
export class CalibratePlanCommand
	implements
		Command<
			CalibratePlanInput,
			Result<
				{ plan: Loaded<Plan> },
				ReferenceError | ValidationError | CalculationError | PersistenceError
			>
		>
{
	constructor(
		private readonly plans: PlanRepository,
		private readonly events: EventBus,
	) {}

	async execute(input: CalibratePlanInput) {
		const found = await this.plans.getById(input.planId);
		if (isErr(found)) {
			return found;
		}
		if (found.value === null) {
			return err(referenceError('plan.plan-not-found', `Plan ${input.planId} not found.`));
		}
		const loaded = found.value;
		const plan: Plan = loaded.entity;
		const updated = plan.calibrate({
			pointA: input.pointA,
			pointB: input.pointB,
			knownDistance: input.knownDistance,
		});
		if (isErr(updated)) {
			return updated;
		}
		// Conditional on the version THIS read returned — see "Writes are conditional".
		const saved = await this.plans.save(updated.value, loaded.version);
		if (isErr(saved)) {
			return saved;
		}
		await this.events.publish(
			planCalibrated({ planId: saved.value.entity.id, projectId: saved.value.entity.projectId }),
		);
		return ok({ plan: saved.value });
	}
}
