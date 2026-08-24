import type { Migration } from '../../MigrationRunner';

/**
 * Plan frontmatter migrations, oldest first. Empty at schema version 1.
 */
export const PLAN_MIGRATIONS: Migration[] = [];
