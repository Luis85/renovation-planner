import type { Migration } from '../../MigrationRunner';

/**
 * Plan geometry sidecar migrations, oldest first. Empty at schema version 1.
 */
export const PLAN_GEOMETRY_MIGRATIONS: Migration[] = [];
