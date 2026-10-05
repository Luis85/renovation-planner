import type { PersistenceError } from '../../core/errors/AppError';
import type { Result } from '../../core/result/Result';
import type { SequenceMarker } from '../reference/deleteResolution';

/**
 * A stored entry this build could not parse — a marker from a FUTURE version, or one a hand
 * edit bent out of shape. CONTENT-FREE on purpose: the key it was filed under, and whatever
 * its `schemaVersion` field held (`unknown`, since not being parseable is the whole point).
 * The raw record stays inside the implementation; putting it on the port would make this a
 * content-bearing type whose readers would start reasoning about a shape nothing validated.
 */
export interface UnreadableSequenceMarker {
	readonly entityId: string;
	readonly foundSchemaVersion: unknown;
}

/**
 * What a listing answers: the markers that PARSED, and the entries that did not.
 *
 * Two halves rather than one array, for the reason `ProjectListing { loaded, refused }` has
 * two: "there is nothing outstanding" and "there is something outstanding this build cannot
 * read" are different facts, and a store that answers only the first presents a vault sitting
 * mid-rollback as a clean one (SDD §87 rule 8).
 *
 * A SEPARATE half rather than a sentinel in `markers` (which is how `WriteIncidentStore`
 * answers the same question): `recoverInterruptedSequences.recoverOne` branches on
 * `entityDeleted`, walks `progress` and then CALLS `clear` — so anything shaped like a
 * `SequenceMarker` is replayed and retired, which is precisely what must not happen to a
 * record nothing could read. A separate half cannot be mistaken for one.
 *
 * **The unreadable half is never replayed and never cleared by recovery.** It stays in the
 * store until a build that can read it recovers it, or the user removes the file. Both
 * implementations of this port produce this type, which is why it lives here and not beside
 * `SequenceMarker` in the delete-resolution engine.
 */
export interface SequenceMarkerListing {
	readonly markers: readonly SequenceMarker[];
	readonly unreadable: readonly UnreadableSequenceMarker[];
}

/**
 * Where an outstanding sequence marker persists between one interrupted sequence's first
 * mutation and its completion or recovery. Plugin-local operational state: implemented
 * OVER the plugin directory, never through `data.json`'s settings object — `settingsFrom`
 * drops keys this version does not declare, which would silently discard an outstanding
 * recovery, and a marker is not a preference a user should find in their settings file.
 */
export interface SequenceMarkerStore {
	/** Both halves of what is outstanding — see `SequenceMarkerListing`. */
	list(): Promise<Result<SequenceMarkerListing, PersistenceError>>;
	/**
	 * One entity's marker, or `null` when there is none. An entry this build cannot READ is
	 * neither — it refuses (`sequence.marker-unreadable`), because `null` at this door would
	 * be the manufactured absence SDD §87 rule 8 forbids.
	 */
	read(entityId: string): Promise<Result<SequenceMarker | null, PersistenceError>>;
	/**
	 * Records or replaces one entity's marker. REFUSES (`sequence.marker-write-blocked`) when an
	 * entry this build cannot READ is already filed under that entity: opening a new destructive
	 * sequence over an entity whose outstanding record cannot be completed here would put
	 * readable content on top of the evidence a newer build needs, which is SDD §87 rule 7's
	 * fail-closed case. `runDeleteResolution` already aborts on a refused pre-write marker, so
	 * that refusal travels the path it already had.
	 */
	write(marker: SequenceMarker): Promise<Result<void, PersistenceError>>;
	clear(entityId: string): Promise<Result<void, PersistenceError>>;
}
