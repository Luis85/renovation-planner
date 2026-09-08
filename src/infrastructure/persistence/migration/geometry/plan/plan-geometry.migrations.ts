import type { Migration } from '../../MigrationRunner';

/**
 * Plan geometry sidecar migrations, oldest first. Empty at schema version 1.
 */
export const PLAN_GEOMETRY_MIGRATIONS: Migration[] = [{
	fromVersion: 1, toVersion: 2,
	migrate: input => typeof input === 'object' && input !== null ? { ...input, schemaVersion: 2 } : input,
}];
