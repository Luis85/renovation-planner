import type { FileManager, MetadataCache, Vault, Workspace } from 'obsidian';
import { createEventBus, type EventBus } from '../core/events/EventBus';
import type { Result } from '../core/result/Result';
import type { Logger } from '../application/ports/Logger';
import type { Command } from '../application/commands/Command';
import { createAssetDesignChangeSource } from '../application/events/assetDesignChangeSource';
import { createPlanChangeSource } from '../application/events/planChangeSource';
import { createAssetCatalogueChangeSource } from '../application/events/assetCatalogueChangeSource';
import { createProjectListChangeSource } from '../application/events/projectListChangeSource';
import { createProjectPlansChangeSource } from '../application/events/projectPlansChangeSource';
import { CreatePlanCommand } from '../application/commands/plan/CreatePlan';
import type { CreatePlanInput, CreatePlanError } from '../application/commands/plan/CreatePlan';
import { CreateProjectCommand } from '../application/commands/project/CreateProject';
import type { CreateProjectInput, CreateProjectError } from '../application/commands/project/CreateProject';
import { CreateZoneCommand } from '../application/commands/zone/CreateZone';
import type { CreateZoneInput, CreateZoneError } from '../application/commands/zone/CreateZone';
import { DeleteZoneCommand } from '../application/commands/zone/DeleteZone';
import { ReversibleCalibratePlanCommand } from '../application/commands/plan/ReversibleCalibratePlan';
import { ReversibleSetPlanBackgroundCommand } from '../application/commands/plan/ReversibleSetPlanBackground';
import { SetPlanBackgroundCommand } from '../application/commands/plan/SetPlanBackground';
import type {
	SetPlanBackgroundInput,
	SetPlanBackgroundOutcome,
	SetPlanBackgroundError,
} from '../application/commands/plan/SetPlanBackground';
import type { VaultFileProbe } from '../application/ports/VaultFileProbe';
import type { LibraryOverlaps } from '../application/ports/LibraryOverlaps';
import { createVaultFileProbe } from '../infrastructure/obsidian/vault/vaultFileProbe';
import { createThemeChangeSource } from '../infrastructure/obsidian/workspace/themeChanges';
import { ReferenceLocks } from '../application/reference/ReferenceLocks';
import { RecalculateRequirementCommand } from '../application/commands/requirement/RecalculateRequirement';
import { ObsidianAssetRepository } from '../infrastructure/obsidian/repositories/ObsidianAssetRepository';
import { ObsidianRequirementRepository } from '../infrastructure/obsidian/repositories/ObsidianRequirementRepository';
import {
	createPlanEditorQueries,
	unavailablePlanEditorQueries,
	type PlanEditorQueryServices,
} from '../presentation/read-models/planEditorQueries';
import type { PlanEditorDeps } from '../presentation/views/PlanEditorView';
import { unavailablePlanEditorCommands } from '../presentation/editor/planEditorCommands';
import {
	createAssetDesignerQueries,
	unavailableAssetDesignerQueries,
} from '../presentation/read-models/assetDesignerQueries';
import type { AssetDesignerDeps } from '../presentation/designer/AssetDesignerContext';
import {
	createRenovationProjectQueries,
	unavailableRenovationProjectQueries,
} from '../presentation/read-models/renovationProjectQueries';
import { unavailableRenovationProjectCommands } from '../presentation/views/renovationProjectCommands';
import type { RenovationProjectDeps } from '../presentation/views/RenovationProjectContext';
import { renovationProjectOpenPlan, renovationProjectOpenProject } from './renovationProjectOpenSeams';
import type { ProjectIndex } from '../application/ports/ProjectIndex';
import type { SequenceMarkerStore } from '../application/ports/SequenceMarkerStore';
import type { PlanGeometrySidecar } from '../application/ports/PlanGeometrySidecar';
import type { AssetGeometrySidecar } from '../application/ports/AssetGeometrySidecar';
import type { AssetRepository as AssetRepositoryPort } from '../application/ports/AssetRepository';
import type { RequirementRepository as RequirementRepositoryPort } from '../application/ports/RequirementRepository';
import type { PlanRepository } from '../application/ports/PlanRepository';
import type { ProjectRepository } from '../application/ports/ProjectRepository';
import type { ZoneRepository } from '../application/ports/ZoneRepository';
import type { Loaded } from '../application/ports/versioning';
import type { Project } from '../domain/project/Project';
import type { Plan } from '../domain/plan/Plan';
import type { Zone } from '../domain/zone/Zone';
import { IndexLibraryOverlaps } from '../infrastructure/obsidian/repositories/IndexLibraryOverlaps';
import { PlanGeometryStore } from '../infrastructure/obsidian/repositories/PlanGeometryStore';
import { AssetGeometryStore } from '../infrastructure/obsidian/repositories/AssetGeometryStore';
import { ObsidianAssetGeometrySidecar } from '../infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import type { NoteVaultDeps } from '../infrastructure/obsidian/repositories/NoteVaultDeps';
import { ObsidianPlanGeometrySidecar } from '../infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { ObsidianPlanRepository } from '../infrastructure/obsidian/repositories/ObsidianPlanRepository';
import { ObsidianProjectRepository } from '../infrastructure/obsidian/repositories/ObsidianProjectRepository';
import { ObsidianZoneRepository } from '../infrastructure/obsidian/repositories/ObsidianZoneRepository';
import { createMigrationRunner, type MigrationRunner } from '../infrastructure/persistence/migration/MigrationRunner';
import { MIGRATION_SET } from '../infrastructure/persistence/migration/migrationSet';
import { EchoWindow } from '../infrastructure/persistence/index/EchoWindow';
import { InMemoryProjectIndex } from '../infrastructure/persistence/index/InMemoryProjectIndex';
import { VaultChangeAdapter } from '../infrastructure/persistence/index/VaultChangeAdapter';
import { guardCommand } from '../application/errors/guardAgainstThrowing';
import { InMemoryDiagnosticsLedger } from '../infrastructure/logging/diagnosticsLedger';
import type { DiagnosticsLedger, RuntimeVersions } from '../application/ports/diagnostics';
import {
	VAULT_EXCEPTION_MAPPER,
	guardAssetDesign,
	guardCalibratePlan,
	guardSlice10,
	guardedEditorServices,
	type GuardedAssetDesignServices,
	type GuardedEditorServices,
	type GuardedSlice10Services,
	type QueryServices,
	type UnguardedSlice10Services,
} from './guardedServices';
import { composeSlice10, sequenceNotices, type Slice10Wiring } from './slice10Composition';
import type { RenovationPlannerSettings } from './settings/settings';

/**
 * The ONE place dependencies are composed (SDD §10). At this slice it composes two things,
 * and the commented members are not a wish list — they are the promise this seam makes:
 * every later slice adds a FIELD and a constructor parameter here, and never a second
 * wiring point somewhere else in the plugin.
 *
 * `plugin/` is the only layer allowed to import from every other one, which is the entire
 * reason the inner layers can stay ignorant of Obsidian: something has to know how to build
 * a `ZoneRepository` from an `App`, and it is this file rather than `domain/zone/`.
 */
export interface CompositionRoot {
	/**
	 * `null` when `data.json` could not be READ — not when it is absent, which is a fresh
	 * install and loads defaults normally. Deliberately not "defaults on failure": a
	 * folder path in here makes a default a different LOCATION, not a milder version of
	 * the user's, so an index built on it scans folders the projects are not in.
	 *
	 * Every consumer therefore has to face the case, which is the point rather than a cost:
	 * code wanting a default for a display preference writes `?? DEFAULT_SETTINGS` and is
	 * visibly choosing it, while code needing a folder path cannot be handed a plausible
	 * wrong one.
	 */
	readonly settings: RenovationPlannerSettings | null;
	/**
	 * Not one of §10's five members, and held here because slice 11 states the wiring as a
	 * contract: the `Logger` is injected via the composition root like any other Application
	 * port. If the root did not hold it from its first version, the injection point would
	 * have to MOVE later — and this seam is extended by a field, never relocated.
	 */
	readonly logger: Logger;
	/**
	 * §10's event bus, which arrived with slice 5's first publishing command
	 * (`SetPlanBackgroundCommand`). Held at the TOP level rather than inside
	 * `persistence`, because it is not about persistence: a bus with no subscribers is
	 * still a correct bus, and a session whose settings could not be read has to be able
	 * to publish and hear events that have nothing to do with the vault.
	 */
	readonly eventBus: EventBus;
	/**
	 * Everything slice 4 persists through — repositories, the index, the geometry store,
	 * the read-side queries, and the vault-change pipeline. `null` exactly when `settings`
	 * is.
	 *
	 * **The reason is conservatism, stated as that rather than dressed as a necessity.**
	 * It used to read "a service that reads or writes has no correct behaviour without the
	 * configuration that names where", and ADR-0013 retired that: the index is bounded by
	 * what a note DECLARES, and an existing project's folder comes from where its own note
	 * sits, so reads and writes to projects that already exist need the setting for nothing.
	 * The one door that still does is creating a NEW project's folder
	 * (`freshProjectFolder`). Composing the stack anyway would give this session one door
	 * with no answer and every other door working; composing none gives it one failure mode
	 * and one code (`settings.unrecovered`) at every door instead — for a session whose
	 * `data.json` is present and unreadable, which is also a session this plugin refuses to
	 * write settings for at all (`saveSettings` returns early). Narrowing it to the creation
	 * path is available and belongs with slice 16's creation form, which is the surface that
	 * would ask.
	 */
	readonly persistence: PersistenceServices | null;
}

/**
 * Everything the persistence stack hands out, with the Error Boundary already around it:
 * every `Command` and `Query` member here is a GUARDED wrapper (SDD §66), which is why the
 * three guarded groups are EXTENDED rather than re-declared — the shapes and the guards that
 * produce them live together in `guardedServices.ts`, so a member added there cannot be
 * forgotten here.
 */
export interface PersistenceServices
	extends GuardedEditorServices,
		GuardedSlice10Services,
		GuardedAssetDesignServices {
	readonly index: ProjectIndex;
	readonly vaultDeps: NoteVaultDeps;
	readonly migrations: MigrationRunner;
	readonly geometryStore: PlanGeometryStore;
	/**
	 * The slice-7 port over the same store, for `ReversibleCalibratePlanCommand` — the only
	 * collaborator here that reads and writes calibration rather than an entity note.
	 */
	readonly geometry: PlanGeometrySidecar;
	/**
	 * ADR-0014's asset sidecar as a PORT, beside the plan one — the collaborator every asset
	 * design command writes through, exposed for the reason `geometry` above is: a port a
	 * command holds and nothing hands out is a port no test can detonate, and
	 * `tests/plugin/guardCategory.test.ts` proves the boundary by breaking exactly the
	 * collaborators a service reads through. Phase B's reversible design adapters restore
	 * snapshots through it, the way the Inspector's restore through `zones`.
	 */
	readonly assetGeometry: AssetGeometrySidecar;
	readonly projects: ProjectRepository;
	readonly plans: PlanRepository;
	readonly zones: ZoneRepository;
	/** Design slice 10's catalog and link entities. */
	readonly assets: AssetRepositoryPort;
	readonly requirements: RequirementRepositoryPort;
	/** The one reference-lock set per plugin; every command that links or unlinks shares it. */
	readonly locks: ReferenceLocks;
	readonly queries: QueryServices;
	/** Does a raw Vault file exist — what `SetPlanBackgroundCommand` validates through. */
	readonly files: VaultFileProbe;
	/**
	 * §83's overlap answer, exposed because TWO read surfaces need it and neither can derive
	 * it: `ListProjects` takes it as a collaborator for the list's own marker, and
	 * `createRenovationProjectQueries` takes it so the single-project door answers the same
	 * `ProjectSummaryDto` truthfully rather than fabricating a `false` for a folder it never
	 * compared. One instrument, so the two surfaces cannot disagree about one project.
	 */
	readonly overlaps: LibraryOverlaps;
	/**
	 * The read side the Plan Editor actually consumes: slice 4's queries mapped into
	 * presentation read models. Composed here rather than in the view, so the view is handed
	 * an interface and never a repository.
	 */
	readonly planEditorQueries: PlanEditorQueryServices;
	/**
	 * The three creates, which existed with full test coverage and NO caller outside
	 * `application/` until something in the app asked for one — so a vault contained no
	 * project, plan or zone note and slices 3, 4 and 5 were unreachable from inside
	 * Obsidian. Composed here for the same reason every other service is: the write side a
	 * command or a view consumes is an interface handed to it, never a repository it built.
	 * Typed as `Command` rather than the concrete class because what leaves this root is
	 * GUARDED (SDD §66): a wrapper object with the same `execute`, not the class itself.
	 *
	 * `create-sample-project` is their only caller today (`sampleProject.ts`). This sentence
	 * has already named the wrong next caller twice: "slice 15's creation dialogs" (slice 15
	 * shipped only the dialog framework those forms mount in, no caller of its own), then
	 * "slice 14's empty-state actions" (slice 14 shipped no create action — two empty states
	 * render no button, the third activates a tool instead of dispatching a command). Slice
	 * 16's creation forms are the only wiring left to name; read that as a name, not a caller.
	 */
	readonly createProject: Command<CreateProjectInput, Result<{ project: Loaded<Project> }, CreateProjectError>>;
	readonly createPlan: Command<CreatePlanInput, Result<{ plan: Loaded<Plan> }, CreatePlanError>>;
	readonly createZone: Command<CreateZoneInput, Result<{ zone: Loaded<Zone> }, CreateZoneError>>;
	/**
	 * Slice 5's one write in its second face: the undoable adapter slice 6's
	 * `CommandHistory` holds. It WRAPS the plain command rather than duplicating it, so
	 * there is one forward write however it is dispatched, and both faces are guarded.
	 */
	readonly reversibleSetPlanBackground: Command<
		SetPlanBackgroundInput,
		Result<SetPlanBackgroundOutcome, SetPlanBackgroundError>
	>;
	/** Subscriptions the plugin must dispose on unload; filled at composition time. */
	readonly subscriptions: { dispose(): void }[];
	/**
	 * The durable marker store behind multi-entity sequences, when composed over real
	 * plugin-local storage — what load-time recovery walks. Absent only in tests that
	 * compose without one.
	 */
	readonly markers?: SequenceMarkerStore;
	/** Debounced create/modify/rename/delete → incremental index maintenance. */
	readonly changeAdapter: VaultChangeAdapter;
}

/**
 * The vault collaborators the persistence stack reads and writes through — the raw
 * `app` surface, gathered once so nothing downstream needs the whole `App`.
 */
export interface VaultStack {
	readonly vault: Vault;
	readonly fileManager: FileManager;
	readonly metadataCache: MetadataCache;
}

/**
 * The collaborators that OUTLIVE a root, supplied by the plugin rather than built here.
 * `saveSettings` rebuilds this whole stack, and neither of these may be rebuilt with it:
 * validation issues recorded before the change describe the SESSION's vault reads rather
 * than the previous settings object, and an outstanding delete sequence's marker file
 * survives a settings change exactly the way it survives a reload.
 *
 * One parameter rather than two because `max-params` is five and `environment` already
 * takes the fourth — and because these two are the same KIND of thing, which is what makes
 * the grouping a statement instead of a workaround.
 */
export interface SessionCollaborators {
	readonly ledger?: DiagnosticsLedger;
	readonly markers?: SequenceMarkerStore;
}

function composeRepositories(deps: NoteVaultDeps, vault: VaultStack, newProjectRoot: string, libraryFolder: string) {
	const geometryStore = new PlanGeometryStore(vault.vault, vault.fileManager, deps.index, deps.migrations, deps.echo);
	// ONE store, two consumers, and the sharing is the point rather than an economy: the
	// asset repository holds it for the DELETE (an asset's note and its sidecar go together)
	// and the design commands write through the port below it, and `KeyedQueues` is per
	// INSTANCE — so a second store built beside this one would split the per-asset lock those
	// two share and leave a delete free to interleave with a design write.
	const assetGeometryStore = new AssetGeometryStore(vault.vault, vault.fileManager, libraryFolder, deps.echo);
	return {
		geometryStore,
		// The port, not the store: `plugin/` is where an infrastructure class becomes the
		// application's own interface, and the design commands are typed against the port.
		assetGeometry: new ObsidianAssetGeometrySidecar(assetGeometryStore),
		// `newProjectRoot` is a real argument, not `deps.projectFolder` read inline — this
		// repository is the only one that ever writes a note whose folder does not already
		// exist to be derived from, so it takes the setting as its own constructor
		// argument rather than through the shared `NoteVaultDeps` field. That field is what
		// Task 7 deletes; reading it here would have left this call site needing a second
		// edit the day it goes.
		projects: new ObsidianProjectRepository(deps, newProjectRoot, libraryFolder),
		plans: new ObsidianPlanRepository(deps, geometryStore),
		zones: new ObsidianZoneRepository(deps, geometryStore),
		assets: new ObsidianAssetRepository(deps, libraryFolder, assetGeometryStore),
		requirements: new ObsidianRequirementRepository(deps),
		// §83's third site, which has no door to refuse at: ADR-0013 derives a project's
		// folder from where its `Project.md` sits, so a user moves a project by dragging a
		// folder in Obsidian's file explorer. Composed here rather than passed as a sixth
		// argument to `composeGuarded`, which already sits at `max-params`: this is the
		// bundle built from `deps.index` and the library setting, and both are already here.
		overlaps: new IndexLibraryOverlaps(deps.index, libraryFolder),
	};
}

/**
 * Everything that leaves the root through the Error Boundary, in ONE place: the guard is
 * applied here and nowhere else, so "is this service guarded?" is answered by whether it
 * is composed in this function. Its collaborators are the same ones the unguarded
 * composition already built — nothing is constructed twice.
 */
function composeGuarded(
	repositories: ReturnType<typeof composeRepositories>,
	slice10: UnguardedSlice10Services,
	wiring: Slice10Wiring,
	files: VaultFileProbe,
	diagnostics: { versions: RuntimeVersions; migrations: MigrationRunner; ledger: DiagnosticsLedger },
) {
	const { projects, plans, zones, assets, assetGeometry, requirements, overlaps } = repositories;
	const { events: eventBus, logger, recalculate, locks, markers } = wiring;
	const map = VAULT_EXCEPTION_MAPPER;
	const deleteZone = new DeleteZoneCommand({
		zones,
		requirements,
		recalculate,
		events: eventBus,
		locks,
		logger,
		markers,
		notify: sequenceNotices,
	});
	const editor = guardedEditorServices(
		{ projects, plans, zones, deleteZone },
		{ eventBus, files, logger, map, overlaps },
		diagnostics,
	);
	return {
		...editor,
		...guardSlice10(slice10, recalculate, logger, map),
		...guardAssetDesign({ sidecar: assetGeometry, assets, events: eventBus }, logger, map),
		createProject: guardCommand(new CreateProjectCommand(projects, eventBus), 'command.createProject.failed', logger, map),
		createPlan: guardCommand(new CreatePlanCommand(plans, projects, eventBus), 'command.createPlan.failed', logger, map),
		createZone: guardCommand(new CreateZoneCommand(zones, plans, eventBus), 'command.createZone.failed', logger, map),
		reversibleSetPlanBackground: guardCommand(
			new ReversibleSetPlanBackgroundCommand(new SetPlanBackgroundCommand(plans, files, eventBus), plans),
			'command.setPlanBackground.undoable.failed',
			logger,
			map,
		),
	};
}

export function createCompositionRoot(
	settings: RenovationPlannerSettings | null,
	logger: Logger,
	vault: VaultStack | null = null,
	/** Defaults to 'unknown' pairs so a test double can compose without an Obsidian app. */
	environment: RuntimeVersions = { pluginVersion: 'unknown', obsidianVersion: 'unknown' },
	session: SessionCollaborators = {},
): CompositionRoot {
	// Wired to the logger from its first line: `createEventBus`'s `onError` is where a
	// throwing subscriber goes, and a bus built without one loses those failures silently
	// — which the bus's own docblock names as the thing to fix as soon as a logger exists.
	const eventBus = createEventBus((error, event) => {
		logger.error('events.subscriber.failed', { cause: error, event: event.type });
	});

	if (settings === null || vault === null) {
		return { settings, logger, eventBus, persistence: null };
	}

	const ledger = session.ledger ?? new InMemoryDiagnosticsLedger();
	const markers = session.markers;
	const index = new InMemoryProjectIndex();
	const echo = new EchoWindow();
	const migrations = createMigrationRunner(MIGRATION_SET);

	const deps: NoteVaultDeps = {
		vault: vault.vault,
		fileManager: vault.fileManager,
		metadataCache: vault.metadataCache,
		index,
		echo,
		migrations,
		logger,
		ledger,
	};
	const repositories = composeRepositories(deps, vault, settings.projectFolder, settings.libraryFolder);
	const { geometryStore, projects, plans, zones, assets, requirements } = repositories;

	// One lock set per plugin: assignment, unit changes and delete resolutions across
	// every view serialize against the same keys.
	const locks = new ReferenceLocks();
	const recalculate = new RecalculateRequirementCommand(requirements, zones, assets, eventBus);
	const wiring: Slice10Wiring = {
		zones,
		assets,
		requirements,
		projects,
		index,
		recalculate,
		events: eventBus,
		locks,
		logger,
		markers,
	};
	const slice10 = composeSlice10(wiring);

	const files = createVaultFileProbe(vault.vault);
	const guarded = composeGuarded(repositories, slice10, wiring, files, {
		versions: environment,
		migrations,
		ledger,
	});

	return {
		settings,
		logger,
		eventBus,
		persistence: {
			index,
			vaultDeps: deps,
			migrations,
			geometryStore,
			geometry: new ObsidianPlanGeometrySidecar(geometryStore),
			assetGeometry: repositories.assetGeometry,
			projects,
			plans,
			zones,
			assets,
			requirements,
			locks,
			files,
			overlaps: repositories.overlaps,
			...guarded,
			planEditorQueries: createPlanEditorQueries({
				...guarded.queries,
				...guarded.requirementQueries,
			}),
			subscriptions: slice10.subscriptions,
			markers,
			changeAdapter: new VaultChangeAdapter({
				vault: vault.vault,
				metadataCache: vault.metadataCache,
				index,
				echo,
				logger,
				// REQUIRED rather than optional, and this is the wiring the requirement buys: an
				// optional bus would let a root that forgets it compile, pass and announce nothing,
				// which is the one failure this whole mechanism exists to prevent.
				events: eventBus,
			}),
		},
	};
}

/**
 * The Plan Editor's own dependency bundle, assembled from a composed root.
 *
 * A function rather than another `CompositionRoot` field, because it needs the
 * `Workspace` — which is not part of the vault stack the persistence layer reads through —
 * and because it answers `null` for a session with no persistence at all: with settings
 * unrecovered there is no query service to hand a view, so registering one that would
 * draw an empty pane is worse than not being able to open it.
 */
export function planEditorDeps(
	root: CompositionRoot,
	workspace: Workspace,
	vault: Vault,
): PlanEditorDeps {
	const persistence = root.persistence;
	return {
		// TOTAL rather than nullable, and that is the point: with settings unrecovered there
		// is no query service to hand over, so the view is handed one that REFUSES and shows
		// the same failed state it shows for any unreadable plan. The alternatives were a
		// nullable dependency every caller has to branch on, or not registering the view at
		// all — which would leave a restored Plan Editor leaf pointing at a view type
		// Obsidian does not know.
		queries: persistence?.planEditorQueries ?? unavailablePlanEditorQueries(),
		commands: persistence
			? {
					createZone: persistence.createZone,
					moveObject: persistence.moveZone,
					deleteZone: persistence.deleteZone,
					zones: persistence.zones,
					zoneInspector: persistence.zoneInspector,
					requirementEdits: {
						// The GUARDED services, not the composed classes: the adapters take
						// structural doors (`Command`, `…Door`) precisely so a wrapper can
						// stand where the class used to, which is what puts these three
						// inside the Error Boundary instead of beside it.
						assignAsset: persistence.assignAsset,
						setQuantityOverride: persistence.setRequirementQuantityOverride,
						setCostOverride: persistence.setRequirementCostOverride,
						requirements: persistence.requirements,
						assets: persistence.assets,
						locks: persistence.locks,
					},
					// The LEAF's logger, beside the bundles rather than inside one of them:
					// a failed compensation inside a reversible adapter's undo writes to it,
					// and so does `notifyFault` at the two raw-port fault doors in
					// `runtime.ts` — and the second of those is not about requirement edits.
					logger: root.logger,
					// A new command per call — see `CalibratePlanTransaction` — and GUARDED
					// per call, because the factory is the only door this one has: it never
					// passes through `PersistenceServices`, so `composeGuarded` cannot reach
					// it, and the tool's dispatch path has no `.catch` of its own.
					calibratePlan: () =>
						guardCalibratePlan(
							new ReversibleCalibratePlanCommand(persistence.plans, persistence.geometry, root.eventBus),
							root.logger,
							VAULT_EXCEPTION_MAPPER,
						),
				}
			: unavailablePlanEditorCommands(),
		vault,
		onThemeChange: createThemeChangeSource(workspace),
		onPlanChanged: createPlanChangeSource(root.eventBus),
		onCatalogueChanged: createAssetCatalogueChangeSource(root.eventBus),
	};
}

/**
 * The asset designer's own dependency bundle (design slice B3, ADR-0015).
 *
 * It takes neither a `Workspace` nor a `Vault`, which is the whole difference from its two
 * siblings and is a fact about the surface rather than an omission: the designer navigates
 * nowhere and reads no raw file. Task B7's background picker is the member that changes that,
 * and Task B3a's command bundle is the other one — both are a field added here, not a
 * relocation.
 *
 * TOTAL rather than nullable, for `planEditorDeps`'s reason: with settings unrecovered there is
 * no query service to hand over, so the view is handed one that REFUSES and draws the same
 * failure state it draws for any unreadable asset. Not registering the view at all would leave a
 * restored designer leaf pointing at a view type Obsidian does not know.
 */
export function assetDesignerDeps(
	root: CompositionRoot,
	options: { indexScanCompleted: () => boolean },
): AssetDesignerDeps {
	const persistence = root.persistence;
	return {
		queries:
			persistence === null
				? unavailableAssetDesignerQueries()
				: createAssetDesignerQueries(persistence.assetDesign),
		logger: root.logger,
		// Wired from the bus UNCONDITIONALLY, persistence or not, for the reason
		// `renovationProjectDeps.onPlansChanged` states: the bus is the root's own and exists
		// either way, and a refusal bundle re-reading simply refuses again.
		onDesignChanged: createAssetDesignChangeSource(root.eventBus),
		indexScanCompleted: options.indexScanCompleted,
	};
}

/**
 * The Renovation Project view's own dependency bundle (design slice 14, widened by slice 16's
 * write side) — the seam slice 1 reserved in writing, extended by a field rather than
 * relocated.
 *
 * Takes a `Workspace` and a `Vault` now, like `planEditorDeps`: slice 16 gave this view its
 * first write (`commands.createProject`) and its first way to open a note (`openProject`),
 * and the latter needs both to resolve a project's id to a file and reveal it.
 * `unavailableRenovationProjectQueries()`/`unavailableRenovationProjectCommands()` when
 * `root.persistence` is `null` are the same total-rather-than-nullable shape `planEditorDeps`
 * uses for the identical situation — a nullable dependency would make every caller branch on
 * it, and refusing to register the view at all would leave a restored leaf pointing at a view
 * type Obsidian does not know. `openProject` answers `'failed'` rather than a refusal in that
 * state: there is no index to resolve a path through, and nothing to tell the user that the
 * list — empty for the same reason — has not already told them. It is `'failed'` and not
 * `'missing'` because `'missing'` asks the view to re-read a list that has nothing to re-read.
 *
 * **The composed closure also owes the deferred half of Task 5's own review**: `ProjectList`'s
 * row click discards the promise this returns (`@open="(id) => void context.openProject(id)"`),
 * so a rejecting `openFile` (a real I/O fault, never the "id resolves to nothing" case
 * `openProjectNote` already handles by design) would otherwise be an unhandled rejection
 * reaching nobody. What travels down is the `reportFault` door — `notifyFault`, the same
 * mapping a guarded command's fault would have taken — rather than a `.catch` wrapped around
 * the call. It is composed HERE because `openProjectNote` is `infrastructure/`, which may not
 * import `presentation/notices/notify` (the layer ban runs the other way) and `plugin/` is the
 * one layer that may reach both; it is CALLED down there because that is where the coalescing
 * is. A `.catch` at this end reported once per CLICK, and a double click is two clicks sharing
 * one open: two notices and two identical log lines for one operation, which is the defect a
 * review round found in the shape this replaced.
 *
 * `options` carries what only the CALLER can know — `projectId` is the view's own field,
 * `navigate` is bound to `navigateToProject` one caller up (this function may not import
 * Obsidian's own `notifyFault`-mapped `reportFault` shape twice), and `indexScanCompleted`
 * reads a session-scoped flag the plugin owns. A default here would let a composition forget
 * one and still compile — the same self-declared shape this repository already refuses, and
 * the reason Task 3's own wiring case grows an explicit fourth argument instead.
 */
export function renovationProjectDeps(
	root: CompositionRoot,
	workspace: Workspace,
	vault: Vault,
	options: {
		projectId: string | null;
		navigate: (projectId: string | null) => void;
		indexScanCompleted: () => boolean;
	},
): RenovationProjectDeps {
	const persistence = root.persistence;
	return {
		projectId: options.projectId,
		navigate: options.navigate,
		indexScanCompleted: options.indexScanCompleted,
		openPlan: persistence ? renovationProjectOpenPlan(workspace, root.logger) : () => Promise.resolve(),
		// Wired from the bus UNCONDITIONALLY, persistence or not, for the reason
		// `onProjectsChanged` states three lines down: the bus is the root's own and exists
		// either way, and a refusal bundle re-reading simply refuses again.
		onPlansChanged: createProjectPlansChangeSource(root.eventBus),
		queries: persistence
			? createRenovationProjectQueries(
					persistence.listProjects,
					persistence.queries.getProject,
					persistence.listPlansByProject,
					persistence.overlaps,
				)
			: unavailableRenovationProjectQueries(),
		commands: persistence
			? {
					createProject: persistence.createProject,
					createPlan: persistence.createPlan,
					// Design slice A10. `assetDesign` is the guarded bundle slice A9 composed, and
					// only the one door the creation form dispatches is handed over: the rest of
					// that bundle belongs to the designer view Phase B builds, and spreading it
					// here would make this the second place its membership is decided.
					createAsset: persistence.createAsset,
					setAssetFootprintFromDimensions: persistence.assetDesign.setFootprintFromDimensions,
					logger: root.logger,
				}
			: unavailableRenovationProjectCommands(),
		openProject: persistence
			? renovationProjectOpenProject(workspace, vault, persistence.index, root.logger)
			: () => Promise.resolve('failed'),
		// Wired from the bus UNCONDITIONALLY, persistence or not, and that is the honest
		// shape rather than a convenience: the bus is the root's own and exists either way,
		// and a refusal bundle re-reading on a rebuild simply refuses again. Making this the
		// one member that turns into a no-op when `persistence` is null would be a second
		// answer to "is this session wired", decided in a different place from the other
		// three — and the arm that would take it is the arm where no index rebuild is ever
		// published, so it would never run.
		onProjectsChanged: createProjectListChangeSource(root.eventBus),
	};
}
