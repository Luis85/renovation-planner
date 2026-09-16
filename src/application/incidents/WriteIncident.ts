import type { ErrorCategory } from '../../core/errors/AppError';
import type { AffectedEntity } from '../commands/DispatchOutcome';

/** The envelope and record version this build writes and recognises. ADR-0034. */
export const WRITE_INCIDENT_SCHEMA_VERSION = 1;

/**
 * The durable record of a write incident (ADR-0034): a refused write that left the vault
 * half-written and whose compensating undo also failed — exactly the condition
 * `markUncompensated` already stamps onto a failed `Result`.
 *
 * **It stores nothing it would replay from, and that is the whole reason it is a separate
 * type rather than a second kind of `SequenceMarker`.** `SequenceMarker` deliberately
 * carries a full `entitySnapshot` because its recovery pass RESTORES what it describes.
 * This record never replays: it can only say that a half-write happened and name what the
 * raise site could name. So it is content-free in the sense
 * `GetDiagnosticsSnapshotQuery`'s own docblock states (SDD §68, §86) — opaque ids, entity
 * kinds, an error code, a category and a timestamp, and no note bodies, paths, entity
 * snapshots or plan content.
 *
 * `affected` may legitimately be EMPTY. `leftWritesBehind` is a presence test rather than
 * an equality test, so "half-written, and this raise site cannot name what" is a real
 * stamp; an empty list here is therefore a fully open incident, never a non-incident.
 */
export interface WriteIncident {
	readonly schemaVersion: number;
	readonly incidentId: string;
	/** ISO-8601, minted at the raise site. */
	readonly raisedAt: string;
	/** The refusing `AppError`'s own `code`. */
	readonly code: string;
	/** The refusing `AppError`'s own `category`. */
	readonly category: ErrorCategory;
	readonly affected: readonly AffectedEntity[];
}

/**
 * The `code` an incident this build cannot read is surfaced under.
 *
 * A SENTINEL rather than a fabrication: it is spelled here, once, so a reader can tell "this
 * record was written by a version whose shape we do not know" apart from any code a raise
 * site actually minted. It is never written to the file — `unreadableWriteIncident` produces
 * it on the way OUT of a store, and the raw record it stands in for is kept verbatim.
 */
export const UNREADABLE_WRITE_INCIDENT_CODE = 'write-incident.unreadable';

/**
 * The `incidentId` a record gets when its OWN `incidentId` cannot be read either — the
 * `unreadableWriteIncident(null)` path `WriteIncidentRegistry.seed()` takes when the durable
 * read itself refuses, where there is no raw record to salvage a string out of at all.
 *
 * A stable sentinel rather than `''`: the gate only counts (`anyOpen()`'s `length > 0`), so an
 * empty id costs it nothing, but the diagnostics reader ADR-0034 requires would otherwise hold
 * an incident it cannot NAME — indistinguishable from a second one in the same list, and empty
 * in whatever the reader renders. `'incident-'` followed by a lowercase word rather than a
 * ULID is deliberately not a shape `createEntityId('incident')` ever mints — that factory's
 * suffix is uppercase Crockford base32 — so this sentinel can never collide with a real one.
 */
export const UNREADABLE_WRITE_INCIDENT_ID = 'incident-unreadable';

/**
 * Surface a record this build cannot read as an OPEN incident rather than as absence.
 *
 * This is the point where this mechanism deliberately differs from `SequenceMarkerFileStore`,
 * which discards an unrecognised `schemaVersion` with a log line and answers as if the record
 * were not there. That is direction-blind and is a recorded defect against SDD §87 rule 8
 * ("never present a missing or refused read as zero, empty or nothing yet"); fixing it there
 * is a separate increment. Here, failing closed is the whole point of the gate, so an
 * unreadable record counts as open, is never dropped, and its raw form is what the store
 * rewrites.
 *
 * What survives from the raw record is only what can be read without trusting its shape: a
 * numeric `schemaVersion`, a string `incidentId` and a string `raisedAt`. Anything else
 * falls back to a stated placeholder, because guessing at a field's meaning across an
 * unknown version is exactly the migration this record refuses to perform.
 */
export function unreadableWriteIncident(raw: unknown): WriteIncident {
	const shape: Partial<WriteIncident> = typeof raw === 'object' && raw !== null ? raw : {};
	return {
		schemaVersion: typeof shape.schemaVersion === 'number' ? shape.schemaVersion : 0,
		incidentId: typeof shape.incidentId === 'string' ? shape.incidentId : UNREADABLE_WRITE_INCIDENT_ID,
		// No comparable sentinel for a TIMESTAMP: unlike an id, there is no string shape a real
		// `raisedAt` can never take, so a placeholder here would risk reading as a real instant
		// rather than announcing itself as absent. `''` stays the honest answer — a reader must
		// already treat it as "unknown", the same way it must treat `UNREADABLE_WRITE_INCIDENT_CODE`
		// as "not a code any raise site minted" rather than parse either as data.
		raisedAt: typeof shape.raisedAt === 'string' ? shape.raisedAt : '',
		code: UNREADABLE_WRITE_INCIDENT_CODE,
		category: 'Persistence',
		affected: [],
	};
}
