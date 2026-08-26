import type { PersistenceError } from '../../core/errors/AppError';
import type { Result } from '../../core/result/Result';
import type { SequenceMarker } from '../reference/deleteResolution';

/**
 * Where an outstanding sequence marker persists between one interrupted sequence's first
 * mutation and its completion or recovery. Plugin-local operational state: implemented
 * OVER the plugin directory, never through `data.json`'s settings object — `settingsFrom`
 * drops keys this version does not declare, which would silently discard an outstanding
 * recovery, and a marker is not a preference a user should find in their settings file.
 */
export interface SequenceMarkerStore {
	read(entityId: string): Promise<Result<SequenceMarker | null, PersistenceError>>;
	write(marker: SequenceMarker): Promise<Result<void, PersistenceError>>;
	clear(entityId: string): Promise<Result<void, PersistenceError>>;
}
