import type { DiagnosticsLedger, RuntimeVersions, ValidationIssue } from '../ports/diagnostics';
import type { WriteIncidentReport } from '../incidents/WriteIncidentRegistry';
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
	/**
	 * The open write incidents (ADR-0034) and the plugin-local file holding them.
	 *
	 * **Load-bearing rather than decoration.** Nothing in the plugin retires an incident — not
	 * a control, not a reload, not a later successful write — because nothing here can tell a
	 * repaired vault from an unrepaired one. Retirement is the user removing that file after
	 * checking their vault against a backup, and this read-only report is the one surface that
	 * can name the file without becoming the "I have repaired this" control ADR-0034 and
	 * `docs/using-planning-recovery.md` both refuse by name.
	 *
	 * Content-free like everything else here: `WriteIncident`'s own docblock states the same
	 * constraint this interface's does (SDD §68, §86) — opaque ids, entity kinds, an error
	 * code, a category and a timestamp, and no note bodies, titles or vault paths. The single
	 * path is `write-incidents.json`'s own, which is plugin-local and carries none.
	 */
	writeIncidents: WriteIncidentReport;
}

/** Where the snapshot's facts come from — all answered from memory, none from a vault read. */
export interface DiagnosticsSources {
	readonly versions: RuntimeVersions;
	latestSchemaVersions(): Readonly<Record<string, number>>;
	lastAppliedMigration(): string | null;
	readonly ledger: DiagnosticsLedger;
	/**
	 * Injected rather than read off `activeWriteIncidentRegistry()` here: a query that reaches
	 * a module-level global is a query a test cannot isolate, and the composition root is
	 * already the layer that knows which session's registry this is. The accessor is called at
	 * the composition site (`guardedServices.ts`) instead, per call so a registry installed
	 * after this query was composed still answers — which is what the SESSION-scoped
	 * `SessionStores` and the per-settings-save composition root make possible.
	 */
	writeIncidents(): WriteIncidentReport;
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
			// From MEMORY, never a file read: `WriteIncidentRegistry` mirrors the durable record
			// at load precisely so the gate can answer synchronously, and this query's
			// cannot-fail contract above depends on every source doing the same.
			writeIncidents: this.sources.writeIncidents(),
		});
	}
}
