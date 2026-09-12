import type { Logger } from '../../../application/ports/Logger';
import type { LocalStorageAdapter } from './continueContextStore';

/**
 * The Plan Editor's View menu choices — grid and object snapping — shared by every plan on this
 * device, through the same per-device `App.loadLocalStorage`/`saveLocalStorage` pair
 * `ContinueContextStore` uses, for its reasons: not a note, not `data.json`.
 *
 * The stored value is a trust boundary like any other a user can edit, so a field that is not a
 * boolean is dropped rather than cast, and neither door throws — a preference that failed to
 * load or save costs a default, never an error.
 */
export function editorViewPreferencesStore(adapter: LocalStorageAdapter, key: string, logger: Logger) {
	return {
		read(): { gridVisible?: boolean; snappingEnabled?: boolean } {
			try {
				const raw = adapter.loadLocalStorage(key);
				if (typeof raw !== 'object' || raw === null) return {};
				const { gridVisible, snappingEnabled } = raw as Record<string, unknown>;
				return {
					...(typeof gridVisible === 'boolean' ? { gridVisible } : {}),
					...(typeof snappingEnabled === 'boolean' ? { snappingEnabled } : {}),
				};
			} catch (cause) {
				logger.warn('editor-view-preferences.read-failed', { cause });
				return {};
			}
		},
		write(preferences: { readonly gridVisible: boolean; readonly snappingEnabled: boolean }): void {
			try {
				adapter.saveLocalStorage(key, { gridVisible: preferences.gridVisible, snappingEnabled: preferences.snappingEnabled });
			} catch (cause) {
				logger.warn('editor-view-preferences.write-failed', { cause });
			}
		},
	};
}
