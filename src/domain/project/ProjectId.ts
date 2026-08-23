import { createEntityId } from '../../core/identity/generateId';
import type { EntityId } from '../../core/identity/EntityId';

/**
 * Branded per SDD §82: `<prefix>-<ULID>`, prefix lowercase singular, matching the
 * `zone-01JABC…` example.
 */
export type ProjectId = EntityId<'project'>;

export function createProjectId(): ProjectId {
	return createEntityId('project');
}
