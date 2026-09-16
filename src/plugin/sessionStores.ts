import type { Logger } from '../application/ports/Logger';
import {
	WriteIncidentRegistry,
	installWriteIncidentRegistry,
} from '../application/incidents/WriteIncidentRegistry';
import { SequenceMarkerFileStore, type TextFileAdapter } from '../infrastructure/obsidian/plugin-data/SequenceMarkerFileStore';
import { WriteIncidentFileStore } from '../infrastructure/obsidian/plugin-data/WriteIncidentFileStore';

/**
 * The two plugin-local FILE stores and the one registry that read them, built once per
 * SESSION rather than per composition root.
 *
 * **Per session is the whole point**, and it is the reason `markerStore` was memoised on the
 * plugin before this module existed: `saveSettings` replaces the root mid-session, and the
 * files these point at survive that swap. A store rebuilt with the root would buy nothing but
 * a second queue, and an incident forgotten because the root was rebuilt would be exactly the
 * manufactured all-clear ADR-0034 exists to prevent.
 *
 * **Extracted from `RenovationPlannerPlugin` because that file was at its 400-line `max-lines`
 * cap**, and ADR-0034's wiring is what met the wall. The fix is the extraction, never a wider
 * budget — the rule `en.ts` and `composition-root.ts` both already settled at their own walls.
 * The seam is real rather than convenient: everything here is plugin-directory state whose
 * lifetime is the session, which is the one property none of them shares with the root.
 *
 * Neither path is built inside its store, which is how `SequenceMarkerFileStore` already
 * worked: a store takes the path it was given, and the composition site is what knows the
 * plugin directory.
 */
export class SessionStores {
	readonly markers: SequenceMarkerFileStore;

	readonly incidents: WriteIncidentRegistry;

	// `pluginDir` is `Manifest.dir`, which Obsidian declares OPTIONAL. It is interpolated
	// rather than defaulted, which is verbatim what the call site did before this extraction —
	// changing it here would relocate a path this session already reads and writes.
	constructor(adapter: TextFileAdapter, pluginDir: string | undefined, logger: Logger) {
		this.markers = new SequenceMarkerFileStore(adapter, `${pluginDir}/sequence-markers.json`, logger);
		// Installed at CONSTRUCTION, not at seeding, so the gate exists from load. It answers
		// "nothing open" until `seed()` resolves, which leaves a window at startup in which a
		// write recorded by a previous session is not yet blocking — the same window
		// `recoverInterruptedSequences` runs in, and not one this task closes.
		this.incidents = new WriteIncidentRegistry(new WriteIncidentFileStore(adapter, `${pluginDir}/write-incidents.json`), logger);
		installWriteIncidentRegistry(this.incidents);
	}

	/** A global this code installs is a global this code removes — `onunload`'s half. */
	dispose(): void {
		installWriteIncidentRegistry(null);
	}
}
