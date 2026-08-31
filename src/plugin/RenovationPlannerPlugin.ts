import { apiVersion, Plugin, TFile, type TAbstractFile, type WorkspaceLeaf } from 'obsidian';
import { RENOVATION_PROJECT_ICON, RENOVATION_PROJECT_VIEW, RenovationProjectView } from '../presentation/views/RenovationProjectView';
import { GEOMETRY_SIDECAR_VIEW, GeometrySidecarView } from '../presentation/views/GeometrySidecarView';
import { tr } from '../presentation/i18n/strings';
import { revealView } from '../infrastructure/obsidian/workspace/revealView';
import { navigateToProject } from '../infrastructure/obsidian/workspace/navigateToProject';
import type { LogLevel, Logger } from '../application/ports/Logger';
import type { PluginDataProbe } from '../application/ports/PluginDataProbe';
import { createConsoleLogger } from '../infrastructure/logging/consoleLogger';
import { InMemoryDiagnosticsLedger } from '../infrastructure/logging/diagnosticsLedger';
import { createPluginDataProbe } from '../infrastructure/obsidian/settings/pluginDataFile';
import { buildProjectIndexEntries } from '../infrastructure/persistence/index/buildProjectIndexEntries';
import { projectIndexRebuilt } from '../application/events/projectIndex.events';
import type { VaultChangeAdapter } from '../infrastructure/persistence/index/VaultChangeAdapter';
import { PLAN_EDITOR_VIEW, PlanEditorView, type PlanEditorDeps } from '../presentation/views/PlanEditorView';
import { ProjectSuggestModal } from '../presentation/modals/ProjectSuggestModal';
import { entriesOfType } from './indexEntries';
import { registerPlanEditorCommands } from './planEditorCommands';
import { registerSampleProjectCommand } from './sampleProject';
import { claimKonvaGlobal } from '../presentation/editor/scene/konvaGlobal';
import { activateNotices, disposeNotices, notifyFault } from '../presentation/notices/notify';
import {
	createCompositionRoot,
	planEditorDeps,
	renovationProjectDeps,
	type CompositionRoot,
	type VaultStack,
} from './composition-root';
import type { RenovationProjectDeps } from '../presentation/views/RenovationProjectContext';
import { isDataAbsent, settingsFrom, type RenovationPlannerSettings, type SettingsPatch } from './settings/settings';
import { SettingsTab } from './settings/SettingsTab';
import { SequenceMarkerFileStore } from '../infrastructure/obsidian/plugin-data/SequenceMarkerFileStore';
import { recoverInterruptedSequences } from '../application/reference/recoverInterruptedSequences';
import { runDetached } from './runDetached';
import { showDiagnosticsReport } from './diagnostics/showDiagnosticsReport';

/**
 * The floor bootstrap starts at, before settings can say otherwise: `loadSettings`
 * reports through this logger, so it must exist first. Once settings are read,
 * `verboseLogging` widens the floor to `debug` via `setLevel` — slice 11's switch, and
 * everything still stays in the local console (SDD §67).
 */
const LOG_LEVEL: LogLevel = 'info';

/**
 * The settings write chain's own tail handler, and ONE function for both arms deliberately:
 * whether the write before it resolved or rejected, the chain carries on. A rejection is
 * the caller's to see on the promise it was handed, never the next writer's to inherit.
 */
function swallow(): void {
	return undefined;
}

/**
 * The plugin shell: the layer allowed to reach every other one — it composes them (SDD §9,
 * §10) — and where registering with Obsidian belongs.
 *
 * That used to read "the ONLY place anything is registered with Obsidian", which was false
 * when written and stayed false for fifteen slices: `planEditorCommands.ts` and
 * `sampleProject.ts` each register commands through the `PluginCommandHost` seam, three
 * calls between them. The claim that IS true is about the DIRECTORY, and it is worth having
 * because the layer bans cannot express it — `obsidian` is importable in `infrastructure/`,
 * and a `Plugin` is passed around as `host`, so nothing structural stops a view or a
 * repository from registering a command. `tests/build/registration-locality.test.ts` is
 * that claim, measured by reading `src/` rather than asserted here.
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

	/**
	 * The adapter onload constructs, held CONCRETE rather than through the `Logger` port:
	 * slice 11's verbose-logging setting reaches the floor via `setLevel`, which only the
	 * adapter has — and `saveSettings` must be able to re-apply it live, not just onload.
	 */
	private readonly logger = createConsoleLogger(LOG_LEVEL);

	/**
	 * The diagnostics ledger outlives composition roots: `saveSettings` replaces the root
	 * (and with it every repository), but the validation issues recorded so far describe
	 * the SESSION's vault reads, and discarding them because a preference changed would
	 * empty the diagnostics snapshot as a side effect nobody asked for.
	 */
	private readonly ledger = new InMemoryDiagnosticsLedger();

	/** What `onunload` has to undo, in the order it was claimed. */
	private readonly disposers: (() => void)[] = [];

	/**
	 * Has the initial index scan completed — zero entries included.
	 *
	 * Set in `startPersistence` beside the `projectIndexRebuilt()` publish, which is
	 * unconditional after `index.rebuild(...)`: a completed EMPTY rebuild announces itself
	 * exactly like a completed full one, and the difference matters — see
	 * `RenovationProjectDeps.indexScanCompleted`, whose docblock carries why "populated" was
	 * the wrong question.
	 *
	 * Never goes back to false. A settings swap re-runs the scan against a new root, and the
	 * fact this records — that a scan has happened in this session — stays true.
	 */
	private indexScanCompleted = false;

	async onload(): Promise<void> {
		// FIRST, ahead of even the logger: importing this bundle has ALREADY put Konva on
		// `window` — its module scope runs before Obsidian calls `onload` — so this is the
		// moment at which that global is provably this load's own and safe to claim.
		this.disposers.push(claimKonvaGlobal());

		// Design slice 13's notices outlive any view — they report things that have nothing to
		// do with an open leaf — so the queue is plugin-scoped and its teardown belongs on the
		// list `onunload` drains. Not the first entry on it: Konva's global got there first.
		//
		// BOTH halves, and in this order. The queue is inert until activated, so without the
		// first line nothing ever shows a notice; without the second, a promise resolving after
		// unload attaches one to a vault with no plugin left to remove it.
		activateNotices();
		this.disposers.push(disposeNotices);

		// The logger is deliberately AHEAD of §9's first step rather than inside its list:
		// it is not one of the things bootstrap sets up, it is what the setup steps report
		// through, and the step below is the first one that can fail.
		const logger = this.logger;
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
		const loaded = await this.loadSettings(logger, createPluginDataProbe(this.app, this.manifest.id));
		// Slice 11's verbose-logging switch — the only thing that consumes the adapter's
		// `setLevel` at all, here and again in `saveSettings` when the preference changes
		// live. Applied once the setting could have been read. Unreadable settings keep the
		// bootstrap floor — no verbosity without a preference that asked for it.
		if (loaded?.verboseLogging) logger.setLevel('debug');
		this.root = createCompositionRoot(
			loaded,
			logger,
			this.vaultStack,
			{ pluginVersion: this.manifest.version, obsidianVersion: apiVersion },
			{ ledger: this.ledger, markers: this.sequenceMarkerStore(logger) },
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

		// Both factories resolve their dependencies PER CALL from the current root rather than
		// capturing one, because `saveSettings` replaces `this.root` and a view built against
		// the old one reads through an index nothing maintains any more.
		//
		// **That is necessary and it is not sufficient**, which is what an earlier version of
		// this comment claimed on both counts. Obsidian calls a registered factory when it
		// CONSTRUCTS a view, so "per call" only ever covered views opened AFTER a swap; every
		// view already on screen kept the previous root indefinitely. `rebindOpenViews` is the
		// other half, and the two share ONE spelling of each bundle below so a rebind can
		// never hand a view something different from what its factory would have built.
		// `projectId: null` — the LIST state — is every fresh leaf's initial bundle: a leaf
		// Obsidian is constructing has no view state to read yet, and the view learning its
		// own restored `projectId` and rebuilding against it is the next task's mechanism.
		this.registerView(RENOVATION_PROJECT_VIEW, (leaf) => new RenovationProjectView(leaf, this.projectViewDeps(leaf)));
		// The Plan Editor is per-plan rather than a singleton, so its factory is asked for a
		// view many times.
		this.registerView(PLAN_EDITOR_VIEW, (leaf) => new PlanEditorView(leaf, this.planEditorViewDeps()));
		// Sidecars are visible, openable files (ADR-011): without the extension
		// registration they render as unsupported attachments in the explorer.
		this.registerExtensions(['rpgeo'], GEOMETRY_SIDECAR_VIEW);
		this.registerView(GEOMETRY_SIDECAR_VIEW, (leaf) => new GeometrySidecarView(leaf));

		// Two ways in, one behaviour: both call the same function, so neither can grow its
		// own idea of what opening the view means — and neither spells the detachment itself.
		// `openProject` returns nothing and answers its own faults, because Obsidian ignores a
		// returned promise and a rejection handler at each door is one each door has to
		// remember. Where that answering LIVES moved a review round later: into
		// `revealCandidate`, so one failed activation is one report however many clicks
		// joined it.
		this.addRibbonIcon(RENOVATION_PROJECT_ICON, tr('command.open-project'), () => {
			this.openProject();
		});

		this.addCommand({
			id: 'open-project',
			name: tr('command.open-project'),
			callback: () => {
				this.openProject();
			},
		});

		/**
		 * Design slice 21: reveal the pane, then go INTO a project.
		 *
		 * A second command rather than behaviour behind the existing `open-project` id, and
		 * the spec's own argument for treating an id as data is the argument for it: a user
		 * whose hotkey means "show me the pane" must not suddenly get a fuzzy picker. The
		 * ribbon shares `open-project`'s copy, so repurposing it would also split the two ways
		 * in that the comment above insists call one function.
		 *
		 * **With no projects in the vault this reveals the LIST**, not a picker and not a
		 * notice — deliberately unlike `open-plan-editor`, which answers `notify(tr('plan.none'))`.
		 * The reason is a property of the surfaces: a Plan Editor with no plan draws nothing,
		 * so a notice is all that command can usefully do, while this view HAS a list state
		 * whose empty state carries a Create button — so revealing it puts the user one click
		 * from the thing they were trying to reach. A zero-row fuzzy picker would be the worst
		 * of the three. Stated here so that nobody later "fixes" the inconsistency by adding a
		 * `project.none` notice and quietly removing the better behaviour.
		 */
		this.addCommand({
			id: 'open-project-detail',
			name: tr('command.open-project-detail'),
			callback: () => {
				this.openProjectDetail();
			},
		});

		this.addCommand({
			id: 'show-diagnostics-report',
			name: tr('command.show-diagnostics-report'),
			callback: () => {
				this.openDiagnosticsReport();
			},
		});

		// The Plan Editor's two commands. Their BEHAVIOUR and their `addCommand` calls both
		// live in one module beside this one — the sentence here used to claim the calls
		// "still happen here", and they never did. What this file keeps is the ORDER: every
		// registration is initiated from this one `onload`, in the sequence SDD §9 states.
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
	 * The tail of the settings write chain, so that no two settings writes are ever in
	 * flight together.
	 *
	 * There are two write doors and they take opposite orderings around their own
	 * `saveData` — see `persistLibraryFolder` — which is exactly why they must not overlap:
	 * `persistLibraryFolder` leaves `this.root.settings` naming the SOURCE folder for the
	 * whole length of its write, and every other control in the settings pane is live
	 * throughout it. A write composed in that window carries the stale `libraryFolder`, and
	 * landing after ours it puts the source back into `data.json` while the session runs on
	 * the destination — a catalogue split in two, which is the outcome the persist-last
	 * ordering exists to prevent, reached by a different route.
	 *
	 * Never rejected: each successor swallows, so a failing write cannot wedge the chain for
	 * the rest of the session. The caller still sees its own rejection, because that is the
	 * promise this hands back rather than the one it stores.
	 */
	private settingsWrites: Promise<void> = Promise.resolve();

	/**
	 * Queue one settings write, and — the half serialization alone does not buy — compose it
	 * INSIDE the chain.
	 *
	 * Serializing is not sufficient on its own: a write whose settings object was built
	 * before the migration persisted still carries the folder the catalogue has left,
	 * however carefully it is ordered afterwards. So a caller hands over a function rather
	 * than an object, and it runs against the state current at the moment it writes.
	 */
	private queueSettingsWrite(write: () => Promise<void>): Promise<void> {
		const result = this.settingsWrites.then(write);
		this.settingsWrites = result.then(swallow, swallow);
		return result;
	}

	/**
	 * The one write path for settings, so no control has to know how they are persisted.
	 * `saveData` replaces the whole file, and the root is REPLACED rather than mutated — its
	 * fields are readonly, so there is exactly one way state changes here.
	 *
	 * It takes a PATCH and composes the rest at execution time, which is the half
	 * serialization alone does not buy. A caller handing over a complete settings object
	 * hands over a SNAPSHOT, and a snapshot is stale for as long as any other write is in
	 * flight — so two controls changed before the queue drains lost the earlier one
	 * outright, and one changed during a library move replayed the folder the catalogue had
	 * just left. Both are the same defect, and taking the whole object from `this.root` at
	 * the moment of the write is the one shape that closes them together.
	 *
	 * `settingsFrom` is still the gate: it drops a key this version does not declare and
	 * falls back on a value outside the vocabulary, so a patch is validated exactly as a
	 * whole object was.
	 */
	saveSettings(patch: SettingsPatch): Promise<void> {
		return this.queueSettingsWrite(async () => {
			// Refused for the whole SESSION, not only at bootstrap: a transient read failure
			// must not stamp defaults over a `data.json` that is sitting there intact. The tab
			// is the other writer and is guarded independently (`getSettingDefinitions`).
			const current = this.root.settings;
			if (current === null) return;

			const composed = settingsFrom({ ...current, ...patch, libraryFolder: current.libraryFolder });
			this.applySettings(composed);
			await this.saveData(composed);
		});
	}

	/**
	 * The library folder's write door, and it is a SEPARATE method rather than a call to
	 * `saveSettings` for one reason: the order.
	 *
	 * `saveSettings` swaps the composition root and rebinds the views BEFORE its own
	 * `saveData` settles, which is right for a preference — the pane's control has already
	 * shown the new value — and destructive here. A rejecting write would leave the running
	 * session composed against the DESTINATION while `data.json` still named the SOURCE, and
	 * the remedy `settings.library-persist-failed` names ("set the library folder to the new
	 * location") cannot be applied, because the library row binds no control. A restart would
	 * then compose against the source and write new catalogue entries there, splitting the
	 * catalogue in two — the outcome that failure arm exists to prevent rather than cause.
	 *
	 * So: write the file, and only then swap. If the write rejects, nothing has been swapped
	 * and the session is still coherent with the file — the notes are at the destination and
	 * the setting is not, which is exactly the state the error's copy describes.
	 */
	persistLibraryFolder(libraryFolder: string): Promise<void> {
		// On the same chain as `saveSettings`, and composed inside it for the same reason:
		// this door's whole hazard is the window between its `saveData` and its root swap,
		// and a write queued behind it must read the settings that swap leaves behind.
		return this.queueSettingsWrite(async () => {
			// The same guard `saveSettings` carries, for the same whole-session reason: a
			// transient read failure must not stamp defaults over a `data.json` sitting there
			// intact.
			const current = this.root.settings;
			if (current === null) return;

			const next = settingsFrom({ ...current, libraryFolder });
			await this.saveData(next);
			this.applySettings(next);
		});
	}

	/**
	 * The Project Index rebuild, as a door the library migration can reach: it moves notes
	 * out from under an index that still names their old paths, and the rebuild is what
	 * makes the session agree with the vault BEFORE the setting is written. The same step
	 * `applySettings` takes after a root swap, so there is one rebuild and not two spellings
	 * of one.
	 */
	rebuildProjectIndex(): void {
		this.startPersistence();
	}

	/**
	 * Everything a settings change does to the RUNNING session, with no write in it. Both
	 * write doors call this; what differs is which side of their own `saveData` they call it
	 * on, which is the whole of `persistLibraryFolder`'s reason to exist.
	 */
	private applySettings(next: RenovationPlannerSettings): void {
		// The verbose-logging floor is re-applied HERE, not only at load: a toggle in the
		// pane takes effect immediately, in both directions, without a plugin reload.
		this.logger.setLevel(next.verboseLogging ? 'debug' : LOG_LEVEL);

		this.root = createCompositionRoot(
			next,
			this.root.logger,
			this.vaultStack,
			{ pluginVersion: this.manifest.version, obsidianVersion: apiVersion },
			{ ledger: this.ledger, markers: this.sequenceMarkerStore(this.root.logger) },
		);
		// The new root carries an EMPTY index. Re-running the build is what makes the swap
		// complete; without it the session reads an index of nothing until the next reload,
		// and every already-registered listener maintains a root nobody consults.
		this.startPersistence();
		// AFTER the rebuild, deliberately: a view rebound first would mount against the new
		// root's still-empty index, draw its "nothing here" state, and need the rebuild event
		// to correct itself. Rebinding second means each view mounts once, against an index
		// that is already populated.
		this.rebindOpenViews();
	}

	/**
	 * ONE spelling of the Renovation Project view's bundle, for the factory and the rebind.
	 *
	 * `leaf` is the leaf THIS bundle belongs to, and `navigate` is bound to it: a click inside
	 * this pane must write to this pane, never to whichever leaf `getLeavesOfType` happens to
	 * answer first — a fact that only bites once the pane is split, since Obsidian's own split
	 * action duplicates a leaf with its view state intact and this view is a singleton only by
	 * the plugin's own construction. `navigateToProject`'s own `targetLeaf` parameter is what
	 * closes that; see its docblock for the split-pane scenario this exists for.
	 *
	 * **The bundle's own `projectId` is inert, and this method takes no parameter for it
	 * BECAUSE it is.** `RenovationProjectView.mount` provides `{ ...this.deps, projectId }`
	 * with the VIEW's own field written last, so whatever a caller put in the bundle is
	 * shadowed at the one place the Vue tree reads it. It was a parameter for two tasks,
	 * and `rebindOpenViews` passed a `projectIdOfLeaf(leaf)` reading of `leaf.getViewState()`
	 * into it under a comment naming that read as what keeps a detail-state pane off the list
	 * across a settings swap — a value nothing could read, a claim the code beside it did not
	 * hold, and an unguarded `getViewState()` inside a loop that rebinds every open view, all
	 * for one member of one bundle. What actually holds that guarantee is
	 * `RenovationProjectView.rebind` never touching `this.projectId`, which is where the
	 * rebind's own docblock already states it and where `rootSwapRebind.test.ts` now asserts
	 * it. `null` is the member's honest value here: the type declares it because the
	 * CONTEXT needs one, and the context gets its own.
	 *
	 * Found by the whole-branch review. Nothing in `npm run check` can see a parameter whose
	 * value is shadowed at the point of use — `fallow` reports unimported files and dead
	 * exports, not a dead argument.
	 */
	private projectViewDeps(leaf: WorkspaceLeaf): RenovationProjectDeps {
		return renovationProjectDeps(this.root, this.app.workspace, this.app.vault, {
			projectId: null,
			// Through `navigateToProject` (Task 11), NOT a raw `setViewState`, and it closes
			// two holes at once. A bare `void` on a rejecting `setViewState` is an unhandled
			// rejection reaching nobody — the shape `runDetached` exists to close, and the
			// palette command's own door already answers it through `reportFault`. And two
			// row clicks before the first write settles issue CONCURRENT writes, where the
			// earlier one can settle last and reopen the project the user has navigated away
			// from: the same window Task 11's write chain closes, on the door a user is far
			// more likely to double-fire than a palette command. Both reported by a review
			// bot against this plan.
			//
			// It is also this repository's own "one action, every input" rule: the row, the
			// Back action and the palette command now reach ONE door rather than two that
			// have to be kept in step. `leaf` is passed as the target: see this method's own
			// docblock for why the type-lookup fallback is not this door's answer.
			navigate: (next) => {
				void navigateToProject(
					{
						workspace: this.app.workspace,
						reportFault: (cause: unknown): void => {
							notifyFault(cause, this.root.logger, 'view.project.reveal-failed');
						},
					},
					RENOVATION_PROJECT_VIEW,
					next,
					leaf,
				);
			},
			indexScanCompleted: () => this.indexScanCompleted,
		});
	}

	/** ONE spelling of the Plan Editor's bundle, for the factory and the rebind. */
	private planEditorViewDeps(): PlanEditorDeps {
		return planEditorDeps(this.root, this.app.workspace, this.app.vault);
	}

	/**
	 * Points every view already on screen at the root that has just replaced the one it was
	 * built against.
	 *
	 * Without this, a swap reached NEW views only. A pane left open across a settings save
	 * went on reading through the previous root's Project Index — which `VaultChangeAdapter`
	 * stops maintaining the moment the root is replaced, so it is not merely stale but frozen
	 * — dispatched writes into the previous root's commands, put new projects under the
	 * previous default folder, and held its `ProjectIndexRebuilt` subscription on a bus
	 * nothing publishes to any more. All four measured across a real `saveSettings`; reported
	 * in review as a P1 against the Renovation Project view, and true of the Plan Editor for
	 * the same reason and since three slices earlier.
	 *
	 * It walks BOTH view types rather than the one that was reported, because "a view built
	 * against a replaced root" is a category and the second member of it was already there.
	 * `instanceof` rather than a view-type string comparison: `getLeavesOfType` is already
	 * keyed by type, and what this needs to know is that the object has the method — a leaf
	 * holding some other plugin's view under our type is not a thing to guess about.
	 */
	private rebindOpenViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(RENOVATION_PROJECT_VIEW)) {
			if (!(leaf.view instanceof RenovationProjectView)) continue;
			// ANNOTATED rather than left to the narrowing, and it is the gate that asks for it:
			// `fallow` resolves a class member through an explicit type, never through a
			// property access, so a `rebind` reached only via `instanceof` is reported as an
			// unused class member. Measured — both views were, before this line existed.
			const view: RenovationProjectView = leaf.view;
			// A settings swap must not silently return a detail-state pane to the list, and
			// what holds that is `rebind` never touching the view's own `projectId` — not
			// anything passed in here. See `projectViewDeps`, which used to take a reading of
			// this leaf's view state under a comment claiming otherwise.
			view.rebind(this.projectViewDeps(leaf));
		}
		for (const leaf of this.app.workspace.getLeavesOfType(PLAN_EDITOR_VIEW)) {
			if (!(leaf.view instanceof PlanEditorView)) continue;
			const view: PlanEditorView = leaf.view;
			view.rebind(this.planEditorViewDeps());
		}
	}

	private vaultStack: VaultStack | null = null;

	/**
	 * The durable marker store behind multi-entity deletes — one plugin-local FILE beside
	 * `data.json`, deliberately not `data.json`'s settings object (`settingsFrom` drops
	 * undeclared keys, which would silently discard an outstanding recovery). One instance
	 * per session: the file it points at survives root swaps, and a store rebuilt per swap
	 * would buy nothing but a second queue.
	 */
	private markerStore: SequenceMarkerFileStore | null = null;

	private sequenceMarkerStore(logger: Logger): SequenceMarkerFileStore {
		this.markerStore ??= new SequenceMarkerFileStore(
			this.app.vault.adapter,
			`${this.manifest.dir}/sequence-markers.json`,
			logger,
		);
		return this.markerStore;
	}

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
	 * are guarded differently. The BUILD repeats, because a new root's index starts empty —
	 * the scan itself is no longer bounded by the project folder, so a changed folder is not
	 * why it repeats. The REGISTRATION does not, because the handlers read `this.root` at
	 * call time and therefore already follow the swap.
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
			}),
		);

		// Set BEFORE the announce, so a subscriber re-hydrating on that event already sees a
		// completed scan. Announcing first would leave the very re-read this flag exists for
		// asking a question the flag still answers `false` to.
		this.indexScanCompleted = true;

		// Announced, because a surface that already read through the index has read a
		// DIFFERENT index. Obsidian restores its leaves before `onLayoutReady`, so a Plan
		// Editor reopened with the app hydrated against an empty one and said "this plan no
		// longer exists" about a plan that does — reported from a real vault. The `void` is
		// deliberate: publishing awaits its subscribers, and nothing here needs to.
		void this.root.eventBus.publish(projectIndexRebuilt());

		// Load-time recovery of an interrupted multi-entity sequence: conditional and
		// idempotent (see the recovery module), so re-running it after a settings swap is
		// safe, and with no outstanding marker it reads one small file and stops.
		//
		// `void` skips an await nobody here needs, and it is safe because the function
		// RESOLVES rather than rejects for every fault: it holds its own try/catch and logs
		// `sequence.recovery.failed`. This comment claimed that while it was false — there
		// was no catch anywhere in that module, so a faulting vault read at load became an
		// unhandled rejection. `tests/application/reference/recovery.test.ts` is what fails
		// without the catch that makes the sentence true.
		if (persistence.markers) {
			void recoverInterruptedSequences({
				markers: persistence.markers,
				requirements: persistence.requirements,
				logger: this.root.logger,
			});
		}

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

	/**
	 * Both ways into the project view, and the place their fault door is COMPOSED — no longer
	 * the place it is called.
	 *
	 * It returns `void` rather than the activation's promise: every caller is an Obsidian
	 * handler that discards one, so handing it back only offers the next caller a rejection to
	 * forget. The bare `void` is honest here in a way CLAUDE.md records it was NOT at the four
	 * doors `runDetached` was written for: `revealView` answers every fault itself and cannot
	 * reject, so there is no rejection left to forget. Routing it through `runDetached` instead
	 * reported once per CLICK, and a double click is two clicks sharing one activation — two
	 * notices and two identical log lines for one failure, which is the defect a review round
	 * found here in exactly the shape it had already found at `openProjectNote`.
	 */
	private openProject(): void {
		void revealView(
			{
				workspace: this.app.workspace,
				reportFault: (cause: unknown): void => {
					notifyFault(cause, this.root.logger, 'view.project.reveal-failed');
				},
			},
			RENOVATION_PROJECT_VIEW,
		);
	}

	/**
	 * The palette's way into the detail state: pick a project, then go there.
	 *
	 * Detached like every other Obsidian handler, and it spells no detachment itself:
	 * `navigateToProject` answers its own faults through `reportFault` and does not reject,
	 * which is `revealView`'s contract carried one step further. The bare `void` is honest for
	 * exactly the reason `openProject`'s docblock gives, and `runDetached` would be wrong here
	 * for the same reason it is wrong there.
	 *
	 * **This is the first production call that passes no `targetLeaf`**, which is the whole
	 * point of the parameter being optional: the palette has no originating leaf, so the leaf
	 * is the one `revealView` ANSWERS. Every mechanism that then applies — the arrival-order
	 * ticket, and the per-leaf write lane a row click in that same pane shares — lives in
	 * `navigateToProject` and is deliberately not restated here: a guard spelled at this call
	 * site would be a second, narrower answer to a question that module already owns.
	 */
	/**
	 * Both doors into the diagnostics report land here, and this is the whole of what either
	 * one does — the command above and `SettingsTab`'s action row, which reaches it through
	 * the same public method. `runDetached` rather than a bare `void`: an Obsidian command
	 * handler returns nothing, so a rejection would otherwise reach nobody.
	 */
	openDiagnosticsReport(): void {
		runDetached(showDiagnosticsReport(this), this.root.logger, 'diagnostics.report.failed');
	}

	private openProjectDetail(): void {
		const projects = entriesOfType(this.root.persistence?.index, 'renovation-project');
		const deps = {
			workspace: this.app.workspace,
			reportFault: (cause: unknown): void => {
				notifyFault(cause, this.root.logger, 'view.project.reveal-failed');
			},
		};
		if (projects.length === 0) {
			// The list, not a picker: see the command's own docblock.
			void navigateToProject(deps, RENOVATION_PROJECT_VIEW, null);
			return;
		}
		new ProjectSuggestModal(this.app, projects, (project) => {
			void navigateToProject(deps, RENOVATION_PROJECT_VIEW, project.id);
		}).open();
	}
}
