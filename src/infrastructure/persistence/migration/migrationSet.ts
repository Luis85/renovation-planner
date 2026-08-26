import type { DiagnosticEntityKind } from '../../../application/ports/diagnostics';
import type { Migration } from './MigrationRunner';
import { ASSET_MIGRATIONS } from './entities/asset/asset.migrations';
import { PLAN_MIGRATIONS } from './entities/plan/plan.migrations';
import { REQUIREMENT_MIGRATIONS } from './entities/requirement/requirement.migrations';
import { ZONE_MIGRATIONS } from './entities/zone/zone.migrations';
import { PLAN_GEOMETRY_MIGRATIONS } from './geometry/plan/plan-geometry.migrations';
import { PROJECT_MIGRATIONS } from './project/project.migrations';

/**
 * Every entity shape's migration table, keyed as the runner reads it — and the ONE list
 * `GetDiagnosticsSnapshot`'s `schemaVersions` derives from, so a new entity appears in
 * diagnostics because it was registered here rather than because a second list was
 * remembered. `MigrationRunner.latestVersions` derives each version from the steps
 * registered for its kind, which is what makes that sentence checkable rather than merely
 * asserted: `tests/plugin/persistence-wiring.test.ts` asks the REAL composition for its
 * snapshot, so a seventh kind added here and nowhere else turns that assertion red.
 *
 * It lives beside the migrations rather than inside the composition root, and the reason is
 * a FAKE that was thinner than the real thing: `tests/helpers/vault.ts` built its own runner
 * from its own four-kind copy of this table while the plugin registered six, so a suite
 * driving the repositories was migrating against a different schema world than production.
 * One table with two importers cannot drift; two tables had nothing to notice them drifting.
 *
 * Typed by `DiagnosticEntityKind` — a Record keyed by the union, so a kind added to that
 * union without a table here (and vice versa) is a compile error rather than an entity the
 * diagnostics vocabulary knows and the runner does not.
 */
export const MIGRATION_SET: Readonly<Record<DiagnosticEntityKind, readonly Migration[]>> = {
	project: PROJECT_MIGRATIONS,
	plan: PLAN_MIGRATIONS,
	zone: ZONE_MIGRATIONS,
	asset: ASSET_MIGRATIONS,
	requirement: REQUIREMENT_MIGRATIONS,
	'plan-geometry': PLAN_GEOMETRY_MIGRATIONS,
};
