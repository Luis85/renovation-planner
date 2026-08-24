import { Plugin, TFile, type TAbstractFile } from 'obsidian';
import { RENOVATION_PROJECT_ICON, RENOVATION_PROJECT_VIEW, RenovationProjectView } from '../presentation/views/RenovationProjectView';
import { GEOMETRY_SIDECAR_VIEW, GeometrySidecarView } from '../presentation/views/GeometrySidecarView';
import { tr } from '../presentation/i18n/strings';
import { revealView } from '../infrastructure/obsidian/workspace/revealView';
import type { LogLevel, Logger } from '../application/ports/Logger';
import type { PluginDataProbe } from '../application/ports/PluginDataProbe';
import { createConsoleLogger } from '../infrastructure/logging/consoleLogger';
import { createPluginDataProbe } from '../infrastructure/obsidian/settings/pluginDataFile';
import { buildProjectIndexEntries } from '../infrastructure/persistence/index/buildProjectIndexEntries';
import {
	createCompositionRoot,
	type CompositionRoot,
	type VaultStack,
} from './composition-root';
import { isDataAbsent, settingsFrom, type RenovationPlannerSettings } from './settings/settings';
import { SettingsTab } from './settings/SettingsTab';

/**
 * The threshold is an argument to the adapter, not a setting: this slice's `debug` calls
 * compile and emit nothing, while the levels slice 11 adds still reach a released build
 * where they are worth having. A user-facing switch belongs with slice 11's diagnostics
 * work — "copy diagnostics" and "turn on verbose logging" are the same conversation — and
 * this slice does not add a settings field no feature reads yet.
 */
const LOG_LEVEL: LogLevel = 'info';

/**
 * The plugin shell: the ONLY place anything is registered with Obsidian, and the only layer
 * allowed to reach every other one — it composes them (SDD §9, §10).
 *
 * `onload` registers and nothing more. No domain logic belongs here, and neither does
 * work: startup cost is paid by every user on every launch, and "register, do not scan" is
 * one of the recurring plugin review rejections. The order the SDD states is settings →
 * composition root → workspace views → Bases views → commands → vault listeners → project
 * index, and `onunload` is its reverse: flush pending writes, stop listeners, dispose
 * services.
 *
 * There is no `onunload` here, deliberately. `registerView`, `addRibbonIcon` and
 * `addCommand` are all registered through the `Plugin` base class, which unregisters them
 * itself; a handler that only repeats what the base class already does is a place for a
 * future mistake to hide. It arrives with the first thing that genuinely needs disposing.
 *
 * Measured by coverage like everything else in `src/` — only `src/main.ts` is excluded
 * (`vitest.config.ts`). The wiring here is exactly what breaks silently, so
 * `tests/plugin/registration.test.ts` drives it against the module mock rather than
 * trusting it.
 */
/**
 * Obsidian hands TAbstractFile to every vault event; only notes interest the pipeline.
 */
function onNoteFile(adapter: { onCreate(file: TFile): void; onModify(file: TFile): void; onDelete(file: TFile): void }, method: 'onCreate' | 'onModify' | 'onDelete'): (file: TAbstractFile) => void {
	return (file: TAbstractFile): void => {
		if (file instanceof TFile) adapter[method](file);
	};
}
export default class RenovationPlannerPlugin extends Plugin {
	/**
	 * One field, not a bare `settings` one: a view or the settings tab reaches persisted
	 * state through `plugin.root.settings` — one path in, not two that could drift.
	 * Definitely assigned in `onload`, which Obsidian calls before anything can read it.
	 */
	root!: CompositionRoot;

	async onload(): Promise<void> {
		// The logger is deliberately AHEAD of §9's first step rather than inside its list:
		// it is not one of the things bootstrap sets up, it is what the setup steps report
		// through, and the step below is the first one that can fail.
		const logger = createConsoleLogger(LOG_LEVEL);
		logger.debug('plugin.load.started');

		// The raw app surface the persistence stack reads and writes through — gathered
		// once here, because `plugin/` is where Obsidian's own objects are handed out.
		this.vaultStack = {
			vault: this.app.vault,
			fileManager: this.app.fileManager,
			metadataCache: this.app.metadataCache,
		};

		// Settings first of the steps — the SDD's stated onload order (§9) — so everything
		// registered below may read them. The merge is pure (`settingsFrom`); only the
		// `loadData` call lives here, in the layer allowed to name it.
		this.root = createCompositionRoot(
			await this.loadSettings(logger, createPluginDataProbe(this.app, this.manifest.id)),
			logger,
			this.vaultStack,
		);
		// The tab is registered, not drawn: Obsidian calls `display()` when the pane is
		// opened. Registering it right after the load keeps the SDD's order readable —
		// nothing below this line can be configured before it exists.
		this.addSettingTab(new SettingsTab(this));

		this.registerView(RENOVATION_PROJECT_VIEW, (leaf) => new RenovationProjectView(leaf));
		// Sidecars are visible, openable files (ADR-011): without the extension
		// registration they render as unsupported attachments in the explorer.
		this.registerExtensions(['rpgeo'], GEOMETRY_SIDECAR_VIEW);
		this.registerView(GEOMETRY_SIDECAR_VIEW, (leaf) => new GeometrySidecarView(leaf));

		// Two ways in, one behaviour: both call the same function, so neither can grow its
		// own idea of what opening the view means. `void` rather than an async handler —
		// Obsidian ignores a returned promise, and the explicit void is what says the
		// rejection is unhandled on purpose here rather than by omission.
		this.addRibbonIcon(RENOVATION_PROJECT_ICON, tr('command.open-project'), () => {
			void this.openProject();
		});

		this.addCommand({
			id: 'open-project',
			name: tr('command.open-project'),
			callback: () => {
				void this.openProject();
			},
		});

		// The index scan runs from `onLayoutReady`, NOT here: a vault-wide scan in `onload`
		// competes with workspace restoration, and `MetadataCache` is incomplete until
		// layout-ready — an earlier scan would build a partial index that looks complete.
		this.app.workspace.onLayoutReady(() => this.startPersistence());

		// A `debug` line rather than an `info` one, and that is the publishing guidance
		// rather than taste: a plugin that announces itself on every start is the plainest
		// instance of the "console noise" rejection. What survives as `info` is RARITY —
		// something that happened once and would be worth having in a support thread.
		logger.debug('plugin.loaded');
	}

	/**
	 * Two ways `data.json` can be unreadable, and only one of them looks like a failure.
	 *
	 * A REJECTION is the obvious one. The other was found in a real vault and is the common
	 * one: Obsidian's `loadData()` does **not** reject on malformed JSON. It catches the
	 * `JSON.parse` failure itself, logs `failed to read JSON …` on its own side, and RESOLVES
	 * EMPTY — so a corrupt file and a fresh install arrive here identically, and an earlier
	 * version of this method handed back `DEFAULT_SETTINGS` for both. That left the settings
	 * pane offering a control, and the first change written through it replaced the user's
	 * file with defaults. The probe is the discriminator: nothing AND no file is a fresh
	 * install; nothing AND a file present is a file nobody can read.
	 *
	 * Recovery is a reload rather than a repair UI — fixing or removing `data.json` and
	 * toggling the plugin re-runs this. Nothing here re-reads on a timer and nothing writes a
	 * replacement file, because both amount to guessing at data the user still has.
	 *
	 * A probe that THROWS lands in the same `catch` and is therefore unrecovered too, which
	 * is deliberate and needs no branch of its own: if the vault cannot say whether the file
	 * is there, refusing to write over it is the only safe answer.
	 */
	private async loadSettings(logger: Logger, probe: PluginDataProbe): Promise<RenovationPlannerSettings | null> {
		try {
			// Annotated `unknown` rather than inferred: `loadData()` is typed `Promise<any>`,
			// and binding that to a local is the one place the `any` would escape into this
			// file. `unknown` is also what it honestly is — `data.json` is user-editable, so
			// both readers below take `unknown` and validate.
			const raw: unknown = await this.loadData();

			if (isDataAbsent(raw) && (await probe.dataFileExists())) {
				// No `cause` to forward: Obsidian swallowed the error before this code saw it,
				// so a `cause` key here would be an empty promise of detail. A DIFFERENT event
				// name from the rejection below for the same reason — one name per thing that
				// actually happened is what makes either of them greppable.
				logger.error('settings.load.unreadable');
				return null;
			}

			return settingsFrom(raw);
		} catch (cause) {
			logger.error('settings.load.failed', { cause });
			return null;
		}
	}

	/**
	 * The one write path for settings, so no control has to know how they are persisted.
	 * `saveData` replaces the whole file, which is why this takes the complete next settings
	 * object rather than a patch — and why the root is REPLACED rather than mutated: its
	 * fields are readonly, so there is exactly one way state changes here.
	 */
	saveSettings(next: RenovationPlannerSettings): Promise<void> {
		// Refused for the whole SESSION, not only at bootstrap: a transient read failure
		// must not stamp defaults over a `data.json` that is sitting there intact. The tab
		// is the other writer and is guarded independently (`getSettingDefinitions`).
		if (this.root.settings === null) return Promise.resolve();

		this.root = createCompositionRoot(next, this.root.logger, this.vaultStack);
		return this.saveData(next);
	}

	private vaultStack: VaultStack | null = null;

	/**
	 * The Project Index's initial build, plus the vault listeners that keep it current.
	 * Everything here composes ONLY when settings were recovered — with the folder
	 * unknown there is no correct tree to scan and no correct place to write, so no
	 * repository, index or query service exists at all (`CompositionRoot.persistence`).
	 */
	private startPersistence(): void {
		const persistence = this.root.persistence;
		if (!persistence || !this.vaultStack) return;

		persistence.index.rebuild(
			buildProjectIndexEntries({
				vault: this.vaultStack.vault,
				metadataCache: this.vaultStack.metadataCache,
				echo: persistence.vaultDeps.echo,
				logger: this.root.logger,
				projectFolder: persistence.vaultDeps.projectFolder,
			}),
		);

		const adapter = persistence.changeAdapter;
		// Obsidian hands `TAbstractFile` to every event; only notes interest the pipeline.
		this.registerEvent(this.app.vault.on('create', onNoteFile(adapter, 'onCreate')));
		this.registerEvent(this.app.vault.on('modify', onNoteFile(adapter, 'onModify')));
		this.registerEvent(this.app.vault.on('delete', onNoteFile(adapter, 'onDelete')));
		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
			if (file instanceof TFile) adapter.onRename(file, oldPath);
		}));
	}

	private openProject(): Promise<void> {
		return revealView(this.app.workspace, RENOVATION_PROJECT_VIEW);
	}
}
