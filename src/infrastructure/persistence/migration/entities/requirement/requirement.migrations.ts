import { discriminatorMigration } from '../../discriminatorMigration';

/** Source rules are additive; old payloads retain their existing quantity and ownership facts. */
export const REQUIREMENT_MIGRATIONS = [1, 2].map(version => discriminatorMigration(version, version + 1));
