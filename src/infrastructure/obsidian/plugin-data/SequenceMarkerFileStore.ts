import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { PersistenceError } from '../../../core/errors/AppError';
import type { Logger } from '../../../application/ports/Logger';
import { persistenceError } from '../repositories/noteIo';
import { KeyedQueues } from '../repositories/KeyedQueues';
import {
	SEQUENCE_MARKER_SCHEMA_VERSION,
	type SequenceMarker,
} from '../../../application/reference/deleteResolution';
import type { SequenceMarkerStore } from '../../../application/ports/SequenceMarkerStore';

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
 * A marker whose schemaVersion this build does not read is DISCARDED with a diagnostic,
 * never migrated: recovery writes, so recovering from a misread shape could restore wrong
 * content over a Requirement (the task spec's "migration story that is allowed to be
 * short"). The discard answers null and drops the entry on the next write.
 */
export class SequenceMarkerFileStore implements SequenceMarkerStore {
	private readonly queues = new KeyedQueues();

	constructor(
		private readonly adapter: TextFileAdapter,
		private readonly path: string,
		private readonly logger: Logger,
	) {}

	list(): Promise<Result<readonly SequenceMarker[], PersistenceError>> {
		return this.queues.run('sequence-markers', async () => {
			const parsed = await this.readEnvelope();
			if (isErr(parsed)) return parsed;
			return ok(Object.values(parsed.value.markers));
		});
	}

	read(entityId: string): Promise<Result<SequenceMarker | null, PersistenceError>> {
		return this.queues.run('sequence-markers', async () => {
			const parsed = await this.readEnvelope();
			if (isErr(parsed)) return parsed;
			return ok(parsed.value.markers[entityId] ?? null);
		});
	}

	write(marker: SequenceMarker): Promise<Result<void, PersistenceError>> {
		return this.queues.run('sequence-markers', async () => {
			const parsed = await this.readEnvelope();
			if (isErr(parsed)) return parsed;
			parsed.value.markers[marker.entityId] = marker;
			return await this.writeEnvelope(parsed.value);
		});
	}

	clear(entityId: string): Promise<Result<void, PersistenceError>> {
		return this.queues.run('sequence-markers', async () => {
			const parsed = await this.readEnvelope();
			if (isErr(parsed)) return parsed;
			delete parsed.value.markers[entityId];
			return await this.writeEnvelope(parsed.value);
		});
	}

	/** Reads and validates the envelope; a malformed or future-versioned one is discarded. */
	private async readEnvelope(): Promise<
		Result<{ markers: Record<string, SequenceMarker> }, PersistenceError>
	> {
		if (!(await this.adapter.exists(this.path))) return ok({ markers: {} });
		let raw: unknown;
		try {
			raw = JSON.parse(await this.adapter.read(this.path));
		} catch (cause) {
			return err(persistenceError('sequence.marker-unreadable', 'The sequence marker file is not valid JSON.', cause));
		}
		const markers = (raw as { markers?: Record<string, unknown> }).markers;
		if (typeof raw !== 'object' || raw === null || typeof markers !== 'object' || markers === null) {
			return err(persistenceError('sequence.marker-unreadable', 'The sequence marker file has an unreadable shape.'));
		}
		const validated: Record<string, SequenceMarker> = {};
		for (const [id, value] of Object.entries(markers)) {
			const shape = value as SequenceMarker | undefined;
			if (shape !== undefined && shape.schemaVersion === SEQUENCE_MARKER_SCHEMA_VERSION && Array.isArray(shape.progress)) {
				validated[id] = shape;
				continue;
			}
			// Discarded, not migrated — surfaced here so slice 11's diagnostics can name the
			// entity left in the partially-resolved state the unreadable marker described.
			this.logger.error('sequence.marker.discarded', {
				entityId: id,
				foundSchemaVersion: (shape as { schemaVersion?: unknown } | undefined)?.schemaVersion,
			});
		}
		return ok({ markers: validated });
	}

	private async writeEnvelope(envelope: { markers: Record<string, SequenceMarker> }): Promise<Result<void, PersistenceError>> {
		try {
			await this.adapter.write(this.path, JSON.stringify({ schemaVersion: SEQUENCE_MARKER_SCHEMA_VERSION, markers: envelope.markers }));
			return ok(undefined);
		} catch (cause) {
			return err(persistenceError('sequence.marker-write-failed', 'Writing the sequence marker file failed.', cause));
		}
	}
}
