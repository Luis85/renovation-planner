import type { Logger } from '../../../application/ports/Logger';
import type { LocalStorageAdapter } from './continueContextStore';

/**
 * One per-device JSON slot over Obsidian's `App.loadLocalStorage`/`saveLocalStorage` — the surface
 * `ContinueContextStore` uses, for its reasons: not a note (opening an editor must not dirty the
 * vault), not `data.json` (`settingsFrom` drops keys it does not declare), not a file under
 * `.obsidian/` (Sync may carry it to a device with a different screen).
 *
 * It answers `unknown` and parses nothing. The shape belongs to the caller
 * (`presentation/editor/shell/panelLayout.ts`), and this layer may not import it, so the trust
 * boundary sits beside the type rather than here. Both doors swallow and warn, for
 * `ContinueContextStore`'s own "no door ever rejects" reason: a layout that failed to persist costs
 * the user a remembered width, never an error.
 */
export class DeviceLocalStore {
	constructor(
		private readonly adapter: LocalStorageAdapter,
		private readonly key: string,
		private readonly logger: Logger,
	) {}

	read(): unknown {
		try {
			return this.adapter.loadLocalStorage(this.key);
		} catch (cause) {
			this.logger.warn('device-local-store.read-failed', { key: this.key, cause });
			return null;
		}
	}

	write(value: unknown): void {
		try {
			this.adapter.saveLocalStorage(this.key, value);
		} catch (cause) {
			this.logger.warn('device-local-store.write-failed', { key: this.key, cause });
		}
	}
}
