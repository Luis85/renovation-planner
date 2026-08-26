import { createEntityId } from '../../core/identity/generateId';
import type { EntityId } from '../../core/identity/EntityId';

export type RequirementId = EntityId<'requirement'>;

export function createRequirementId(): RequirementId {
	return createEntityId('requirement');
}
