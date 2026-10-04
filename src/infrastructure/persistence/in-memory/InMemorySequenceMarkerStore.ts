import { ok, type Result } from '../../../core/result/Result';
import type { PersistenceError } from '../../../core/errors/AppError';
import type {
	SequenceMarker,
} from '../../../application/reference/deleteResolution';
import type { SequenceMarkerListing, SequenceMarkerStore } from '../../../application/ports/SequenceMarkerStore';

/**
 * The in-memory twin of the marker store — what application tests drive the interrupted-
 * sequence cases through, exactly like its repository siblings. Production persists
 * through an Obsidian-backed implementation of the same port.
 *
 * **It is STRUCTURALLY NARROWER than the real thing, and this sentence is the honest
 * version of that rather than an apology for it.** It holds typed `SequenceMarker` objects
 * in a `Map`, so it can never hold an entry that failed to parse: `list()`'s unreadable half
 * is always empty here, and NO test using this store can exercise that path. Deliberately no
 * "pretend unreadable" facility — a fake that could fabricate one would be a fake inventing
 * a state the real store derives from file TEXT. That path is driven where the text is, in
 * `tests/infrastructure/obsidian/plugin-data/sequenceMarkerFileStore.test.ts` against a real
 * adapter fake, and in `recovery.test.ts` against a listing handed in directly.
 */
export class InMemorySequenceMarkerStore implements SequenceMarkerStore {
	private readonly markers = new Map<string, SequenceMarker>();

	list(): Promise<Result<SequenceMarkerListing, PersistenceError>> {
		return Promise.resolve(ok({ markers: [...this.markers.values()], unreadable: [] }));
	}

	read(entityId: string): Promise<Result<SequenceMarker | null, PersistenceError>> {
		return Promise.resolve(ok(this.markers.get(entityId) ?? null));
	}

	write(marker: SequenceMarker): Promise<Result<void, PersistenceError>> {
		this.markers.set(marker.entityId, marker);
		return Promise.resolve(ok(undefined));
	}

	clear(entityId: string): Promise<Result<void, PersistenceError>> {
		this.markers.delete(entityId);
		return Promise.resolve(ok(undefined));
	}
}
