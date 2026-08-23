/**
 * @vitest-environment jsdom
 *
 * What happens when `data.json` cannot be READ — and, beside it, what happens when there
 * simply is none.
 *
 * The two are one line apart in `onload` and produce opposite outcomes: a rejection is
 * unrecovered and must never be written over, while a resolved `null` is a fresh install
 * that loads defaults and saves normally. Both writers are asserted independently, because
 * either one alone still overwrites the file the user still has.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installObsidianDom } from '../../helpers/dom';
import { lines, resetRecorder } from '../../helpers/logger';
import { loadedPlugin } from '../../helpers/plugin';
import { RENOVATION_PROJECT_VIEW } from '../../../src/presentation/views/RenovationProjectView';
import { t } from '../../../src/presentation/i18n/strings';
import { SettingsTab } from '../../../src/plugin/settings/SettingsTab';

vi.mock('../../../src/infrastructure/logging/consoleLogger', async () => (await import('../../helpers/logger')).consoleLoggerMock());

installObsidianDom();

const CAUSE = new Error('data.json is a directory');

const unrecovered = async () => {
	const { plugin, workspace } = await loadedPlugin(null, CAUSE);
	return { plugin, workspace, tab: plugin.settingTabs[0] as unknown as SettingsTab };
};

beforeEach(() => {
	resetRecorder();
});

describe('a read that failed', () => {
	// Asserted as null SPECIFICALLY: a test written against "defaults are present" passes
	// against the version that hands a wrong folder path to slice 4.
	it('leaves the settings unrecovered rather than defaulted', async () => {
		const { plugin } = await unrecovered();

		expect(plugin.root.settings).toBeNull();
	});

	it('logs exactly one error, naming the event and forwarding the cause', async () => {
		await unrecovered();

		const errors = lines.filter((line) => line.level === 'error');

		expect(errors).toHaveLength(1);
		expect(errors[0].event).toBe('settings.load.failed');
		expect(errors[0].context?.cause).toBe(CAUSE);
	});

	// The plugin still loads and the view still opens; the failure is visible in the one
	// place a user would look for it.
	it('registers the view and the command anyway', async () => {
		const { plugin } = await unrecovered();

		expect([...plugin.views.keys()]).toEqual([RENOVATION_PROJECT_VIEW]);
		expect(plugin.commands.map((command) => command.id)).toEqual(['open-project']);
	});
});

describe('the two writers, refused independently', () => {
	it('makes no saveData call for the whole session', async () => {
		const { plugin } = await unrecovered();

		await plugin.saveSettings({ units: 'imperial' });

		expect(plugin.saved).toEqual([]);
	});

	/**
	 * The second guard, and the one that makes the first hold for a control nobody has
	 * written yet: the tab writes on every control change, so while unrecovered it offers
	 * no control that could.
	 *
	 * Asserted as "no item carries a control", not as "the array is empty": the array is
	 * NOT empty — it holds the reason — and a test written against emptiness would have to
	 * be rewritten by the first version that explains itself to the user.
	 */
	it('offers no control Obsidian could write through', async () => {
		const { tab } = await unrecovered();

		const withControls = tab.getSettingDefinitions().filter((item) => 'control' in item && item.control !== undefined);

		expect(withControls).toEqual([]);
	});

	/**
	 * The reason reaches the user as a DEFINITION rather than through the deprecated
	 * `display()` fallback, which is what puts it in Obsidian's settings search index —
	 * and what keeps `obsidianmd/settings-tab/no-deprecated-display` satisfied without a
	 * local override the marketplace review bot would not honour.
	 */
	it('declares the reason as a text-only definition', async () => {
		const { tab } = await unrecovered();

		expect(tab.getSettingDefinitions().map((item) => 'name' in item && item.name)).toContain(t('en', 'settings.unrecovered'));
	});

	/**
	 * Asked of THIS class's own prototype rather than of an instance: the real
	 * `PluginSettingTab` base class does declare `display()`, so an instance property check
	 * would answer for the inheritance chain and pass or fail on what the fake happens to
	 * carry. What is being checked is that `SettingsTab` declares no override of it.
	 */
	it('declares no display override of its own', () => {
		expect(Object.hasOwn(SettingsTab.prototype, 'display')).toBe(false);
	});

	it('answers nothing for a control key', async () => {
		const { tab } = await unrecovered();

		expect(tab.getControlValue('units')).toBeUndefined();
	});

	it('persists nothing even if a control writes', async () => {
		const { plugin, tab } = await unrecovered();

		await tab.setControlValue('units', 'imperial');

		expect(plugin.saved).toEqual([]);
	});
});

describe('a fresh install, which is the opposite outcome', () => {
	it('loads the defaults, saves normally and renders its controls', async () => {
		const { plugin } = await loadedPlugin(null);
		const tab = plugin.settingTabs[0] as unknown as SettingsTab;

		expect(plugin.root.settings).toEqual({ units: 'metric' });
		expect(tab.getSettingDefinitions()).toHaveLength(1);

		await plugin.saveSettings({ units: 'imperial' });

		expect(plugin.saved).toEqual([{ units: 'imperial' }]);
	});

	it('logs no error', async () => {
		await loadedPlugin(null);

		expect(lines.filter((line) => line.level === 'error')).toEqual([]);
	});
});
