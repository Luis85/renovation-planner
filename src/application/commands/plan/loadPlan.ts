import { err, ok, type Result } from '../../../core/result/Result';
import type { PersistenceError, ReferenceError } from '../../../core/errors/AppError';
import type { Plan } from '../../../domain/plan/Plan';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { Loaded } from '../../ports/versioning';
import type { PlanRepository } from '../../ports/PlanRepository';
import { referenceError } from '../../errors';

/**
 * The load-or-fail preamble every Plan command shares: a failed read is surfaced as
 * itself, a missing Plan becomes this command family's `ReferenceError`, and only a real
 * `Loaded<Plan>` proceeds.
 *
 * The Zone side has had `loadZone` since slice 3 for exactly this; the Plan side grew a
 * second command in slice 5 and immediately grew the same nine lines twice, which is what
 * `npm run analyze` reports as a clone group. The `Loaded` is returned whole rather than
 * just the entity, because the VERSION is the half the caller needs for its conditional
 * write — a helper that dropped it would send every caller back to the repository.
 */
export async function loadPlan(
	plans: PlanRepository,
	planId: PlanId,
): Promise<Result<Loaded<Plan>, ReferenceError | PersistenceError>> {
	const found = await plans.getById(planId);
	if (!found.ok) {
		return found;
	}
	if (found.value === null) {
		return err(referenceError('plan.plan-not-found', `Plan ${planId} not found.`));
	}
	return ok(found.value);
}
