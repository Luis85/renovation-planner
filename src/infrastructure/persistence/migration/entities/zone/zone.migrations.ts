import type { Migration } from '../../MigrationRunner';
import { discriminatorMigration } from '../../discriminatorMigration';

/**
 * Zone frontmatter migrations, oldest first. 1 → 2 advances the discriminator only: a v1 note
 * is an unlocked zone, and no read rewrites it (ADR-0027).
 */
export const ZONE_MIGRATIONS: Migration[] = [discriminatorMigration(1, 2)];
