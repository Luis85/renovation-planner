import type { Migration } from '../../MigrationRunner';

/** Read-only upgrade: absent appearance keeps the legacy full image, opacity 1 and origin. */
export const PLAN_MIGRATIONS: Migration[] = [{
	fromVersion: 1, toVersion: 2,
	migrate: input => typeof input === 'object' && input !== null
		? { ...input, 'schema-version': 2 } : input,
}];
