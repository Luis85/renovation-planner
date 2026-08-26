import { ok, type Result } from '../../../core/result/Result';
import type { PersistenceError } from '../../../core/errors/AppError';
import type {
	SequenceMarker,
} from '../../../application/reference/deleteResolution';
import type { SequenceMarkerStore } from '../../../application/ports/SequenceMarkerStore';

/**
 * The in-memory twin of the marker store — what application tests drive the interrupted-
 * sequence cases through, exactly like its repository siblings. Production persists
 * through an Obsidian-backed implementation of the same port.
 */
export class InMemorySequenceMarkerStore implements SequenceMarkerStore {
	private readonly markers = new Map<string, SequenceMarker>();

	read(entityId: string): Promise<Result<SequenceMarker | null, PersistenceError>> {
		return Promise.resolve(ok(this.markers.get(entityId) ?? null));
	}

	write(marker: SequenceMarker): Promise<Result<void, PersistenceError>> {
		this.markers.set(marker.entityId, structuredClone(marker));
		return Promise.resolve(ok(undefined));
	}

	clear(entityId: string): Promise<Result<void, PersistenceError>> {
		this.markers.delete(entityId);
		return Promise.resolve(ok(undefined));
	}
}
