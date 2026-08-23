import { PluginSettingTab, type SettingDefinitionItem } from 'obsidian';
import { tr } from '../../presentation/i18n/strings';
import { DEFAULT_SETTINGS, UNITS, settingsFrom, type RenovationPlannerSettings } from './settings';
import type RenovationPlannerPlugin from '../RenovationPlannerPlugin';

/**
 * The settings tab: what a user sees under Settings → Community plugins → Renovation
 * Planner.
 *
 * It lives in `plugin/` beside the settings it edits, not in `presentation/`, and the
 * dependency rule is why: a tab reads and writes the plugin's own state, so it needs the
 * plugin instance — which `presentation/` may not import (`eslint.config.mjs`). The SDD's
 * §77 puts `settings/` under `plugin/` for the same reason.
 *
 * **Declarative, not `display()`.** Obsidian 1.13 renders a tab from the definitions
 * `getSettingDefinitions()` returns, calls `display()` only when that array is empty, and
 * indexes the definitions for the settings SEARCH — which an imperatively drawn pane is
 * absent from. `manifest.json`'s floor is 1.13.0, so there is no older app to keep a
 * `display()` fallback for, and `eslint-plugin-obsidianmd` fails the build for a tab that
 * implements neither.
 *
 * There is no heading and no plugin name among the definitions: Obsidian draws the plugin's
 * name itself, and repeating it is a recurring marketplace review rejection.
 */
export class SettingsTab extends PluginSettingTab {
	constructor(private readonly host: RenovationPlannerPlugin) {
		super(host.app, host);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		// `tr` resolves the language per call, and this runs on every render — which is
		// what keeps the pane correct after Obsidian's own language setting changes.
		return [
			{
				name: tr('settings.units.name'),
				desc: tr('settings.units.desc'),
				control: {
					type: 'dropdown',
					key: 'units',
					// Options from the vocabulary rather than written out again: a third unit
					// system would otherwise be settable in `settings.ts` and unreachable here.
					options: Object.fromEntries(UNITS.map((unit) => [unit, tr(`settings.units.${unit}`)])),
					defaultValue: DEFAULT_SETTINGS.units,
				},
			},
		];
	}

	/**
	 * Where a control reads from. The base class reads Obsidian's OWN config, which is not
	 * where a plugin's settings live, so both halves are overridden as the typings ask.
	 *
	 * Keyed generically rather than per setting: a definition's `key` above is a field of
	 * `RenovationPlannerSettings`, so a second setting needs no second branch here.
	 */
	getControlValue(key: string): unknown {
		return this.host.root.settings[key as keyof RenovationPlannerSettings];
	}

	/**
	 * And where it writes. Through `settingsFrom` — the same gate `loadData` passes through —
	 * so every value a control can produce is validated by one function, an unrecognised one
	 * falls back to the default instead of reaching the file, and a key this version does not
	 * declare is dropped rather than persisted forever.
	 */
	setControlValue(key: string, value: unknown): Promise<void> {
		return this.host.saveSettings(settingsFrom({ ...this.host.root.settings, [key]: value }));
	}
}
