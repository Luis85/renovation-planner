/**
 * The diagnostics ports (SDD §68): what the snapshot query needs from outside the
 * application layer, stated as data and functions rather than as concrete classes.
 *
 * The hard rule both ports serve: **project content never enters diagnostics.** An
 * entity is named by its opaque id, never by a human-readable name; an issue by its
 * error code; a schema by its version number.
 */

/** Versions of the two runtimes the plugin runs inside — plugin-local facts only. */
export interface RuntimeVersions {
	readonly pluginVersion: string;
	readonly obsidianVersion: string;
}

/**
 * One content-free validation finding: WHICH entity refused (opaque id), and WHY
 * (an error code), never what its data said.
 */
export interface ValidationIssue {
	readonly entityType: string;
	readonly entityId: string;
	readonly issue: string;
}

/**
 * Where read-path refusals accumulate so the diagnostics snapshot can report them.
 * In-memory by design: diagnostics are computed on demand, describe THIS session, and
 * are persisted nowhere (SDD §68).
 */
export interface DiagnosticsLedger {
	record(issue: ValidationIssue): void;
	issues(): readonly ValidationIssue[];
}
