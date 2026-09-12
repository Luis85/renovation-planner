import type { Logger } from '../../../application/ports/Logger';
import type { LocalStorageAdapter } from './continueContextStore';

type ViewChoices = { gridVisible?: boolean; snappingEnabled?: boolean };

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
	function read(): ViewChoices {
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
	}
	return {
		read,
		/**
		 * Merged into what is stored NOW rather than replacing it: two open leaves each hold the
		 * snapshot they mounted with, and a leaf writing its whole pair would restore its own stale
		 * value for the choice the other leaf just changed.
		 */
		write(changed: Readonly<ViewChoices>): void {
			try {
				adapter.saveLocalStorage(key, { ...read(), ...changed });
			} catch (cause) {
				logger.warn('editor-view-preferences.write-failed', { cause });
			}
		},
	};
}
