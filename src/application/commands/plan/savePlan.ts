import { ok, type Result } from '../../../core/result/Result';
import type { PersistenceError, ValidationError } from '../../../core/errors/AppError';
import type { DomainEvent, EventBus } from '../../../core/events/EventBus';
import type { Plan } from '../../../domain/plan/Plan';
import type { PlanEventPayload } from '../../../domain/plan/Plan.events';
import type { EntityVersion, Loaded } from '../../ports/versioning';
import type { PlanRepository } from '../../ports/PlanRepository';

/**
 * The write-and-announce tail every Plan command shares: save CONDITIONALLY on the version
 * the command's own read returned, surface a refusal as itself, and publish exactly one
 * event — on the success path only, because §32 publishes after a successful state change
 * and a failed write must announce nothing.
 *
 * The event is a FACTORY rather than a value, and the two Plan events happen to have
 * exactly that signature already (`planCalibrated`, `planBackgroundChanged` both take a
 * `PlanEventPayload`). That is what lets the payload be built from the SAVED entity here,
 * once: a caller that built its own would be reading the id and project off the entity it
 * passed in, which is the pre-write one.
 *
 * `expected` is `EntityVersion` and not `Expected`: every caller of this has just read the
 * Plan it is updating, so `'absent'` — the insert case — cannot arise, and accepting it
 * would offer a shape no caller means.
 */
export async function savePlan(
	plans: PlanRepository,
	events: EventBus,
	plan: Plan,
	expected: EntityVersion,
	announce: (payload: PlanEventPayload) => DomainEvent,
): Promise<Result<Loaded<Plan>, PersistenceError | ValidationError>> {
	const saved = await plans.save(plan, expected);
	if (!saved.ok) {
		return saved;
	}
	await events.publish(
		announce({ planId: saved.value.entity.id, projectId: saved.value.entity.projectId }),
	);
	return ok(saved.value);
}
