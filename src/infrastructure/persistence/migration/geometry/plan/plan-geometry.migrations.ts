import type { Migration } from '../../MigrationRunner';

/**
 * Plan geometry sidecar migrations, oldest first. Empty at schema version 1.
 */
export const PLAN_GEOMETRY_MIGRATIONS: Migration[] = [{
	fromVersion: 1, toVersion: 2,
	migrate: input => typeof input === 'object' && input !== null ? { ...input, schemaVersion: 2 } : input,
}, {
	fromVersion: 2, toVersion: 3,
	migrate: input => typeof input === 'object' && input !== null ? { ...input, schemaVersion: 3 } : input,
}, {
	fromVersion: 3, toVersion: 4,
	migrate: input => typeof input === 'object' && input !== null ? { ...input, schemaVersion: 4 } : input,
}, {
	fromVersion: 4, toVersion: 5,
	migrate: input => typeof input === 'object' && input !== null ? { ...input, schemaVersion: 5 } : input,
}, {
	fromVersion: 5, toVersion: 6,
	migrate: input => typeof input === 'object' && input !== null ? { ...input, schemaVersion: 6 } : input,
}, {
	fromVersion: 6, toVersion: 7,
	migrate: input => typeof input === 'object' && input !== null ? { ...input, schemaVersion: 7 } : input,
}, {
	fromVersion: 7, toVersion: 8,
	migrate: input => typeof input === 'object' && input !== null ? { ...input, schemaVersion: 8 } : input,
}];
