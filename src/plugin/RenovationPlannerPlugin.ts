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
import { projectIndexRebuilt } from '../application/events/projectIndex.events';
import type { VaultChangeAdapter } from '../infrastructure/persistence/index/VaultChangeAdapter';
import { PLAN_EDITOR_VIEW, PlanEditorView } from '../presentation/views/PlanEditorView';
import { registerPlanEditorCommands } from './planEditorCommands';
import { registerSampleProjectCommand } from './sampleProject';
import { claimKonvaGlobal } from '../presentation/editor/scene/konvaGlobal';
import {
	createCompositionRoot,
	planEditorDeps,
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
 * `onunload` exists now, and it took the FIRST thing that genuinely needs disposing to earn
 * it — which was not one of this plugin's own registrations. `registerView`,
 * `addRibbonIcon` and `addCommand` are still unregistered by the `Plugin` base class and
 * are still deliberately absent from it, because a handler that only repeats what the base
 * class already does is a place for a future mistake to hide. What IS there is
 * `window.Konva`: Konva assigns it at module scope on every load and nothing took it back
 * off, so reactivating the plugin logged "Several Konva instances detected" and the previous
 * load's whole bundle stayed reachable from `window`.
 *
 * Measured by coverage like everything else in `src/` — only `src/main.ts` is excluded
 * (`vitest.config.ts`). The wiring here is exactly what breaks silently, so
 * `tests/plugin/registration.test.ts` drives it against the module mock rather than
 * trusting it.
 */
/**
 * Obsidian hands TAbstractFile to every vault event; only notes interest the pipeline.
 *
 * The adapter is resolved PER EVENT rather than captured: `saveSettings` replaces the
 * composition root, so a handler closing over the adapter it was registered with would keep
 * feeding a root nothing reads any more. Undefined resolves to a no-op — settings that
 * could not be read compose no persistence at all.
 */
function onNoteFile(adapterOf: () => VaultChangeAdapter | undefined, method: 'onCreate' | 'onModify' | 'onDelete'): (file: TAbstractFile) => void {
	return (file: TAbstractFile): void => {
		if (file instanceof TFile) adapterOf()?.[method](file);
	};
}
export default class RenovationPlannerPlugin extends Plugin {
	/**
	 * One field, not a bare `settings` one: a view or the settings tab reaches persisted
	 * state through `plugin.root.settings` — one path in, not two that could drift.
	 * Definitely assigned in `onload`, which Obsidian calls before anything can read it.
	 */
	root!: CompositionRoot;

	/** What `onunload` has to undo, in the order it was claimed. */
	private readonly disposers: (() => void)[] = [];

	async onload(): Promise<void> {
		// FIRST, ahead of even the logger: importing this bundle has ALREADY put Konva on
		// `window` — its module scope runs before Obsidian calls `onload` — so this is the
		// moment at which that global is provably this load's own and safe to claim.
		this.disposers.push(claimKonvaGlobal());

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
		// The cascade handlers registered at composition time are the first thing unload
		// must stop — a geometry edit arriving during teardown must not start a write.
		this.disposers.push(() => {
			for (const subscription of this.root.persistence?.subscriptions ?? []) {
				subscription.dispose();
			}
		});
		// The tab is registered, not drawn: Obsidian calls `display()` when the pane is
		// opened. Registering it right after the load keeps the SDD's order readable —
		// nothing below this line can be configured before it exists.
		this.addSettingTab(new SettingsTab(this));

		this.registerView(RENOVATION_PROJECT_VIEW, (leaf) => new RenovationProjectView(leaf));
		// The Plan Editor is per-plan rather than a singleton, so its factory is asked for a
		// view many times — the dependencies are resolved PER CALL from the current root, not
		// captured, because `saveSettings` replaces that root and a view built against the old
		// one would read through query services pointed at the previous project folder.
		this.registerView(
			PLAN_EDITOR_VIEW,
			(leaf) => new PlanEditorView(leaf, planEditorDeps(this.root, this.app.workspace, this.app.vault)),
		);
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

		// The Plan Editor's two commands. Their BEHAVIOUR lives in one module beside this
		// one; the `addCommand` calls still happen here, so this file remains the only place
		// anything is registered with Obsidian.
		registerPlanEditorCommands(this);

		// SCAFFOLDING, and its own module says so at length: one command that seeds a
		// project, a plan and five zones through the real create commands, so slice 5's
		// canvas can be looked at in a vault at all. Slice 14's empty states and slice 16's
		// creation forms are what remove it — slice 15 built the dialog framework they mount in,
		// which is not the same thing as being able to name a project.
		registerSampleProjectCommand(this);

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
		// The new root carries an EMPTY index — and `projectFolder` is a setting, so the
		// tree worth scanning may have moved. Re-running the build is what makes the swap
		// complete; without it the session reads an index of nothing until the next reload,
		// and every already-registered listener maintains a root nobody consults.
		this.startPersistence();
		return this.saveData(next);
	}

	private vaultStack: VaultStack | null = null;

	/**
	 * Registered once per session, never per composition root — `registerEvent` hands
	 * disposal to the base class at UNLOAD, so a second registration is a second delivery
	 * of every event for the rest of the session and nothing takes the first one back.
	 */
	private listenersRegistered = false;

	/**
	 * The Project Index's build, plus — the first time only — the vault listeners that keep
	 * it current. Everything here composes ONLY when settings were recovered: with the
	 * folder unknown there is no correct tree to scan and no correct place to write, so no
	 * repository, index or query service exists at all (`CompositionRoot.persistence`).
	 *
	 * Called from `onLayoutReady` and again from `saveSettings`, which is why the two halves
	 * are guarded differently. The BUILD repeats, because a new root's index starts empty
	 * and its folder may have changed. The REGISTRATION does not, because the handlers read
	 * `this.root` at call time and therefore already follow the swap.
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

		// Announced, because a surface that already read through the index has read a
		// DIFFERENT index. Obsidian restores its leaves before `onLayoutReady`, so a Plan
		// Editor reopened with the app hydrated against an empty one and said "this plan no
		// longer exists" about a plan that does — reported from a real vault. The `void` is
		// deliberate: publishing awaits its subscribers, and nothing here needs to.
		void this.root.eventBus.publish(projectIndexRebuilt());

		if (this.listenersRegistered) return;
		this.listenersRegistered = true;

		// Obsidian hands `TAbstractFile` to every event; only notes interest the pipeline.
		const adapterOf = (): VaultChangeAdapter | undefined => this.root.persistence?.changeAdapter;
		this.registerEvent(this.app.vault.on('create', onNoteFile(adapterOf, 'onCreate')));
		this.registerEvent(this.app.vault.on('modify', onNoteFile(adapterOf, 'onModify')));
		this.registerEvent(this.app.vault.on('delete', onNoteFile(adapterOf, 'onDelete')));
		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
			if (file instanceof TFile) adapterOf()?.onRename(file, oldPath);
		}));
	}

	/**
	 * §9's reverse order, of which there is exactly one step today.
	 *
	 * Each disposer is independent and none may stop the next from running, so a throwing
	 * one is caught rather than allowed to abandon the rest of the teardown: an unload that
	 * stops halfway leaves the plugin partly resident with nothing that will try again.
	 * `splice(0)` empties the list as it reads it, so a second `onunload` — Obsidian does
	 * not promise to call it once — cannot release the same thing twice.
	 */
	onunload(): void {
		for (const dispose of this.disposers.splice(0)) {
			try {
				dispose();
			} catch (cause) {
				this.root.logger.error('plugin.unload.disposer-failed', { cause });
			}
		}
	}

	private openProject(): Promise<void> {
		return revealView(this.app.workspace, RENOVATION_PROJECT_VIEW);
	}
}
