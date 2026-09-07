import type { Migration } from './MigrationRunner';

/** Advance only the owned discriminator; keep absent facts absent and invalid inputs invalid. */
export function discriminatorMigration(fromVersion: number, toVersion: number): Migration {
 return { fromVersion, toVersion, migrate: input => typeof input === 'object' && input !== null ? { ...input, 'schema-version': toVersion } : input };
}
