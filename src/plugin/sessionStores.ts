import type { Logger } from '../application/ports/Logger';
import {
	WriteIncidentRegistry,
	activeWriteIncidentRegistry,
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

	/** Named for what it HOLDS, not for what `guardCommand` asks of it — a reader reaching for
	 * `stores.incidents.list()` on a registry (it has no such method; `WriteIncidentStore.list()`
	 * lives on the file store this wraps) is the confusion this name exists to prevent. */
	readonly writeIncidents: WriteIncidentRegistry;

	// `pluginDir` is `Manifest.dir`, which Obsidian declares OPTIONAL. It is interpolated
	// rather than defaulted, which is verbatim what the call site did before this extraction —
	// changing it here would relocate a path this session already reads and writes.
	constructor(adapter: TextFileAdapter, pluginDir: string | undefined, logger: Logger) {
		this.markers = new SequenceMarkerFileStore(adapter, `${pluginDir}/sequence-markers.json`, logger);
		// Installed at CONSTRUCTION, not at seeding, so the gate exists from load. It answers
		// "nothing open" until `seed()` resolves, which leaves a window at startup in which a
		// write recorded by a previous session is not yet blocking — the same window
		// `recoverInterruptedSequences` runs in, and not one this task closes.
		// Spelled ONCE and handed to both: the store READS and WRITES it, the registry only
		// NAMES it for the diagnostics report (ADR-0034's discoverable retirement gesture). Two
		// spellings of one path is how a report starts pointing at a file that is not the one
		// being written.
		const incidentsPath = `${pluginDir}/write-incidents.json`;
		this.writeIncidents = new WriteIncidentRegistry(new WriteIncidentFileStore(adapter, incidentsPath), logger, incidentsPath);
		installWriteIncidentRegistry(this.writeIncidents);
	}

	/**
	 * A global this code installs is a global this code removes — `onunload`'s half, and the
	 * exact pattern `konvaGlobal.ts`'s `claimKonvaGlobal` already carries for the same reason:
	 * release only while the global is still the one THIS instance claimed.
	 *
	 * **Unconditional release was the defect.** Two overlapping `SessionStores` — which the
	 * suite produces routinely within a single test file (a second `loadedPlugin()` before the
	 * first is disposed) and which a real reload race can produce in a vault — means session
	 * A's `dispose()` used to null out whatever was installed, including session B's registry
	 * if B loaded after A but before A unloaded. The gate then answers "nothing open" over a
	 * vault B's own incidents say is half-written. Comparing identity first is what keeps this
	 * to releasing exactly what this instance added, never a later instance's replacement.
	 *
	 * **An OPEN registry is not released at all, and that is the lifecycle contract's rule 3 —
	 * a refusal is not cleared by a teardown.** `onunload` unmounts no Vue app and detaches no
	 * leaf, so every view is still mounted and still able to dispatch when this runs. Releasing
	 * an open registry there disarms all three of its readers at once: `guardCommand` skips its
	 * refusal arm (`incidents !== null && incidents.anyOpen()`), `withIncidentGate`'s `paused()`
	 * answers `false` through its `?? false`, and `void incidents?.record(…)` stops recording.
	 * Measured on a rig driving the plugin's own registered view factory: the identical
	 * `createZone` was refused with `write-incident.writes-paused` before `onunload` and wrote a
	 * note after it, and an Undo refused before ran its inverse after
	 * (`tests/plugin/unloadWithViewOpen.test.ts`).
	 *
	 * The sentence above about session B is true verbatim of that case too — the gate answering
	 * "nothing open" over a vault this session's own incidents say is half-written — reached
	 * from teardown rather than from an overlap.
	 *
	 * A CLEAN registry is still released: there is no refusal to keep, so the removal rule has
	 * nothing to argue with. What that leaves open, unchanged from before this term existed: a
	 * guarded write dispatched after `onunload` in a session that had nothing open fails with
	 * its uncompensated writes unrecorded. Closing that means never releasing, which is wider
	 * than rule 3 asks for; the trade is costed in
	 * `.superpowers/sdd/01-improvement-plan/s8-f3-fix-report.md`.
	 */
	dispose(): void {
		if (activeWriteIncidentRegistry() !== this.writeIncidents) return;
		if (this.writeIncidents.anyOpen()) return;
		installWriteIncidentRegistry(null);
	}
}
