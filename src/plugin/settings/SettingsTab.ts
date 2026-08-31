import { FuzzySuggestModal, PluginSettingTab, type App, type SettingDefinition } from 'obsidian';
import { tr } from '../../presentation/i18n/strings';
import { noticeOnlySinks } from '../../presentation/notices/notify';
import { surfaceError } from '../../presentation/errors/surfaceError';
import { isErr } from '../../core/result/Result';
import { ensureFolder, renameNote } from '../../infrastructure/obsidian/repositories/noteIo';
import { runDetached } from '../runDetached';
import { DEFAULT_SETTINGS, UNITS, type RenovationPlannerSettings } from './settings';
import {
	catalogueNotesIn,
	libraryGeometryIn,
	libraryDestinations,
	migrateLibraryFolder,
	projectFolderPaths,
	type LibraryMigrationDeps,
} from './libraryMigration';
import type RenovationPlannerPlugin from '../RenovationPlannerPlugin';

/**
 * Where the library is moved TO, asked with an Obsidian `Modal` rather than slice 15's
 * `FormDialog`.
 *
 * `DialogHost` is mounted in `PlanEditorRoot.vue` and `ViewRoot.vue` and nowhere else, its
 * store is scoped to each view's own Pinia app, and a settings tab mounts no Vue app at
 * all — so a user opening plugin settings with no Renovation Project or Plan Editor leaf
 * open would have nothing to render into. This is the shape `open-plan-editor`'s plan
 * picker already uses, and it depends on no leaf being open.
 *
 * It offers the folders the vault already HAS, which is the one thing this shape cannot do
 * differently: a fuzzy picker chooses from a list, and there is no field to type a path
 * that does not exist yet into. The cost is stated rather than hidden — moving the
 * catalogue somewhere new means creating that folder in the file explorer first — and it is
 * the honest trade for a picker that cannot mistype a path.
 */
class LibraryDestinationModal extends FuzzySuggestModal<string> {
	private settled = false;

	constructor(
		app: App,
		private readonly folders: readonly string[],
		private readonly answer: (folder: string | null) => void,
	) {
		super(app);
		this.setPlaceholder(tr('settings.library-folder.move.name'));
	}

	getItems(): string[] {
		return [...this.folders];
	}

	getItemText(folder: string): string {
		return folder;
	}

	onChooseItem(folder: string): void {
		this.settle(folder);
	}

	/**
	 * Dismissal is the only way this picker can answer "nothing was chosen", and without an
	 * answer the caller's lock is never released — the row would stay disabled for the rest
	 * of the session.
	 *
	 * The answer is DEFERRED by a microtask because Obsidian's own ordering of
	 * `onChooseItem` and `onClose` is not stated in the typings — `SuggestModal` is widely
	 * believed to CLOSE before it delivers the choice — so whichever arrives first, a choice
	 * made in the same task wins over the cancellation, and `settle` makes the second of the
	 * two a no-op either way.
	 *
	 * That is order-INDEPENDENCE, which is a claim about a PAIR and therefore needs both
	 * orderings driven: `settingsTab.test.ts` does exactly that, through the mock's `choose`
	 * and `chooseAfterClose`. With only the first of those, removing this deferral leaves
	 * every case green while the likelier ordering discards the user's choice silently.
	 */
	onClose(): void {
		queueMicrotask(() => {
			this.settle(null);
		});
	}

	private settle(folder: string | null): void {
		if (this.settled) return;
		this.settled = true;
		this.answer(folder);
	}
}

function askLibraryDestination(app: App, folders: readonly string[]): Promise<string | null> {
	return new Promise((resolve) => {
		new LibraryDestinationModal(app, folders, resolve).open();
	});
}

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
 * **There is no `display()` here at all**, and the unrecovered-settings message is a
 * text-only DEFINITION (`SettingDefinitionEmpty` — a `name` with no control) rather than
 * an imperative fallback. `display()` was the obvious shape and is wrong on this ruleset's
 * own terms: `obsidianmd/settings-tab/no-deprecated-display` fails a tab that implements
 * both, and switching that rule off would not travel — the marketplace review bot lints a
 * submission with ITS OWN configuration, so the flag would arrive at submission instead of
 * at `npm run check`. A definition is also the better answer independently: it is what
 * Obsidian's settings SEARCH indexes, which an imperatively drawn pane is absent from.
 *
 * There is no heading and no plugin name among the definitions: Obsidian draws the plugin's
 * name itself, and repeating it is a recurring marketplace review rejection.
 */
export class SettingsTab extends PluginSettingTab {
	constructor(private readonly host: RenovationPlannerPlugin) {
		super(host.app, host);
	}

	// Narrowed from the base's `SettingDefinitionItem[]`, which also admits groups, lists and
	// pages — none of which carry a `name`, and none of which this tab declares. Saying so in
	// the signature is what lets a caller read `name` or `desc` without narrowing a union
	// three of whose four members this method never returns. A narrower return type is a
	// legal override.
	getSettingDefinitions(): SettingDefinition[] {
		// One text-only item while the settings could not be read — the reason, and NO
		// control. The tab writes on every control change, so offering no control is what
		// keeps a failed read from becoming a write through a control nobody has written yet,
		// and a definition rather than a `display()` fallback is what keeps the message in
		// the settings search index.
		const settings = this.host.root.settings;
		if (settings === null) return [{ name: tr('settings.unrecovered') }];

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
			{
				name: tr('settings.project-folder.name'),
				desc: tr('settings.project-folder.desc'),
				control: {
					type: 'text',
					key: 'projectFolder',
					defaultValue: DEFAULT_SETTINGS.projectFolder,
				},
			},
			// NO `control`, deliberately. Anything keyed to `libraryFolder` here writes it
			// through `setControlValue` → `saveSettings` the instant it changes, and the
			// migration would then read the NEW value as the folder to move FROM — searching
			// the new, empty folder and stranding the catalogue at the old path. A `text`
			// control does that per keystroke and a folder picker once, and once is enough,
			// which is why the answer was to bind no control rather than to pick a different
			// one. The only writer of this setting is the migration, which persists LAST,
			// after the notes have moved.
			{
				name: tr('settings.library-folder.name'),
				desc: tr('settings.library-folder.current', { folder: settings.libraryFolder }),
			},
			// The move is an ACTION, never a control. `setControlValue` writes through
			// `saveSettings` on every change — one catalogue move per intermediate value,
			// with no serialization between two of them — and both of those destroy data
			// rather than merely being wrong.
			//
			// It closes over the folder this render was built from, which is the same value
			// the row above prints: the migration moves the catalogue the user was just
			// looking at, rather than whatever the setting says by the time they click.
			{
				name: tr('settings.library-folder.move.name'),
				desc: tr('settings.library-folder.move.desc'),
				disabled: () => this.migrating,
				action: () => {
					this.startLibraryMove(settings.libraryFolder);
				},
			},
			{
				name: tr('settings.verbose-logging.name'),
				desc: tr('settings.verbose-logging.desc'),
				control: {
					type: 'toggle',
					key: 'verboseLogging',
					defaultValue: DEFAULT_SETTINGS.verboseLogging,
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
		return this.host.root.settings?.[key as keyof RenovationPlannerSettings];
	}

	/**
	 * And where it writes. Through `saveSettings`, which composes the patch over the live
	 * settings and passes the result through `settingsFrom` — the same gate `loadData` passes
	 * through — so every value a control can produce is validated by one function, an
	 * unrecognised one falls back to the default instead of reaching the file, and a key this
	 * version does not declare is dropped rather than persisted forever.
	 */
	setControlValue(key: string, value: unknown): Promise<void> {
		// The ONE key this control changed, never a whole settings object built from
		// `this.host.root.settings` here. That spread is a snapshot, and it is stale for as
		// long as any other write is in flight — a second control changed before the queue
		// drains would replay this one's old value, and one changed during a library move
		// would replay the folder the catalogue has just left. `saveSettings` composes the
		// rest when it writes, and `settingsFrom` still validates every key there.
		return this.host.saveSettings({ [key]: value });
	}

	/**
	 * Whether a library move is running, and it is a SYNCHRONOUS lock rather than a
	 * rendering state.
	 *
	 * `disabled` above is evaluated per render and needs an `update()` call to be
	 * re-evaluated, and the picker's own "one at a time" only covers the window while it is
	 * up — which closes when the destination is submitted, before the rename loop finishes.
	 * A second click during a slow migration would otherwise open a second picker and start
	 * a second move from the same old root.
	 */
	private migrating = false;

	private startLibraryMove(from: string): void {
		// Tested and SET before anything can yield. Everything below this line is either
		// asynchronous or a re-render, so this pair is the only thing standing between two
		// clicks and two concurrent rename loops.
		if (this.migrating) return;
		this.migrating = true;
		// `update()` rather than `refreshDomState()`: the latter re-evaluates `visible` and
		// `disabled` in place, which is half of what is owed here — the row above prints the
		// current folder in its DESCRIPTION, and only a re-read of the definitions can
		// change that.
		this.update();
		runDetached(this.runLibraryMove(from), this.host.root.logger, 'settings.library-move');
	}

	private async runLibraryMove(from: string): Promise<void> {
		try {
			const projectFolders = projectFolderPaths(this.host.root.persistence);
			const folders = this.app.vault.getAllFolders(false).map((folder) => folder.path);
			const to = await askLibraryDestination(this.app, libraryDestinations(folders, projectFolders, from));
			if (to === null) return;

			const migrated = await migrateLibraryFolder(this.libraryMigrationDeps(), from, to);
			// Through the surface policy (SDD §66's last step), like every other plugin command:
			// the site declares WHERE the failure came from and the table decides the container.
			// Moving the library is an operation the user invoked from this pane and confirmed
			// with a destination picker, so the origin is `explicit-operation` — not
			// `autosave-write`, which no gesture here is, and not `decision-required`, since the
			// decision is the picker ABOVE and it already succeeded. `noticeOnlySinks` is the
			// honest sink set: a settings tab has no view of its own to fail in place, no form
			// banner and no save indicator.
			if (isErr(migrated)) {
				surfaceError(migrated.error, { kind: 'explicit-operation' }, noticeOnlySinks);
			}
		} finally {
			this.migrating = false;
			this.update();
		}
	}

	/**
	 * The vault operations the migration is handed, so that nothing in `plugin/` spells a
	 * vault mutation itself: both writes resolve to `infrastructure/obsidian/`, and the two
	 * settings-side steps resolve to the plugin's own doors.
	 */
	private libraryMigrationDeps(): LibraryMigrationDeps {
		const { vault, fileManager } = this.app;
		return {
			projectFolders: () => projectFolderPaths(this.host.root.persistence),
			// The same enumeration the picker's own list comes from, so "a folder the vault has"
			// means one thing in this pane. The LIST rather than a predicate: the source guard
			// has to tell a folder that is simply absent from one that is present under another
			// spelling, and a yes/no has already collapsed the two.
			vaultFolders: () => vault.getAllFolders(false).map((folder) => folder.path),
			// The INDEX decides which notes are the catalogue and the folder only narrows it —
			// see `catalogueNotesIn`. Asking the folder alone swept a project filed under the
			// library into the destination.
			catalogueNotes: (from) => catalogueNotesIn(this.host.root.persistence, vault.getFiles(), from),
			// The same `getFiles()` list, asked a different question — see `libraryGeometryIn`
			// for why a sidecar cannot be found the way a catalogue note is.
			geometrySidecars: (from) => libraryGeometryIn(vault.getFiles(), from),
			ensureFolder: (path) => ensureFolder(vault, path),
			renameFile: (file, to) => renameNote(fileManager, file, to),
			rebuildIndex: () => {
				this.host.rebuildProjectIndex();
			},
			persist: (folder) => this.host.persistLibraryFolder(folder),
			logger: this.host.root.logger,
		};
	}
}
