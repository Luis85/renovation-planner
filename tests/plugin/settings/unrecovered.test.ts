import { DEFAULT_SETTINGS } from '../../../src/plugin/settings/settings';
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
import { GEOMETRY_SIDECAR_VIEW } from '../../../src/presentation/views/GeometrySidecarView';
import { PLAN_EDITOR_VIEW } from '../../../src/presentation/views/PlanEditorView';
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

/**
 * The other way in: `loadData()` RESOLVED with nothing while the file is on disk — which is
 * what Obsidian hands a plugin for a `data.json` it could not parse.
 */
const unparseable = async (raw: unknown = null) => {
	const { plugin } = await loadedPlugin(raw, undefined, true);
	return { plugin, tab: plugin.settingTabs[0] as unknown as SettingsTab };
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

		expect([...plugin.views.keys()]).toEqual([RENOVATION_PROJECT_VIEW, PLAN_EDITOR_VIEW, GEOMETRY_SIDECAR_VIEW]);
		expect(plugin.commands.map((command) => command.id)).toEqual(['open-project', 'open-plan-editor', 'set-plan-background']);
	});
});

describe('the two writers, refused independently', () => {
	it('makes no saveData call for the whole session', async () => {
		const { plugin } = await unrecovered();

		await plugin.saveSettings({ ...DEFAULT_SETTINGS, units: 'imperial' });

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

/**
 * The case a real vault found and no test here could have: Obsidian's `loadData()` does NOT
 * reject when `data.json` will not parse. It catches the `JSON.parse` failure itself, logs
 * `failed to read JSON …` on its own side, and RESOLVES EMPTY — so the shape a fresh install
 * produces and the shape a corrupt file produces are the same shape.
 *
 * Walked in Obsidian 1.13 against a `data.json` containing `{`: no `settings.load.failed`
 * line was logged, and the settings pane offered a working units dropdown — which is the
 * decisive evidence, since an unrecovered tab offers no control at all. The refusal never
 * engaged, and the pane then accepted a write that replaced the file with defaults.
 *
 * The file's EXISTENCE is the discriminator, and these are the cases that pin it.
 */
describe('a file Obsidian could not parse, which it reports by resolving empty', () => {
	it('leaves the settings unrecovered rather than defaulted', async () => {
		const { plugin } = await unparseable();

		expect(plugin.root.settings).toBeNull();
	});

	/**
	 * A DIFFERENT event from `settings.load.failed`, and deliberately so: that one carries a
	 * `cause` because an exception was caught, and this one cannot — Obsidian swallowed the
	 * error before the plugin saw it. One name per thing that actually happened is what makes
	 * either greppable.
	 */
	it('logs one error naming the unreadable file, with no cause to forward', async () => {
		const { plugin } = await unparseable();
		void plugin;

		const errors = lines.filter((line) => line.level === 'error');

		expect(errors).toHaveLength(1);
		expect(errors[0].event).toBe('settings.load.unreadable');
		expect(errors[0].context).toBeUndefined();
	});

	it('refuses both writers, exactly as a rejection does', async () => {
		const { plugin, tab } = await unparseable();

		await plugin.saveSettings({ ...DEFAULT_SETTINGS, units: 'imperial' });
		await tab.setControlValue('units', 'imperial');

		expect(plugin.saved).toEqual([]);
		expect(tab.getSettingDefinitions().filter((item) => 'control' in item && item.control !== undefined)).toEqual([]);
	});

	/**
	 * Whether `loadData()` answers `null` or `{}` for an unparseable file is Obsidian's
	 * business and undocumented, so both are treated the same. The cost is named rather than
	 * glossed: a `data.json` holding literally `{}` reads as unreadable. That is not a state
	 * this plugin produces — `saveSettings` always writes a complete settings object — and
	 * refusing to write over a file nothing can make sense of is the direction this whole
	 * boundary exists to take.
	 */
	it('treats an empty object the same as nothing at all', async () => {
		const { plugin } = await unparseable({});

		expect(plugin.root.settings).toBeNull();
	});

	// The path is built and normalized for real, so what the probe asked about is asserted
	// rather than assumed — a probe pointed at the wrong folder answers "no file", which is
	// the fresh-install answer, which is the wrong one.
	it('asks about the plugin data file inside the vault config directory', async () => {
		const { asked } = await loadedPlugin(null, undefined, true);

		expect(asked).toEqual(['.obsidian/plugins/renovation-planner/data.json']);
	});

	/**
	 * The probe is only consulted when there is nothing to interpret. A readable file needs
	 * no filesystem question, and asking one anyway would be a vault read on every load.
	 */
	it('does not ask when loadData answered with data', async () => {
		const { asked } = await loadedPlugin({ ...DEFAULT_SETTINGS, units: 'imperial' });

		expect(asked).toEqual([]);
	});
});

describe('a fresh install, which is the opposite outcome', () => {
	it('loads the defaults, saves normally and renders its controls', async () => {
		const { plugin } = await loadedPlugin(null);
		const tab = plugin.settingTabs[0] as unknown as SettingsTab;

		expect(plugin.root.settings).toEqual({ ...DEFAULT_SETTINGS });
		// Two controls now: units, and the slice-4 project folder (the one location field).
		expect(tab.getSettingDefinitions()).toHaveLength(2);

		await plugin.saveSettings({ ...DEFAULT_SETTINGS, units: 'imperial' });

		expect(plugin.saved).toEqual([{ ...DEFAULT_SETTINGS, units: 'imperial' }]);
	});

	it('logs no error', async () => {
		await loadedPlugin(null);

		expect(lines.filter((line) => line.level === 'error')).toEqual([]);
	});
});
