import { discriminatorMigration } from '../../discriminatorMigration';

/** Read-only upgrades retain legacy defaults and never invent optional renovation facts. */
export const PLAN_MIGRATIONS = [1, 2, 3, 4, 5, 6].map(version => discriminatorMigration(version, version + 1));
