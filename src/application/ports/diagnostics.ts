import type { AppError } from '../../core/errors/AppError';
import type { EntityId } from '../../core/identity/EntityId';

/**
 * The diagnostics ports (SDD §68): what the snapshot query needs from outside the
 * application layer, stated as data and functions rather than as concrete classes.
 *
 * The hard rule both ports serve: **project content never enters diagnostics.** An
 * entity is named by its opaque id, never by a human-readable name; an issue by its
 * error code; a schema by its version number.
 *
 * That rule is enforced by the SHAPE of `record` below rather than by prose, and the
 * reason is worth stating: "the snapshot contains zero project content" is a claim about
 * a structure that CAN carry content, so no fixture can demonstrate it — a test that
 * builds a content-free ledger and asserts the snapshot is content-free has proved only
 * that the query adds nothing. The check has to live where a caller could break it, which
 * is here, at the parameter list.
 */

/** Versions of the two runtimes the plugin runs inside — plugin-local facts only. */
export interface RuntimeVersions {
	readonly pluginVersion: string;
	readonly obsidianVersion: string;
}

/**
 * The entity kinds diagnostics can name. A closed union, so `record`'s first argument is
 * not a place to put a Zone's name either.
 *
 * Declared beside the port that reports them, the same way `ENTITY_TYPES` is declared
 * beside the port that indexes by it. It is a hand-written list, and drift is the price:
 * a seventh entity kind has to be added here before its repository can record a refusal.
 * That drift fails at COMPILE time, at the record call site — which is the loud end.
 *
 * It is deliberately NOT `EntityType` from `ProjectIndex`: that vocabulary is the
 * persisted frontmatter discriminator (`renovation-zone`), while this one is the
 * migration kind (`zone`) the read path already carries, and it has a member
 * (`plan-geometry`) that is a sidecar rather than a note.
 */
export type DiagnosticEntityKind = 'project' | 'plan' | 'zone' | 'asset' | 'requirement' | 'plan-geometry';

/**
 * One content-free validation finding: WHICH entity refused (opaque id), and WHY
 * (an error code), never what its data said. The ledger BUILDS these; nothing outside it
 * constructs one, which is why `issue` may stay a plain string.
 */
export interface ValidationIssue {
	readonly entityType: DiagnosticEntityKind;
	readonly entityId: EntityId<string>;
	readonly issue: string;
}

/**
 * Where read-path refusals accumulate so the diagnostics snapshot can report them.
 * In-memory by design: diagnostics are computed on demand, describe THIS session, and
 * are persisted nowhere (SDD §68).
 *
 * **`record` takes the `AppError`, not a string, and that is the guarantee.** It used to
 * take a whole `ValidationIssue` — three free strings, nothing narrowing any of them — so
 * a repository recording `issue: zone.name` or `entityId: file.path` would have produced a
 * snapshot full of project content with every test still green. Each parameter is now
 * something a caller cannot spell content into:
 *
 * - `entityType` is a closed union of kinds.
 * - `entityId` is a branded `EntityId`, so a name, a path or any other plain string is a
 *   compile error. Only a generated id — or a cast, which review can see — reaches it.
 * - the failure arrives as the whole `AppError`, and the ledger reads `error.code` off it.
 *   There is no parameter for free text at all. The error's own `message` and `cause` DO
 *   hold content (a migration refusal quotes the frontmatter value it read), and they are
 *   handed over precisely so that the one module allowed to decide what diagnostics may
 *   hold is the one that drops them.
 *
 * What this still does not stop, said plainly rather than left implied: a caller that
 * builds an `AppError` whose `code` is content (`code: zone.name`). Codes come from error
 * factories that compose a fixed vocabulary, so that is a review boundary, not a compiled
 * one — but it is a much narrower door than a free `issue: string` was.
 */
export interface DiagnosticsLedger {
	record(entityType: DiagnosticEntityKind, entityId: EntityId<string>, error: AppError): void;
	issues(): readonly ValidationIssue[];
}
