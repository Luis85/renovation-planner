/**
 * The plugin settings. The SDD names their categories (§15: default units, default
 * folders, editor preferences); a field arrives here when a feature reads it, and `units`
 * is first because quantities are the first thing the domain will measure.
 *
 * `settingsFrom` is pure — a merge over defaults — so a node test drives every shape
 * `data.json` can hold without the Obsidian runtime. The `loadData` and `saveData` calls
 * stay in the plugin shell, the layer allowed to name them, and the tab that shows these
 * values is `SettingsTab.ts` beside this file.
 *
 * **`data.json` is a file the user can edit, so this is a trust boundary rather than a
 * formality.** A spread over the defaults accepts whatever it is handed: `units:
 * 'furlongs'` would type as `Units` and reach every reader, and an unknown key would be
 * carried forward for as long as the file exists. So each field is read through its own
 * validator and the result is built explicitly — what this returns holds only the fields
 * this file declares, each with a value it recognises.
 */

/** The vocabulary, and the single place it is written down. */
export const UNITS = ['metric', 'imperial'] as const;
export type Units = (typeof UNITS)[number];

export interface RenovationPlannerSettings {
	/** Measurement system for quantities and dimensions (SDD §15: default units). */
	units: Units;
}

export const DEFAULT_SETTINGS: RenovationPlannerSettings = {
	units: 'metric',
};

/**
 * The one gate a unit value passes through, whether it came from `data.json` or from the
 * pane. Not exported: every caller goes through `settingsFrom` below — the tab included,
 * which is what makes "validated once, in one place" true of the write path as well as the
 * read path. Export it the day a caller needs one field without the others.
 */
function unitsFrom(value: unknown): Units {
	return UNITS.find((unit) => unit === value) ?? DEFAULT_SETTINGS.units;
}

/** `loadData` answers whatever data.json holds: an object, null on a fresh install, or junk. */
export function settingsFrom(raw: unknown): RenovationPlannerSettings {
	const stored = typeof raw === 'object' && raw !== null ? (raw as Partial<RenovationPlannerSettings>) : {};
	return { units: unitsFrom(stored.units) };
}
