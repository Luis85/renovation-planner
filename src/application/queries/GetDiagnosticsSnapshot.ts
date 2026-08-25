import type { DiagnosticsLedger, RuntimeVersions, ValidationIssue } from '../ports/diagnostics';
import type { Query } from './Query';

/**
 * The structured, CONTENT-FREE technical snapshot (SDD §68): versions, schema
 * versions, migration state, and validation issues — and nothing else. No zone names,
 * no note bodies, no frontmatter values beyond version numbers, no content-bearing
 * paths; entities appear only as opaque ids. A user may export or transmit a snapshot
 * themselves; the plugin never does (SDD §86).
 *
 * The query cannot fail: every source answers from memory, so its public contract is a
 * plain `Promise<DiagnosticsSnapshot>` rather than a `Result` — there is no failure
 * mode to type.
 */
export interface DiagnosticsSnapshot {
	pluginVersion: string;
	obsidianVersion: string;
	/** Entity kind -> current schema version this build writes. */
	schemaVersions: Record<string, number>;
	migrationState: {
		pending: string[];
		lastApplied: string | null;
	};
	validationIssues: Array<{
		entityType: string;
		entityId: string;
		issue: string;
	}>;
}

/** Where the snapshot's facts come from — all answered from memory, none from a vault read. */
export interface DiagnosticsSources {
	readonly versions: RuntimeVersions;
	latestSchemaVersions(): Readonly<Record<string, number>>;
	lastAppliedMigration(): string | null;
	readonly ledger: DiagnosticsLedger;
}

export class GetDiagnosticsSnapshotQuery
	implements Query<void, DiagnosticsSnapshot>
{
	constructor(private readonly sources: DiagnosticsSources) {}

	execute(): Promise<DiagnosticsSnapshot> {
		return Promise.resolve({
			pluginVersion: this.sources.versions.pluginVersion,
			obsidianVersion: this.sources.versions.obsidianVersion,
			schemaVersions: { ...this.sources.latestSchemaVersions() },
			migrationState: {
				// Migrations run inline during each note's load, so nothing is ever waiting:
				// "pending" is empty by construction today, and the field exists so a future
				// batched migration runner has somewhere to report without reshaping callers.
				pending: [],
				lastApplied: this.sources.lastAppliedMigration(),
			},
			validationIssues: this.sources.ledger.issues().map((issue: ValidationIssue) => ({ ...issue })),
		});
	}
}
