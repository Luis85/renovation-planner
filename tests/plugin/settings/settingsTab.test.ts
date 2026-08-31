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
import { beforeEach, describe, expect, it } from 'vitest';
import type { SettingDefinition, SettingDefinitionAction, SettingDefinitionItem } from 'obsidian';
// `opened`, `shown`, `choose` and `chooseAfterClose` exist on the MOCK and not on the real
// surface, so they are imported from it by name — the migration main completed in #46/#47.
import { FuzzySuggestModal, Notice } from '../../helpers/obsidian-mock';
import { SettingsTab } from '../../../src/plugin/settings/SettingsTab';
import { DEFAULT_SETTINGS, UNITS } from '../../../src/plugin/settings/settings';
import type RenovationPlannerPlugin from '../../../src/plugin/RenovationPlannerPlugin';
import { t } from '../../../src/presentation/i18n/strings';
import { loadedPlugin } from '../../helpers/plugin';
import { installObsidianDom } from '../../helpers/dom';
import { settle } from '../../helpers/async';

// `activateNotices` — reached here through the real plugin/editor wiring — appends its
// two live regions with Obsidian's `createDiv`, one of the prototype extensions the app
// installs globally and this suite installs per file.
installObsidianDom();

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

	/**
	 * The library folder row, and the whole of its contract is what it does NOT declare.
	 * `setControlValue` writes through `saveSettings` the instant a control changes, so a
	 * control keyed to `libraryFolder` would persist a new path with no notes moved — and the
	 * migration that moves them reads the setting as the folder to move FROM, so it would then
	 * search the new empty folder and strand the catalogue. The row is a name and a
	 * description; the move is an action, and it belongs to the step that moves the notes.
	 */
	it('declares the library folder without binding a control to it', async () => {
		const { tab } = await withStored(null);

		const row = tab.getSettingDefinitions().find((item) => item.name === t('en', 'settings.library-folder.name'));

		expect(row).toBeDefined();
		expect(row && 'control' in row ? row.control : undefined).toBeUndefined();
	});

	// The current folder rides in the description, so the pane says where the catalogue is
	// without offering a control that would move the setting off it.
	it('names the current library folder in the row description', async () => {
		const { tab } = await withStored({ ...DEFAULT_SETTINGS, libraryFolder: 'Shared/Catalogue' });

		const row = tab.getSettingDefinitions().find((item) => item.name === t('en', 'settings.library-folder.name'));

		expect(row?.desc).toBe(t('en', 'settings.library-folder.current', { folder: 'Shared/Catalogue' }));
		expect(row?.desc).toContain('Shared/Catalogue');
	});
});

/**
 * The library move, which is the only writer of `libraryFolder` there is.
 *
 * Every case here drives the ACTION the definition declares rather than a method invented
 * for the test: a tab that stopped declaring the row would keep passing a test that called
 * its handler directly, and the row is the whole of what a user can reach.
 */
const moveRow = (tab: SettingsTab): SettingDefinitionAction => {
	const found = tab.getSettingDefinitions().find((item) => item.name === t('en', 'settings.library-folder.move.name'));
	// Narrowed on the VALUE, not with `'action' in found`: `SettingDefinitionRender` and
	// `SettingDefinitionControl` both declare `action?: never`, so the key is present in every
	// member of the union and the `in` test leaves it possibly undefined. A non-null assertion
	// is not the alternative — `typescript/no-non-null-assertion` is an error in this repo.
	if (found === undefined || typeof found.action !== 'function') {
		throw new Error('no library move action declared');
	}
	return found;
};

/**
 * The library row's description, which is where the CURRENT folder is shown.
 *
 * Takes the WIDE `SettingDefinitionItem[]`, because one of its two callers is Obsidian's own
 * `tab.settingItems` — the rendered items, which really can hold groups, lists and pages. The
 * predicate narrows to a plain row, and the name match is what makes it exact: this tab
 * declares no group, and none of the wider members would carry this name if it did.
 */
const currentFolderRow = (items: readonly SettingDefinitionItem[]): SettingDefinition | undefined =>
	items.find((item): item is SettingDefinition =>
		'name' in item && item.name === t('en', 'settings.library-folder.name'));

interface VaultEquipment {
	folders?: string[];
	files?: string[];
	renameFile?: (file: { path: string }, to: string) => Promise<void>;
}

/**
 * The three vault members the migration reaches and `loadedPlugin`'s stub does not model:
 * folder enumeration for the picker, the catalogue's own files, and the two writes.
 * Patched onto the stub rather than added to `VaultSurface`, because nothing else in the
 * suite reads any of them — a fake member nothing exercises cannot be caught drifting.
 */
function equipVault(plugin: RenovationPlannerPlugin, equipment: VaultEquipment): { renamed: string[] } {
	const renamed: string[] = [];
	const vault = plugin.app.vault as unknown as Record<string, unknown>;
	// The library's own folder, in front of whatever the case adds. `folderExists` reads this
	// same list — the migration refuses a source the vault does not hold — so a fixture that
	// omitted it would refuse every move here for a reason no case is about. The picker does
	// not gain an entry from it: `libraryDestinations` drops the source, which is the end-to-end
	// half of that filter.
	const folders = ['Renovation/Library', ...(equipment.folders ?? [])];
	vault.getAllFolders = (): { path: string }[] => folders.map((path) => ({ path }));
	vault.getFiles = (): { path: string }[] => (equipment.files ?? []).map((path) => ({ path }));
	vault.createFolder = (): Promise<void> => Promise.resolve();
	(plugin.app.fileManager as unknown as Record<string, unknown>).renameFile =
		equipment.renameFile ??
		((file: { path: string }, to: string): Promise<void> => {
			renamed.push(`${file.path} -> ${to}`);
			return Promise.resolve();
		});
	// The catalogue is what the INDEX says it is, not what sits under the folder — see
	// `catalogueNotesIn`, which asks the index first so that a project filed under the library
	// is not swept into the destination. A fixture that planted files without indexing them
	// would enumerate nothing, and every move case here would pass over an empty catalogue.
	for (const [position, path] of (equipment.files ?? []).entries()) {
		plugin.root.persistence?.index.upsert({ id: `a${position}` as never, type: 'renovation-asset', path });
	}
	return { renamed };
}

describe('moving the library', () => {
	beforeEach(() => {
		FuzzySuggestModal.opened.length = 0;
		Notice.shown.length = 0;
	});

	it('declares the move as an action row rather than a control', async () => {
		const { tab } = await withStored(null);

		const row = moveRow(tab);

		expect(row.name).toBe(t('en', 'settings.library-folder.move.name'));
		expect(row.desc).toBe(t('en', 'settings.library-folder.move.desc'));
		expect('control' in row ? row.control : undefined).toBeUndefined();
	});

	// The picker cannot offer a destination the migration would refuse: §83's check still
	// lives in the migration, because a project folder can be dragged between choosing a
	// destination and applying it.
	it('offers only folders that do not overlap a project folder', async () => {
		const { plugin, tab } = await withStored(null);
		equipVault(plugin, { folders: ['Shared/Catalogue', 'Renovation/Kitchen refit'] });
		plugin.root.persistence?.index.rebuild([
			{ id: 'p1' as never, type: 'renovation-project', path: 'Renovation/Kitchen refit/Project.md' },
		]);

		moveRow(tab).action(0);
		const picker = FuzzySuggestModal.opened[0] as FuzzySuggestModal<string>;

		expect(picker.getItems()).toEqual(['Shared/Catalogue']);
		expect(picker.getItemText('Shared/Catalogue')).toBe('Shared/Catalogue');
	});

	it('moves the catalogue, persists the new folder and re-renders the row', async () => {
		const { plugin, tab } = await withStored(null);
		const { renamed } = equipVault(plugin, {
			folders: ['Shared/Catalogue'],
			files: ['Renovation/Library/Assets/Tiles.md'],
		});
		expect(currentFolderRow(tab.settingItems)?.desc).toContain('Renovation/Library');

		moveRow(tab).action(0);
		(FuzzySuggestModal.opened[0] as FuzzySuggestModal<string>).choose('Shared/Catalogue');
		await settle();

		expect(renamed).toEqual(['Renovation/Library/Assets/Tiles.md -> Shared/Catalogue/Assets/Tiles.md']);
		expect(plugin.root.settings?.libraryFolder).toBe('Shared/Catalogue');
		expect(plugin.saved.at(-1)).toEqual({ ...DEFAULT_SETTINGS, libraryFolder: 'Shared/Catalogue' });
		// Obsidian never re-evaluates `getSettingDefinitions()` on its own, so without the
		// `update()` call the pane keeps showing the folder the catalogue has just left.
		expect(currentFolderRow(tab.settingItems)?.desc).toContain('Shared/Catalogue');
		expect(currentFolderRow(tab.getSettingDefinitions())?.desc).toContain('Shared/Catalogue');
	});

	/**
	 * The SAME gesture with the picker's two callbacks in the other order, which is the one
	 * Obsidian is believed to actually use: `SuggestModal.selectSuggestion` closes before it
	 * delivers the choice, and nothing in `obsidian.d.ts` states an ordering either way.
	 *
	 * This is what makes `onClose`'s microtask deferral load-bearing rather than decorative.
	 * Without it the close arrives first, answers `null`, and the migration never runs — the
	 * user's choice silently discarded and the row simply re-enabled. Watched red by removing
	 * the deferral; the case above, which drives the other ordering, stays green either way.
	 */
	it('takes the choice when the picker closes before delivering it', async () => {
		const { plugin, tab } = await withStored(null);
		const { renamed } = equipVault(plugin, {
			folders: ['Shared/Catalogue'],
			files: ['Renovation/Library/Assets/Tiles.md'],
		});

		moveRow(tab).action(0);
		(FuzzySuggestModal.opened[0] as FuzzySuggestModal<string>).chooseAfterClose('Shared/Catalogue');
		await settle();

		expect(renamed).toEqual(['Renovation/Library/Assets/Tiles.md -> Shared/Catalogue/Assets/Tiles.md']);
		expect(plugin.root.settings?.libraryFolder).toBe('Shared/Catalogue');
		expect(plugin.saved.at(-1)).toEqual({ ...DEFAULT_SETTINGS, libraryFolder: 'Shared/Catalogue' });
	});

	/**
	 * The lock is tested at the DOOR, not at the render: `disabled` is evaluated per render
	 * and a second click can land before one happens, so a guard that only sets its flag
	 * inside the async closure lets the second click open a second picker and start a
	 * second move from the same old root.
	 */
	it('refuses a second migration while one is in flight, without waiting for a re-render', async () => {
		const { plugin, tab } = await withStored(null);
		equipVault(plugin, { folders: ['Shared/Catalogue'] });

		const row = moveRow(tab);
		row.action(0);
		row.action(0);

		expect(FuzzySuggestModal.opened).toHaveLength(1);
		expect(row.disabled).toBeTypeOf('function');
		expect(typeof row.disabled === 'function' && row.disabled()).toBe(true);
		// Left settled rather than in flight, so the next case starts from a clean tab.
		(FuzzySuggestModal.opened[0] as FuzzySuggestModal<string>).close();
		await settle();
	});

	it('releases the lock when the picker is dismissed, and moves nothing', async () => {
		const { plugin, tab } = await withStored(null);
		const { renamed } = equipVault(plugin, {
			folders: ['Shared/Catalogue'],
			files: ['Renovation/Library/Assets/Tiles.md'],
		});

		moveRow(tab).action(0);
		(FuzzySuggestModal.opened[0] as FuzzySuggestModal<string>).close();
		await settle();

		expect(renamed).toEqual([]);
		expect(plugin.saved).toEqual([]);
		moveRow(tab).action(0);
		expect(FuzzySuggestModal.opened).toHaveLength(2);
	});

	it('tells the user when the move fails, and changes nothing', async () => {
		const { plugin, tab } = await withStored(null);
		equipVault(plugin, {
			folders: ['Shared/Catalogue'],
			files: ['Renovation/Library/Assets/Tiles.md'],
			renameFile: () => Promise.reject(new Error('locked')),
		});

		moveRow(tab).action(0);
		(FuzzySuggestModal.opened[0] as FuzzySuggestModal<string>).choose('Shared/Catalogue');
		await settle();

		expect(Notice.shown).toEqual([t('en', 'settings.library-move-failed')]);
		expect(plugin.root.settings?.libraryFolder).toBe('Renovation/Library');
		expect(plugin.saved).toEqual([]);
	});

	/**
	 * The one failure the migration cannot make safe, and the reason `persist` is its own
	 * plugin method rather than `saveSettings`: that one swaps the composition root BEFORE
	 * its own `saveData` settles, so a rejecting write would strand the session on a folder
	 * `data.json` does not name — and the persist-failure copy ("set the library folder to
	 * the new location") is unusable, because the row binds no control.
	 *
	 * Both halves are asserted. Checking only the file would pass against a build that had
	 * already swapped the root, which is exactly the defect this ordering exists to prevent.
	 */
	it('leaves the session coherent with data.json when persisting fails', async () => {
		const { plugin, tab } = await withStored(null);
		equipVault(plugin, { folders: ['Shared/Catalogue'], files: ['Renovation/Library/Assets/Tiles.md'] });
		plugin.saveData = (): Promise<void> => Promise.reject(new Error('data.json is read-only'));

		moveRow(tab).action(0);
		(FuzzySuggestModal.opened[0] as FuzzySuggestModal<string>).choose('Shared/Catalogue');
		await settle();

		expect(Notice.shown).toEqual([t('en', 'settings.library-persist-failed')]);
		expect(plugin.saved).toEqual([]);
		expect(plugin.root.settings?.libraryFolder).toBe('Renovation/Library');
	});

	/**
	 * The window `persistLibraryFolder` opens between its own `saveData` and the root swap:
	 * for the length of that write `this.root.settings.libraryFolder` still names the
	 * SOURCE, and every other control in the pane is still live — only the move row is
	 * disabled.
	 *
	 * So an ordinary settings change made during it composes `{ ...root.settings, units }`
	 * carrying the stale source folder, and if that write lands after the migration's, the
	 * session runs on the destination while `data.json` names the source. A restart then
	 * writes new catalogue entries at the old path and splits the catalogue in two — the
	 * outcome the persist-last ordering exists to prevent, reached by a different route.
	 *
	 * It has to INTERLEAVE to mean anything: two writes made one after the other prove
	 * nothing, because the second one composes from a root that has already been swapped.
	 * The gate below holds both writes in flight at once, and the assertions are the PAIR —
	 * the file names the destination AND the user's units change survives, since a fix that
	 * simply dropped the later write would satisfy the first half alone.
	 */
	it('is not overwritten by an ordinary settings write composed while the move was persisting', async () => {
		const { plugin, tab } = await withStored(null);
		equipVault(plugin, { folders: ['Shared/Catalogue'], files: ['Renovation/Library/Assets/Tiles.md'] });
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const write = plugin.saveData.bind(plugin);
		// Every write waits for the same gate, so both are in flight together and each lands
		// in the order its continuation was queued.
		plugin.saveData = async (data: unknown): Promise<void> => {
			await gate;
			await write(data);
		};

		moveRow(tab).action(0);
		(FuzzySuggestModal.opened[0] as FuzzySuggestModal<string>).choose('Shared/Catalogue');
		await settle();
		// Composed HERE, while the migration's own write is still in flight.
		const ordinary = tab.setControlValue('units', 'imperial');
		release();
		await ordinary;
		await settle();

		const expected = { ...DEFAULT_SETTINGS, units: 'imperial', libraryFolder: 'Shared/Catalogue' };
		expect(plugin.saved.at(-1)).toEqual(expected);
		expect(plugin.root.settings).toEqual(expected);
		// And in that order, with neither write carrying the folder the other had just left:
		// a build that let them interleave writes the source back over the destination.
		expect((plugin.saved as { libraryFolder: string }[]).map((entry) => entry.libraryFolder)).toEqual([
			'Shared/Catalogue',
			'Shared/Catalogue',
		]);
	});

	/**
	 * Two ordinary control writes issued before the queue drains, which is the same window
	 * the case above describes and the one this whole chain exists for.
	 *
	 * Serializing the writes is not enough on its own: a caller that composed a COMPLETE
	 * settings object at call time replays the state as it was then, so the second write
	 * puts the first one's key back. Measured with the two controls a user is likeliest to
	 * change together — the units revert to `metric` while the toggle lands.
	 *
	 * The remedy is that a write says what it CHANGES and the chain composes the rest at
	 * execution time. Both halves are asserted: the file and the session, since a build that
	 * applied the change without writing it would satisfy one alone.
	 */
	it('keeps both changes when two controls are written before the queue drains', async () => {
		const { plugin, tab } = await withStored(null);
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const write = plugin.saveData.bind(plugin);
		plugin.saveData = async (data: unknown): Promise<void> => {
			await gate;
			await write(data);
		};

		const first = tab.setControlValue('units', 'imperial');
		const second = tab.setControlValue('verboseLogging', true);
		release();
		await first;
		await second;

		const expected = { ...DEFAULT_SETTINGS, units: 'imperial', verboseLogging: true };
		expect(plugin.root.settings).toEqual(expected);
		expect(plugin.saved.at(-1)).toEqual(expected);
	});

	/**
	 * The chain's own recovery, which nothing discriminated before: a write that rejects
	 * must not wedge every later one for the session.
	 *
	 * `swallow` is registered on BOTH arms of the tail for exactly this, and merely
	 * EXECUTING the reject arm proves nothing — dropping it, and wedging the chain outright,
	 * both leave every other case in this directory green. This one fails a write and then
	 * makes a successful one, so the recovery is pinned by an assertion rather than by a
	 * line having run.
	 */
	it('carries on writing after one has failed, rather than wedging the chain', async () => {
		const { plugin } = await loadedPlugin(null);
		const write = plugin.saveData.bind(plugin);
		plugin.saveData = (): Promise<void> => Promise.reject(new Error('data.json is read-only'));

		await expect(plugin.persistLibraryFolder('Shared/Catalogue')).rejects.toThrow('read-only');
		plugin.saveData = write;
		await plugin.saveSettings({ units: 'imperial' });

		expect(plugin.saved).toEqual([{ ...DEFAULT_SETTINGS, units: 'imperial' }]);
		expect(plugin.root.settings?.units).toBe('imperial');
	});

	/**
	 * The guard `saveSettings` has carried since slice 1, at the second write door: a
	 * transient read failure must not stamp a folder over a `data.json` sitting there
	 * intact. Unreachable from the pane — a tab with unrecovered settings declares one
	 * text-only row and no action — so it is driven at the method it belongs to.
	 */
	it('refuses to persist a library folder when the settings were never recovered', async () => {
		const { plugin } = await loadedPlugin(null, new Error('unreadable'));

		await plugin.persistLibraryFolder('Shared/Catalogue');

		expect(plugin.saved).toEqual([]);
		expect(plugin.root.settings).toBeNull();
	});
});
