import type { Migration } from '../../MigrationRunner';

/**
 * Schema version 1 is the first; nothing to migrate from. Later epics adding
 * `work-package`/`asset` origin kinds are ADDITIVE to the discriminated union, not
 * breaking — which is why no migration category exists for them in advance.
 */
export const REQUIREMENT_MIGRATIONS: Migration[] = [];
