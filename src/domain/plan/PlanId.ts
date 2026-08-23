import { createEntityId } from '../../core/identity/generateId';
import type { EntityId } from '../../core/identity/EntityId';

export type PlanId = EntityId<'plan'>;

export function createPlanId(): PlanId {
	return createEntityId('plan');
}
