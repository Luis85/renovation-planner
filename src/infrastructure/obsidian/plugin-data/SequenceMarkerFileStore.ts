import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { PersistenceError } from '../../../core/errors/AppError';
import type { Logger } from '../../../application/ports/Logger';
import { persistenceError } from '../repositories/noteIo';
import { KeyedQueues } from '../repositories/KeyedQueues';
import {
	SEQUENCE_MARKER_SCHEMA_VERSION,
	type SequenceMarker,
} from '../../../application/reference/deleteResolution';
import type { SequenceMarkerListing, SequenceMarkerStore } from '../../../application/ports/SequenceMarkerStore';

/**
 * The parsed file, split. `unreadable` holds the RAW entries, keyed as the file keyed them,
 * so a rewrite can put them back exactly as they were found — which is why it is internal
 * and the port's own `UnreadableSequenceMarker` is content-free.
 */
interface Envelope {
	markers: Record<string, SequenceMarker>;
	unreadable: Record<string, unknown>;
}

/**
 * **Both halves are NULL-PROTOTYPE maps, and that is the whole reason this function exists**
 * rather than two `{}` literals at the two sites that need them. The keys are entity ids out
 * of a file a user can edit, so `Object.prototype`'s own members are legal keys, and an
 * inherited-member map gets both directions wrong: `id in map` answers `true` for
 * `constructor`, `toString` or `hasOwnProperty` that the file never held — refusing a
 * legitimate delete with `sequence.marker-write-blocked` — while `map[id] = value` for the key
 * `__proto__` invokes the inherited SETTER and creates no own property at all, so that one
 * entry landed in neither half, was reported by nothing and was rewritten away by the next
 * unrelated write. `Object.create(null)` closes both: `in` and `delete` then see own keys
 * only, and assignment always defines one. The object SPREAD in `writeEnvelope` is already
 * safe either way — it defines own properties rather than assigning them.
 */
function emptyEnvelope(): Envelope {
	return {
		markers: Object.create(null) as Record<string, SequenceMarker>,
		unreadable: Object.create(null) as Record<string, unknown>,
	};
}

/**
 * The file surface the marker store persists through. Structural rather than Obsidian's
 * `DataAdapter` so a test can hand a few lines of fake; the vault's own adapter satisfies
 * it as-is.
 */
export interface TextFileAdapter {
	exists(path: string): Promise<boolean>;
	read(path: string): Promise<string>;
	write(path: string, data: string): Promise<void>;
	remove(path: string): Promise<void>;
}

/**
 * The durable record behind `SequenceMarkerStore`, persisted as ONE plugin-local JSON
 * file — never `data.json`'s settings object, which `settingsFrom` would strip an
 * undeclared key out of and which a user could reasonably edit as preferences. The whole
 * map is rewritten per mutation because markers are rare and tiny: they exist only
 * between one interrupted sequence's first mutation and its recovery.
 *
 * **An entry this build cannot read is PRESERVED and REPORTED, never migrated and never
 * discarded** (BP-02 slice 3). Nothing migrates one, for the reason the short migration
 * story always gave: recovery WRITES, so restoring from a misread shape could put wrong
 * content over a Requirement. What changed is the other half. It used to be dropped from
 * the validated map with a log line, which made a vault sitting mid-rollback present as a
 * vault with nothing outstanding (SDD §87 rule 8) and — because `write` and `clear` rewrite
 * the envelope from that same validated map — destroyed the evidence on the very next
 * marker operation, rule 7 failing open. Now it comes back in `list()`'s `unreadable` half,
 * `read` refuses rather than answering `null`, and every rewrite carries each unreadable
 * ENTRY through byte-shape unchanged. Read that last clause narrowly: it is true of the
 * ENTRIES and not of the ENVELOPE around them, whose top-level `schemaVersion` every write
 * stamps with this build's. `readEnvelope` gates on nothing there, so nothing here notices —
 * but a future build that gated on it would meet its own records under a version it did not
 * write.
 *
 * **`clear(entityId)` is the only door that removes one, and that claim is held by BEHAVIOUR
 * rather than by a text scan.** Every mutation door is driven against a seeded unreadable
 * entry in `sequenceMarkerFileStore.test.ts` — an unrelated `write`, an unrelated `clear`, a
 * colliding `write`, and a `__proto__`-keyed entry — each asserting the WRITTEN BYTES still
 * carry it. The grep this paragraph used to quote (`unreadable\[`, two hits) was the wrong
 * instrument and said so by being accurate: the rewrite path is spelled
 * `{ ...envelope.unreadable }`, which that pattern cannot match at all, so a count taken with
 * it was never a count of the set.
 * An explicit clear is an intentional gesture, and nothing in the plugin calls it for an
 * unreadable entry — recovery walks the recognised half alone. A `write()` for that same id
 * does NOT supersede it, which is what the first version of this slice got wrong: it refuses
 * with `sequence.marker-write-blocked`, because opening a new destructive sequence over an
 * entity whose outstanding record this build cannot finish is exactly SDD §87 rule 7's
 * fail-closed case.
 *
 * That is the sibling `WriteIncidentFileStore`'s rule met in the shape a MARKER needs: an
 * incident can be a sentinel in the same list because nothing replays one, and a marker
 * cannot, because `recoverOne` would walk and retire anything shaped like one.
 */
export class SequenceMarkerFileStore implements SequenceMarkerStore {
	private readonly queues = new KeyedQueues();

	constructor(
		private readonly adapter: TextFileAdapter,
		private readonly path: string,
		private readonly logger: Logger,
	) {}

	/**
	 * **The ONE door that logs an unreadable entry**, because a preserved entry would
	 * otherwise report on every marker operation for the life of the vault: `readEnvelope` is
	 * reached by all four methods and separates the two halves silently, while this is the
	 * load-time recovery read, called once per load.
	 */
	list(): Promise<Result<SequenceMarkerListing, PersistenceError>> {
		return this.queues.run('sequence-markers', async () => {
			const parsed = await this.readEnvelope();
			if (isErr(parsed)) return parsed;
			const unreadable = Object.entries(parsed.value.unreadable).map(([entityId, raw]) => ({
				entityId,
				foundSchemaVersion: (raw as { schemaVersion?: unknown } | null | undefined)?.schemaVersion,
			}));
			for (const entry of unreadable) this.logger.error('sequence.marker.unreadable', entry);
			return ok({ markers: Object.values(parsed.value.markers), unreadable });
		});
	}

	read(entityId: string): Promise<Result<SequenceMarker | null, PersistenceError>> {
		return this.queues.run('sequence-markers', async () => {
			const parsed = await this.readEnvelope();
			if (isErr(parsed)) return parsed;
			// Never `null` for an entry that IS there and could not be read: that would be the
			// manufactured absence SDD §87 rule 8 forbids, at the door most likely to be read
			// as "this entity has nothing outstanding".
			if (entityId in parsed.value.unreadable) {
				// Says only what is known. "Written by a version this build cannot read" would be
				// false for the other half of the class — a record a hand edit bent out of shape
				// at the CURRENT version, which the sibling test drives.
				return err(persistenceError('sequence.marker-unreadable', 'That sequence marker could not be read.'));
			}
			return ok(parsed.value.markers[entityId] ?? null);
		});
	}

	write(marker: SequenceMarker): Promise<Result<void, PersistenceError>> {
		return this.queues.run('sequence-markers', async () => {
			const parsed = await this.readEnvelope();
			if (isErr(parsed)) return parsed;
			// FAIL CLOSED (SDD §87 rule 7). An unreadable entry under this id means the vault
			// holds an outstanding recovery record for this very entity that this build cannot
			// complete; opening a NEW destructive sequence over it would put a record this build
			// CAN read on top of the evidence a newer one needs. Refusing costs no new machinery:
			// `runDeleteResolution` already aborts the whole operation when its pre-write marker
			// cannot be written, so this surfaces through a path that is already tested.
			//
			// A distinct code rather than `sequence.marker-unreadable`, which says "what I read
			// could not be parsed"; this says "I read it fine, and something older than it is
			// still outstanding".
			if (marker.entityId in parsed.value.unreadable) {
				return err(persistenceError('sequence.marker-write-blocked', 'A recovery record for this item is outstanding and cannot be read by this build, so a new one is refused.'));
			}
			parsed.value.markers[marker.entityId] = marker;
			return await this.writeEnvelope(parsed.value);
		});
	}

	clear(entityId: string): Promise<Result<void, PersistenceError>> {
		return this.queues.run('sequence-markers', async () => {
			const parsed = await this.readEnvelope();
			if (isErr(parsed)) return parsed;
			// Both halves: an explicit clear is an intentional gesture and is allowed to remove
			// an entry this build cannot read. Nothing in the plugin calls it for one.
			delete parsed.value.markers[entityId];
			delete parsed.value.unreadable[entityId];
			return await this.writeEnvelope(parsed.value);
		});
	}

	/**
	 * Reads the envelope and splits its entries into the ones this build parsed and the raw
	 * form of the ones it did not. Silent — `list` does the logging, for the reason its own
	 * docblock gives.
	 *
	 * **Two LEVELS of refusal, and only the lower one separates.** An ENVELOPE that is not
	 * valid JSON, is not an object, or has no `markers` object refuses outright and writes
	 * nothing, so nothing is destroyed — and there is no sibling to salvage, because a
	 * top-level shape nothing can parse has no entries to separate. A single unreadable
	 * ENTRY among readable ones blocks nothing: its siblings list, recover and clear
	 * normally while it is preserved and reported.
	 */
	private async readEnvelope(): Promise<
		Result<Envelope, PersistenceError>
	> {
		if (!(await this.adapter.exists(this.path))) return ok(emptyEnvelope());
		let raw: unknown;
		try {
			raw = JSON.parse(await this.adapter.read(this.path));
		} catch (cause) {
			return err(persistenceError('sequence.marker-unreadable', 'The sequence marker file is not valid JSON.', cause));
		}
		// Two tests, in this order, because the property read is what the first one protects:
		// `null` is valid JSON, so a file whose whole body is the four bytes `null` reached the
		// cast and threw a TypeError out of a door that answers coded refusals. The `&&` chain
		// read correctly and evaluated the lookup a line above itself.
		if (typeof raw !== 'object' || raw === null) {
			return err(persistenceError('sequence.marker-unreadable', 'The sequence marker file has an unreadable shape.'));
		}
		const markers = (raw as { markers?: Record<string, unknown> }).markers;
		if (typeof markers !== 'object' || markers === null) {
			return err(persistenceError('sequence.marker-unreadable', 'The sequence marker file has an unreadable shape.'));
		}
		const { markers: validated, unreadable } = emptyEnvelope();
		for (const [id, value] of Object.entries(markers)) {
			// `typeof … === 'object' && !== null` rather than the `!== undefined` this carried:
			// `null` is a legal JSON entry in a file the user can edit, and the property read
			// on the next line is exactly what it cannot take — the four-byte defect the
			// envelope guard above already carries, one level down. The same shape as
			// `WriteIncidentFileStore.asIncident`, which is this rule's other half.
			const shape = value as Partial<SequenceMarker> | null;
			if (
				typeof shape === 'object' &&
				shape !== null &&
				shape.schemaVersion === SEQUENCE_MARKER_SCHEMA_VERSION &&
				Array.isArray(shape.progress)
			) {
				validated[id] = shape as SequenceMarker;
				continue;
			}
			// Preserved verbatim, not migrated and not discarded — see the class docblock.
			unreadable[id] = value;
		}
		return ok({ markers: validated, unreadable });
	}

	private async writeEnvelope(envelope: Envelope): Promise<Result<void, PersistenceError>> {
		try {
			// The unrecognised entries go back verbatim, and the two halves are DISJOINT by
			// construction, so this spread cannot collide: `readEnvelope` files each id into
			// exactly one half, `write` refuses an id the unreadable half holds, and `clear`
			// removes an id from both. (The spread order is therefore not load-bearing — it is
			// written unreadable-first so that if a fourth mutation door ever appears and gets
			// this wrong, the recognised entry wins rather than a half-parsed one.)
			//
			// The ENVELOPE's own version is this build's on every write; only the entries are
			// preserved. See the class docblock.
			const markers = { ...envelope.unreadable, ...envelope.markers };
			await this.adapter.write(this.path, JSON.stringify({ schemaVersion: SEQUENCE_MARKER_SCHEMA_VERSION, markers }));
			return ok(undefined);
		} catch (cause) {
			return err(persistenceError('sequence.marker-write-failed', 'Writing the sequence marker file failed.', cause));
		}
	}
}
