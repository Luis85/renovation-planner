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

/** Where entity notes live; `Geometry/` is derived inside it, never configured (ADR-011). */
const DEFAULT_PROJECT_FOLDER = 'Renovation';

export interface RenovationPlannerSettings {
	/** Measurement system for quantities and dimensions (SDD A§15: default units). */
	units: Units;
	/**
	 * The folder every Project/Plan/Zone note lives under — THE one location field
	 * (ADR-011). A path is not a preference: with settings unrecovered there is no
	 * correct default, which is why nothing composes against one.
	 */
	projectFolder: string;
	/**
	 * Verbose logging (slice 11): drops the console logger's floor from `info` to
	 * `debug`. Diagnostics, not telemetry — everything stays in the local console
	 * (SDD §67), this only widens what reaches it.
	 */
	verboseLogging: boolean;
}

export const DEFAULT_SETTINGS: RenovationPlannerSettings = {
	units: 'metric',
	projectFolder: DEFAULT_PROJECT_FOLDER,
	verboseLogging: false,
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

/**
 * Whether `loadData()` answered with nothing to interpret.
 *
 * This is not the same question as "is there a file", and the difference is the whole
 * reason it exists. Obsidian's `loadData()` does NOT reject when `data.json` will not
 * parse — it catches the `JSON.parse` failure itself, logs it on its own side, and resolves
 * EMPTY — so a fresh install and a corrupt file arrive here wearing one shape. Pairing this
 * with `PluginDataProbe` is what separates them: nothing AND no file is a fresh install,
 * nothing AND a file is a file nobody can read.
 *
 * `{}` counts as nothing, and whether Obsidian answers `null` or `{}` for an unparseable
 * file is undocumented, so both are treated alike. The cost, named: a `data.json` holding
 * literally `{}` reads as unreadable. That is not a state this plugin produces —
 * `saveSettings` always writes a complete settings object — and over-refusing a write is
 * the safe direction where under-refusing one destroys what the user still has.
 */
export function isDataAbsent(raw: unknown): boolean {
	if (raw === null || raw === undefined) return true;

	return typeof raw === 'object' && Object.keys(raw).length === 0;
}

/**
 * Whether a folder path is usable as one. Empty after trimming is the only refusal: a
 * path is user text, `normalizePath` is applied where it meets the Vault, and anything
 * non-empty is a place.
 */
function projectFolderFrom(value: unknown): string {
	return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_SETTINGS.projectFolder;
}

/**
 * A boolean is a boolean or it is the default — `data.json` may hold `1`, `"true"` or a
 * sentence, and none of those is a preference this plugin recognises.
 */
function verboseLoggingFrom(value: unknown): boolean {
	return typeof value === 'boolean' ? value : DEFAULT_SETTINGS.verboseLogging;
}

/** `loadData` answers whatever data.json holds: an object, null on a fresh install, or junk. */
export function settingsFrom(raw: unknown): RenovationPlannerSettings {
	const stored = typeof raw === 'object' && raw !== null ? (raw as Partial<RenovationPlannerSettings>) : {};
	return {
		units: unitsFrom(stored.units),
		projectFolder: projectFolderFrom(stored.projectFolder),
		verboseLogging: verboseLoggingFrom(stored.verboseLogging),
	};
}
