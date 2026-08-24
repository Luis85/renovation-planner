import type { Migration } from '../MigrationRunner';

/**
 * Project frontmatter migrations, oldest first. Empty at schema version 1 — no real
 * prior version ever shipped. The registry is composed into the runner so the first
 * real migration lands here rather than in a call site.
 */
export const PROJECT_MIGRATIONS: Migration[] = [];
