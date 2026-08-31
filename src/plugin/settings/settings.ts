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

import { currencyOf, type Currency } from '../../core/money/Money';

/** The vocabulary, and the single place it is written down. */
export const UNITS = ['metric', 'imperial'] as const;
export type Units = (typeof UNITS)[number];

/**
 * The vocabulary, and the single place it is written down — the same shape as `UNITS`.
 *
 * **Two minor units, every one of them.** `Money.round` finalizes at two decimal places
 * (`MINOR_UNIT_PLACES`), so a zero-minor-unit currency such as JPY would round every total
 * wrong. This list is the bound on the DEFAULT and not on a hand-written note: an asset
 * note's own `currency` passes `/^[A-Z]{3}$/` and is outside what this constrains.
 *
 * Minted through `currencyOf`, so the brand has exactly one origin and this file holds no
 * cast of its own.
 */
export const CURRENCIES: readonly Currency[] = ['CHF', 'EUR', 'GBP', 'USD'].map((code) => currencyOf(code));

/**
 * The root a NEW project's folder is created under, not the folder every entity lives in
 * (ADR-0013: a project's own folder is now derived from where its note sits).
 */
const DEFAULT_PROJECT_FOLDER = 'Renovation';

/**
 * §36's drawing, and it is only legal because slice 18 landed first: under the pre-18 shape
 * `Renovation` WAS the project folder, so `foldersOverlap('Renovation/Library',
 * 'Renovation')` is true and the default would be refused by the rule §83 states. After
 * slice 18 the project folders are `Renovation/Kitchen refit` and friends, and the library
 * is their sibling.
 */
const DEFAULT_LIBRARY_FOLDER = 'Renovation/Library';

export interface RenovationPlannerSettings {
	/** Measurement system for quantities and dimensions (SDD A§15: default units). */
	units: Units;
	/**
	 * The root a new project's folder is created under (ADR-0013). It is not "where every
	 * entity lives" any more: a project's own folder is derived from where its note sits,
	 * so this field has exactly one job left, and an existing project's folder does not
	 * move when this setting changes. A path is not a preference: with settings unrecovered
	 * there is no correct default, which is why nothing composes against one.
	 */
	projectFolder: string;
	/**
	 * Where the shared Asset (and later Supplier and Trade) catalogues live — one per vault
	 * (§83). Unlike `projectFolder` this is not "where a new one starts": it is where the
	 * catalogue IS, so changing it MOVES the notes. ADR-011 priced a configurable path as
	 * something to avoid where it can be avoided; here it cannot, because a shared library
	 * has no project folder to derive its location from.
	 *
	 * **`Assets/` is the only thing under it, and `Suppliers/`/`Trades/` are deliberately
	 * NOT created**: the rule names three catalogues and two of them do not exist as
	 * entities — `Asset.supplier` is free text and `Trade` is Epic 8 — so a folder with
	 * nothing that can live in it is a promise rather than a structure. The field is named
	 * for the LIBRARY rather than for assets for that reason: those two arrive by adding a
	 * repository that resolves its own subfolder from this root, not by moving this one.
	 */
	libraryFolder: string;
	/**
	 * The currency a NEW project starts from (§83), and the value a project note with no
	 * `currency:` key reads as. It is a default with a project counterpart, which is the
	 * test [[Settings and configuration]] states for which settings are defaults.
	 *
	 * **A project that never stated one FOLLOWS this value** until something saves that
	 * note, at which point `projectToPersistence` writes it and it stops floating. For a
	 * single-currency vault that is the feature; for a two-currency vault it is a footgun,
	 * and `GetRequirementsForZone`'s backstop is what makes it visible.
	 */
	defaultCurrency: Currency;
	/**
	 * Verbose logging (slice 11): drops the console logger's floor from `info` to
	 * `debug`. Diagnostics, not telemetry — everything stays in the local console
	 * (SDD §67), this only widens what reaches it.
	 */
	verboseLogging: boolean;
}

/**
 * What a settings write CHANGES, rather than what the settings become.
 *
 * A complete settings object composed by the caller is a SNAPSHOT, and a snapshot is stale
 * for as long as any other write is in flight — which is the whole of the library
 * migration's window, since it persists LAST and swaps the running root only afterwards. A
 * patch says the one thing its caller meant and lets the write chain compose the rest at
 * execution time, so two changes made in that window both survive and neither replays a
 * folder the catalogue has left.
 *
 * Values are `unknown` because the settings pane is keyed generically — a control's value is
 * whatever Obsidian hands `setControlValue` — and `settingsFrom` is the gate every one of
 * them passes through. Typing them tighter would put a cast at the one door that exists so
 * there is no cast.
 */
export type SettingsPatch = Readonly<Partial<Record<keyof RenovationPlannerSettings, unknown>>>;

export const DEFAULT_SETTINGS: RenovationPlannerSettings = {
	units: 'metric',
	projectFolder: DEFAULT_PROJECT_FOLDER,
	libraryFolder: DEFAULT_LIBRARY_FOLDER,
	defaultCurrency: currencyOf('EUR'),
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
 * The one gate a currency value passes through, whether it came from `data.json` or from
 * the pane — `unitsFrom`'s shape exactly. Not `parseCurrency`: the question here is not
 * "is this a well-formed code" but "is this one of the codes this pane offers", which is
 * strictly narrower and is what keeps a JPY in `data.json` from reaching `round`.
 */
function currencyFrom(value: unknown): Currency {
	return CURRENCIES.find((code) => code === value) ?? DEFAULT_SETTINGS.defaultCurrency;
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
 * Whether a folder path is usable as one. Empty after trimming is the only refusal: a path
 * is user text, `normalizePath` is applied where it meets the Vault, and anything non-empty
 * is a place. The `fallback` parameter is what lets one validator serve both folder
 * settings — the alternative was a second function differing only in its default.
 */
function folderFrom(value: unknown, fallback: string): string {
	return typeof value === 'string' && value.trim() ? value.trim() : fallback;
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
		projectFolder: folderFrom(stored.projectFolder, DEFAULT_SETTINGS.projectFolder),
		libraryFolder: folderFrom(stored.libraryFolder, DEFAULT_SETTINGS.libraryFolder),
		defaultCurrency: currencyFrom(stored.defaultCurrency),
		verboseLogging: verboseLoggingFrom(stored.verboseLogging),
	};
}
