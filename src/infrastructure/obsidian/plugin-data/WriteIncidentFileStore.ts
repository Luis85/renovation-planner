import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { PersistenceError } from '../../../core/errors/AppError';
import { persistenceError } from '../../../application/errors';
import { KeyedQueues } from '../repositories/KeyedQueues';
import {
	WRITE_INCIDENT_SCHEMA_VERSION,
	unreadableWriteIncident,
	type WriteIncident,
} from '../../../application/incidents/WriteIncident';
import type { WriteIncidentStore } from '../../../application/ports/WriteIncidentStore';
import type { TextFileAdapter } from './SequenceMarkerFileStore';

/** Its own lane, so an incident write never queues behind a delete-resolution marker write. */
const LANE = 'write-incidents';

/**
 * The durable record behind `WriteIncidentStore` (ADR-0034): ONE plugin-local JSON file, a
 * SIBLING of `sequence-markers.json` and deliberately not a second map inside it. Same narrow
 * `TextFileAdapter` port, same single `KeyedQueues` lane, same versioned whole-envelope
 * rewrite per mutation — a proven shape pointed at a new file. The path is built at the
 * construction site in `RenovationPlannerPlugin`, the way the marker store's is.
 *
 * **Two measured reasons it is not a second map in `sequence-markers.json`**, which is the
 * cheaper option and was rejected:
 * - `recoverInterruptedSequences.recoverOne` switches on a record's `entityDeleted` field
 *   rather than on a `kind` discriminant, so ANYTHING reachable through that store's `list()`
 *   is treated as a delete-resolution sequence and its `progress` entries are RESTORED —
 *   replayed, which is the one behaviour ADR-0034 refuses outright.
 * - Retirement is the user removing this record after checking their vault against a backup,
 *   and that gesture must not also destroy a live delete-resolution marker that is still
 *   waiting to roll something back.
 *
 * **The schema-version handling deliberately differs from its sibling, in the opposite
 * direction.** `SequenceMarkerFileStore` DISCARDS a record whose version it does not
 * recognise, with a log line and direction-blind — a recorded defect against SDD §87 rule 8
 * that a separate increment fixes there. Here a record this build cannot read is an UNKNOWN
 * OPEN incident: it still counts as open (`unreadableWriteIncident`), it is never silently
 * dropped, and its raw form is what a later `add` writes back, so nothing migrates it. Fail
 * closed — that store recovers by replaying, and being wrong about a record costs it a bad
 * restore; this one only ever says "a half-write happened", and being wrong about a record
 * costs the user a manufactured all-clear.
 *
 * The records are a LIST rather than a map: two incidents may name the same entity, so there
 * is no key that would not collide.
 *
 * What this store does NOT validate: the envelope's own `schemaVersion`. It is written on
 * every rewrite and never branched on, because the records inside carry their own and are
 * preserved regardless — an envelope whose shape is foreign enough to lose the `incidents`
 * array refuses as unreadable, which is the same fail-closed answer.
 */
export class WriteIncidentFileStore implements WriteIncidentStore {
	private readonly queues = new KeyedQueues();

	constructor(
		private readonly adapter: TextFileAdapter,
		private readonly path: string,
	) {}

	list(): Promise<Result<readonly WriteIncident[], PersistenceError>> {
		return this.queues.run(LANE, async () => {
			const parsed = await this.readRecords();
			if (isErr(parsed)) return parsed;
			return ok(parsed.value.map(asIncident));
		});
	}

	add(incident: WriteIncident): Promise<Result<void, PersistenceError>> {
		return this.queues.run(LANE, async () => {
			const parsed = await this.readRecords();
			if (isErr(parsed)) return parsed;
			// The existing records go back VERBATIM, unrecognised ones included — see the
			// schema-version paragraph above.
			return await this.writeEnvelope([...parsed.value, incident]);
		});
	}

	/**
	 * The raw record list, untyped on purpose: validating a record is `asIncident`'s job — all
	 * SIX declared fields' TYPES, not merely the three (`schemaVersion`, `incidentId`,
	 * `affected`) a prior pass checked. A record passing the narrower check with `raisedAt`,
	 * `code` or `category` missing was returned as RECOGNISED with `undefined` sitting where
	 * the type declares a string, invisible until something reads one of those three fields —
	 * which the diagnostics reader ADR-0034 requires will do. What this still does not check:
	 * that `raisedAt` parses as a real ISO-8601 instant, or that `category` names one of
	 * `ErrorCategory`'s eight members rather than merely being A string — a `typeof` check
	 * catches the shape a truncated or hand-edited record loses, not a value that is
	 * well-typed and still wrong.
	 */
	private async readRecords(): Promise<Result<readonly unknown[], PersistenceError>> {
		if (!(await this.adapter.exists(this.path))) return ok([]);
		let raw: unknown;
		try {
			raw = JSON.parse(await this.adapter.read(this.path));
		} catch (cause) {
			return err(persistenceError('write-incident.file-unreadable', 'The write incident file is not valid JSON.', cause));
		}
		// `null` is valid JSON, and the property read below is what this guard protects — the
		// same two-step the sibling store carries for the same four-byte file.
		if (typeof raw !== 'object' || raw === null) {
			return err(persistenceError('write-incident.file-unreadable', 'The write incident file has an unreadable shape.'));
		}
		const incidents = (raw as { incidents?: unknown }).incidents;
		if (!Array.isArray(incidents)) {
			return err(persistenceError('write-incident.file-unreadable', 'The write incident file has an unreadable shape.'));
		}
		return ok(incidents);
	}

	private async writeEnvelope(incidents: readonly unknown[]): Promise<Result<void, PersistenceError>> {
		try {
			await this.adapter.write(this.path, JSON.stringify({ schemaVersion: WRITE_INCIDENT_SCHEMA_VERSION, incidents }));
			return ok(undefined);
		} catch (cause) {
			return err(persistenceError('write-incident.write-failed', 'Writing the write incident file failed.', cause));
		}
	}
}

/** A recognised record as itself; anything else as an open incident this build cannot read. */
function asIncident(raw: unknown): WriteIncident {
	const shape = raw as Partial<WriteIncident> | null;
	if (
		typeof shape === 'object' &&
		shape !== null &&
		shape.schemaVersion === WRITE_INCIDENT_SCHEMA_VERSION &&
		typeof shape.incidentId === 'string' &&
		typeof shape.raisedAt === 'string' &&
		typeof shape.code === 'string' &&
		typeof shape.category === 'string' &&
		Array.isArray(shape.affected)
	) {
		return shape as WriteIncident;
	}
	return unreadableWriteIncident(raw);
}
