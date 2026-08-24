/**
 * @vitest-environment jsdom
 *
 * The settings pane's whole contract, driven the way Obsidian drives it: read the
 * definitions it declares, ask it for a key's current value, hand it a new one.
 *
 * This is the file that would have caught "I cannot see the settings in Obsidian" — the
 * settings existed, were loaded and were merged, and nothing ever declared them.
 *
 * Nothing here asserts markup: since 1.13 the app renders the controls from the
 * definitions, so what the pane looks like is Obsidian's answer and only a live vault's.
 */
import { describe, expect, it } from 'vitest';
import { SettingsTab } from '../../../src/plugin/settings/SettingsTab';
import { DEFAULT_SETTINGS, UNITS } from '../../../src/plugin/settings/settings';
import { t } from '../../../src/presentation/i18n/strings';
import { loadedPlugin } from '../../helpers/plugin';

const withStored = async (stored: unknown) => {
	const { plugin } = await loadedPlugin(stored);
	// The tab `onload` registered, not one built for the test: a test that builds its own
	// passes while nothing is ever registered, which is exactly the defect this file exists
	// for.
	return { plugin, tab: plugin.settingTabs[0] as unknown as SettingsTab };
};

/** The one control there is, found by its key rather than by position. */
const unitsControl = (tab: SettingsTab) => {
	const found = tab.getSettingDefinitions().find((item) => 'control' in item && item.control?.key === 'units');
	if (found === undefined || !('control' in found)) throw new Error('no units control declared');
	return found;
};

describe('the settings pane', () => {
	it('is registered exactly once, and by the plugin', async () => {
		const { plugin, tab } = await withStored(null);

		expect(plugin.settingTabs).toHaveLength(1);
		expect(tab).toBeInstanceOf(SettingsTab);
	});

	// Through the string table, not a literal: the subject is that the pane is wired
	// through `tr()`, and sentence case is the en.ts lint's job.
	it('declares the units setting with a name and a description', async () => {
		const { tab } = await withStored(null);

		const units = unitsControl(tab);

		expect(units.name).toBe(t('en', 'settings.units.name'));
		expect(units.desc).toBe(t('en', 'settings.units.desc'));
	});

	// Every unit the vocabulary declares is offered, so a third one cannot be settable in
	// `settings.ts` and unreachable in the pane.
	it('offers every unit in the vocabulary', async () => {
		const { tab } = await withStored(null);

		const control = unitsControl(tab).control;

		expect(control?.type).toBe('dropdown');
		expect(Object.keys(control?.type === 'dropdown' ? control.options : {})).toEqual([...UNITS]);
	});

	it('answers the stored value for the control key', async () => {
		const { tab } = await withStored({ ...DEFAULT_SETTINGS, units: 'imperial' });

		expect(tab.getControlValue('units')).toBe('imperial');
	});

	// data.json is user-editable. A junk value must not reach the control, or the pane shows
	// a state the plugin is not in.
	it('answers the default for a stored value it does not recognise', async () => {
		const { tab } = await withStored({ units: 'furlongs' });

		expect(tab.getControlValue('units')).toBe('metric');
	});

	it('writes a change through to data.json', async () => {
		const { plugin, tab } = await withStored(null);

		await tab.setControlValue('units', 'imperial');

		expect(plugin.root.settings).toEqual({ ...DEFAULT_SETTINGS, units: 'imperial' });
		expect(plugin.saved).toEqual([{ ...DEFAULT_SETTINGS, units: 'imperial' }]);
	});

	/**
	 * The same gate the load path uses, at the write end too. A control that handed back
	 * something else — a stale option, a future free-text field — must not put it in the
	 * file, because what is written today is what `settingsFrom` has to survive tomorrow.
	 */
	it('refuses to persist a value outside the vocabulary', async () => {
		const { plugin, tab } = await withStored(null);

		await tab.setControlValue('units', 'furlongs');

		expect(plugin.root.settings).toEqual({ ...DEFAULT_SETTINGS });
		expect(plugin.saved).toEqual([{ ...DEFAULT_SETTINGS }]);
	});

	/** And a key this version does not declare is dropped rather than persisted forever. */
	it('does not persist a key it does not declare', async () => {
		const { plugin, tab } = await withStored(null);

		await tab.setControlValue('currency', 'EUR');

		expect(plugin.saved).toEqual([{ ...DEFAULT_SETTINGS }]);
	});

	/**
	 * A setting the user has changed stays changed when another one is written. It passes
	 * trivially with one setting and is the first thing a per-key write would break, so it is
	 * here now rather than after the second setting arrives and nobody thinks to add it.
	 */
	it('keeps the other settings when one is written', async () => {
		const { plugin, tab } = await withStored({ ...DEFAULT_SETTINGS, units: 'imperial' });

		await tab.setControlValue('currency', 'EUR');

		expect(plugin.root.settings).toEqual({ ...DEFAULT_SETTINGS, units: 'imperial' });
	});
});
