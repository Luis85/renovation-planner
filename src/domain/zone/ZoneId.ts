import { createEntityId } from '../../core/identity/generateId';
import type { EntityId } from '../../core/identity/EntityId';

export type ZoneId = EntityId<'zone'>;

export function createZoneId(): ZoneId {
	return createEntityId('zone');
}
