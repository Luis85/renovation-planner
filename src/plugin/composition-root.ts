import type { FileManager, MetadataCache, Vault, Workspace } from 'obsidian';
import { createEventBus, type EventBus } from '../core/events/EventBus';
import type { Logger } from '../application/ports/Logger';
import { createPlanChangeSource } from '../application/events/planChangeSource';
import { CreatePlanCommand } from '../application/commands/plan/CreatePlan';
import { CreateProjectCommand } from '../application/commands/project/CreateProject';
import { CreateZoneCommand } from '../application/commands/zone/CreateZone';
import { DeleteZoneCommand } from '../application/commands/zone/DeleteZone';
import { MoveSpatialObjectCommand } from '../application/commands/zone/MoveSpatialObject';
import { GetZoneInspector } from '../application/queries/GetZoneInspector';
import { ReversibleCalibratePlanCommand } from '../application/commands/plan/ReversibleCalibratePlan';
import { ReversibleSetPlanBackgroundCommand } from '../application/commands/plan/ReversibleSetPlanBackground';
import { SetPlanBackgroundCommand } from '../application/commands/plan/SetPlanBackground';
import type { VaultFileProbe } from '../application/ports/VaultFileProbe';
import { createVaultFileProbe } from '../infrastructure/obsidian/vault/vaultFileProbe';
import { createThemeChangeSource } from '../infrastructure/obsidian/workspace/themeChanges';
import { ReferenceLocks } from '../application/reference/ReferenceLocks';
import { CreateAssetCommand } from '../application/commands/asset/CreateAsset';
import { UpdateAssetCommand } from '../application/commands/asset/UpdateAsset';
import { DeleteAssetCommand } from '../application/commands/asset/DeleteAsset';
import { AssignAssetCommand } from '../application/commands/requirement/AssignAsset';
import { RecalculateRequirementCommand } from '../application/commands/requirement/RecalculateRequirement';
import { SetRequirementQuantityOverrideCommand } from '../application/commands/requirement/SetRequirementQuantityOverride';
import { SetRequirementCostOverrideCommand } from '../application/commands/requirement/SetRequirementCostOverride';
import { DeleteRequirementCommand } from '../application/commands/requirement/DeleteRequirement';
import { GetRequirementsForZone } from '../application/queries/GetRequirementsForZone';
import { ListAssets } from '../application/queries/ListAssets';
import { ListRequirementsReferencing } from '../application/queries/ListRequirementsReferencing';
import { ListReassignmentTargets } from '../application/queries/ListReassignmentTargets';
import { registerOnZoneGeometryChanged } from '../application/event-handlers/requirement/onZoneGeometryChanged';
import { registerOnAssetUpdated } from '../application/event-handlers/requirement/onAssetUpdated';
import { ASSET_MIGRATIONS } from '../infrastructure/persistence/migration/entities/asset/asset.migrations';
import { REQUIREMENT_MIGRATIONS } from '../infrastructure/persistence/migration/entities/requirement/requirement.migrations';
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
	createRenovationProjectQueries,
	unavailableRenovationProjectQueries,
} from '../presentation/read-models/renovationProjectQueries';
import type { RenovationProjectDeps } from '../presentation/views/RenovationProjectContext';
import { notify } from '../presentation/notices/notify';
import { tr } from '../presentation/i18n/strings';
import { FindZonesByPlan } from '../application/queries/FindZonesByPlan';
import { GetPlan } from '../application/queries/GetPlan';
import { GetProject } from '../application/queries/GetProject';
import { GetZone } from '../application/queries/GetZone';
import { ListProjects } from '../application/queries/ListProjects';
import type { ProjectIndex } from '../application/ports/ProjectIndex';
import type { SequenceMarkerStore } from '../application/ports/SequenceMarkerStore';
import type { PlanGeometrySidecar } from '../application/ports/PlanGeometrySidecar';
import type { AssetRepository as AssetRepositoryPort } from '../application/ports/AssetRepository';
import type { RequirementRepository as RequirementRepositoryPort } from '../application/ports/RequirementRepository';
import type { PlanRepository } from '../application/ports/PlanRepository';
import type { ProjectRepository } from '../application/ports/ProjectRepository';
import type { ZoneRepository } from '../application/ports/ZoneRepository';
import { PlanGeometryStore } from '../infrastructure/obsidian/repositories/PlanGeometryStore';
import type { NoteVaultDeps } from '../infrastructure/obsidian/repositories/NoteVaultDeps';
import { ObsidianPlanGeometrySidecar } from '../infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { ObsidianPlanRepository } from '../infrastructure/obsidian/repositories/ObsidianPlanRepository';
import { ObsidianProjectRepository } from '../infrastructure/obsidian/repositories/ObsidianProjectRepository';
import { ObsidianZoneRepository } from '../infrastructure/obsidian/repositories/ObsidianZoneRepository';
import { createMigrationRunner, type MigrationRunner } from '../infrastructure/persistence/migration/MigrationRunner';
import { PLAN_MIGRATIONS } from '../infrastructure/persistence/migration/entities/plan/plan.migrations';
import { ZONE_MIGRATIONS } from '../infrastructure/persistence/migration/entities/zone/zone.migrations';
import { PROJECT_MIGRATIONS } from '../infrastructure/persistence/migration/project/project.migrations';
import { PLAN_GEOMETRY_MIGRATIONS } from '../infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';
import { EchoWindow } from '../infrastructure/persistence/index/EchoWindow';
import { InMemoryProjectIndex } from '../infrastructure/persistence/index/InMemoryProjectIndex';
import { VaultChangeAdapter } from '../infrastructure/persistence/index/VaultChangeAdapter';
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
	 * is: compose no repository, no index, no query service against an unrecovered
	 * location, because a service that reads or writes has no correct behaviour without
	 * the configuration that names where.
	 */
	readonly persistence: PersistenceServices | null;
}

/** The read side a view or command consumes; never a concrete repository type. */
export interface QueryServices {
	readonly getProject: GetProject;
	readonly getPlan: GetPlan;
	readonly getZone: GetZone;
	readonly findZonesByPlan: FindZonesByPlan;
}

export interface PersistenceServices {
	readonly index: ProjectIndex;
	readonly vaultDeps: NoteVaultDeps;
	readonly migrations: MigrationRunner;
	readonly geometryStore: PlanGeometryStore;
	/**
	 * The slice-7 port over the same store, for `ReversibleCalibratePlanCommand` — the only
	 * collaborator here that reads and writes calibration rather than an entity note.
	 */
	readonly geometry: PlanGeometrySidecar;
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
	 * The read side the Plan Editor actually consumes: slice 4's queries mapped into
	 * presentation read models. Composed here rather than in the view, so the view is handed
	 * an interface and never a repository.
	 */
	readonly planEditorQueries: PlanEditorQueryServices;
	/**
	 * The Renovation Project view's own read side (design slice 14): the raw
	 * `ListProjects` application class, one query today. Unlike `planEditorQueries`
	 * above, this field is NOT mapped into presentation read models here — that mapping
	 * happens one level down, in `renovationProjectDeps`'s call to
	 * `createRenovationProjectQueries` (below). The asymmetry is real, not an
	 * inconsistency to fix: the view is still handed an interface
	 * (`RenovationProjectQueryServices`) and never builds one from the raw class itself,
	 * which is the guarantee this field exists to preserve; only WHERE the mapping is
	 * composed differs from `planEditorQueries`.
	 */
	readonly listProjects: ListProjects;
	/**
	 * The three creates, which existed with full test coverage and NO caller outside
	 * `application/` until something in the app asked for one — so a vault contained no
	 * project, plan or zone note and slices 3, 4 and 5 were unreachable from inside
	 * Obsidian. Composed here for the same reason every other service is: the write side a
	 * command or a view consumes is an interface handed to it, never a repository it built.
	 *
	 * `create-sample-project` is their only caller today (`sampleProject.ts`). Slice 14's
	 * empty-state actions and slice 16's creation FORMS are what give them product-real ones;
	 * neither needs a second wiring point, only a second call. (This used to name "slice 15's
	 * creation dialogs" — slice 15 shipped the dialog framework those forms will be mounted
	 * in, and no form of its own beyond the calibration prompt, so the promise outlived the
	 * slice that was supposed to keep it.)
	 */
	readonly createProject: CreateProjectCommand;
	readonly createPlan: CreatePlanCommand;
	readonly createZone: CreateZoneCommand;
	/**
	 * Slice 5's one write, in both faces: the plain command, and the undoable adapter
	 * slice 6's `CommandHistory` will hold. The adapter WRAPS the command rather than
	 * duplicating it, so there is one forward write however it is dispatched.
	 */
	readonly setPlanBackground: SetPlanBackgroundCommand;
	readonly reversibleSetPlanBackground: ReversibleSetPlanBackgroundCommand;
	/**
	 * Design slice 8's write side for the Plan Editor, beside slice 5's background pair:
	 * the plain zone commands the editor's reversible adapters wrap (one adapter per
	 * gesture, built inside the editor), and the Inspector query. Composed here so
	 * `presentation/` is handed interfaces and never builds a command from a repository.
	 */
	readonly deleteZone: DeleteZoneCommand;
	readonly moveZone: MoveSpatialObjectCommand;
	readonly zoneInspector: GetZoneInspector;
	/** Design slice 10's write side for assets and requirements. */
	readonly createAsset: CreateAssetCommand;
	readonly updateAsset: UpdateAssetCommand;
	readonly deleteAsset: DeleteAssetCommand;
	readonly assignAsset: AssignAssetCommand;
	readonly recalculateRequirement: RecalculateRequirementCommand;
	readonly setRequirementQuantityOverride: SetRequirementQuantityOverrideCommand;
	readonly setRequirementCostOverride: SetRequirementCostOverrideCommand;
	readonly deleteRequirement: DeleteRequirementCommand;
	/** Slice 10's read side, beside the zone inspector query. */
	readonly requirementQueries: {
		readonly getRequirementsForZone: GetRequirementsForZone;
		readonly listAssets: ListAssets;
		readonly listRequirementsReferencing: ListRequirementsReferencing;
		readonly listReassignmentTargets: ListReassignmentTargets;
	};
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

interface Slice10Wiring {
	readonly zones: ZoneRepository;
	readonly assets: AssetRepositoryPort;
	readonly requirements: RequirementRepositoryPort;
	readonly recalculate: RecalculateRequirementCommand;
	readonly events: EventBus;
	readonly locks: ReferenceLocks;
	readonly logger: Logger;
	readonly markers?: SequenceMarkerStore;
}

/**
 * Design slice 10's write side, read side, and cascade handlers, composed as ONE block —
 * the same seam discipline as every other service here, kept out of
 * `createCompositionRoot`'s own body only by the size budget every function shares.
 */
function composeSlice10(wiring: Slice10Wiring) {
	const { zones, assets, requirements, recalculate, events, locks, logger, markers } = wiring;

	/**
	 * The cascade runs in the BACKGROUND — nothing the user clicked is waiting on it — so a
	 * failure inside it reaches nobody unless it is announced. That matters most for exactly
	 * the case this port is named after: the durable marker that lets a later reader see
	 * "these figures are out of date" is itself the write that failed, so silence here means
	 * a wrong figure presented as current. The port is optional on `CascadeDeps` for the
	 * suite's benefit; production always passes it, and this is the caller that makes the
	 * whole port more than a tested no-op.
	 */
	const cascadeNotices = {
		cascadeAborted: () => {
			notify(tr('cascade.aborted'));
		},
		staleMarkerFailed: () => {
			notify(tr('cascade.stale-marker-failed'));
		},
	};

	const subscriptions: { dispose(): void }[] = [
		registerOnZoneGeometryChanged(events, {
			requirements,
			events,
			logger,
			notify: cascadeNotices,
			recalculate: (input) => recalculate.execute({ requirementId: input.requirementId as never }),
		}),
		registerOnAssetUpdated(events, {
			requirements,
			assets,
			events,
			logger,
			notify: cascadeNotices,
			recalculate: (input) => recalculate.execute({ requirementId: input.requirementId as never }),
		}),
	];

	return {
		createAsset: new CreateAssetCommand(assets, events),
		updateAsset: new UpdateAssetCommand(assets, requirements, events, locks),
		deleteAsset: new DeleteAssetCommand({
			assets,
			requirements,
			recalculate,
			events,
			locks,
			logger,
			markers,
		}),
		assignAsset: new AssignAssetCommand(zones, assets, requirements, events, locks),
		setRequirementQuantityOverride: new SetRequirementQuantityOverrideCommand(requirements, events, locks),
		setRequirementCostOverride: new SetRequirementCostOverrideCommand(requirements, events, locks),
		deleteRequirement: new DeleteRequirementCommand(requirements),
		queries: {
			getRequirementsForZone: new GetRequirementsForZone(requirements, zones, assets),
			listAssets: new ListAssets(assets),
			listRequirementsReferencing: new ListRequirementsReferencing(requirements),
			listReassignmentTargets: new ListReassignmentTargets(zones, assets),
		},
		subscriptions,
	};
}

function composeRepositories(
	deps: NoteVaultDeps,
	vault: VaultStack,
	index: ProjectIndex,
	migrations: MigrationRunner,
	echo: EchoWindow,
) {
	const geometryStore = new PlanGeometryStore(vault.vault, vault.fileManager, index, migrations, echo);
	return {
		geometryStore,
		projects: new ObsidianProjectRepository(deps),
		plans: new ObsidianPlanRepository(deps, geometryStore),
		zones: new ObsidianZoneRepository(deps, geometryStore),
		assets: new ObsidianAssetRepository(deps),
		requirements: new ObsidianRequirementRepository(deps),
	};
}
/** The read side every view and command consumes; one composition, no second wiring point. */
function composeQueryServices(
	zones: ZoneRepository,
	plans: PlanRepository,
	projects: ProjectRepository,
): QueryServices {
	return {
		getProject: new GetProject(projects),
		getPlan: new GetPlan(plans),
		getZone: new GetZone(zones),
		findZonesByPlan: new FindZonesByPlan(zones),
	};
}

/** Every entity shape's migration table, keyed as the runner reads it. */
function migrationSet() {
	return {
		project: PROJECT_MIGRATIONS,
		plan: PLAN_MIGRATIONS,
		zone: ZONE_MIGRATIONS,
		asset: ASSET_MIGRATIONS,
		requirement: REQUIREMENT_MIGRATIONS,
		'plan-geometry': PLAN_GEOMETRY_MIGRATIONS,
	};
}

export function createCompositionRoot(
	settings: RenovationPlannerSettings | null,
	logger: Logger,
	vault: VaultStack | null = null,
	markers?: SequenceMarkerStore,
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

	const index = new InMemoryProjectIndex();
	const echo = new EchoWindow();
	const migrations = createMigrationRunner(migrationSet());

	const deps: NoteVaultDeps = {
		vault: vault.vault,
		fileManager: vault.fileManager,
		metadataCache: vault.metadataCache,
		index,
		echo,
		migrations,
		logger,
		projectFolder: settings.projectFolder,
	};
	const { geometryStore, projects, plans, zones, assets, requirements } = composeRepositories(deps, vault, index, migrations, echo);

	// One lock set per plugin: assignment, unit changes and delete resolutions across
	// every view serialize against the same keys.
	const locks = new ReferenceLocks();
	const recalculate = new RecalculateRequirementCommand(requirements, zones, assets, eventBus);
	const slice10 = composeSlice10({ zones, assets, requirements, recalculate, events: eventBus, locks, logger, markers });
	const queries = composeQueryServices(zones, plans, projects);
	const geometry = new ObsidianPlanGeometrySidecar(geometryStore);
	const files = createVaultFileProbe(vault.vault);

	return {
		settings,
		logger,
		eventBus,
		persistence: {
			index,
			vaultDeps: deps,
			migrations,
			geometryStore,
			geometry,
			projects,
			plans,
			zones,
			assets,
			requirements,
			locks,
			queries,
			files,
			createProject: new CreateProjectCommand(projects, eventBus),
			createPlan: new CreatePlanCommand(plans, projects, eventBus),
			createZone: new CreateZoneCommand(zones, plans, eventBus),
			planEditorQueries: createPlanEditorQueries({
				...queries,
				getRequirementsForZone: slice10.queries.getRequirementsForZone,
				listAssets: slice10.queries.listAssets,
				listRequirementsReferencing: slice10.queries.listRequirementsReferencing,
				listReassignmentTargets: slice10.queries.listReassignmentTargets,
			}),
			listProjects: new ListProjects(projects),
			setPlanBackground: new SetPlanBackgroundCommand(plans, files, eventBus),
			reversibleSetPlanBackground: new ReversibleSetPlanBackgroundCommand(
				new SetPlanBackgroundCommand(plans, files, eventBus),
				plans,
			),
			deleteZone: new DeleteZoneCommand({
				zones,
				requirements,
				recalculate,
				events: eventBus,
				locks,
				logger,
				markers,
			}),
			moveZone: new MoveSpatialObjectCommand(zones, eventBus),
			zoneInspector: new GetZoneInspector(zones),
			createAsset: slice10.createAsset,
			updateAsset: slice10.updateAsset,
			deleteAsset: slice10.deleteAsset,
			assignAsset: slice10.assignAsset,
			recalculateRequirement: recalculate,
			setRequirementQuantityOverride: slice10.setRequirementQuantityOverride,
			setRequirementCostOverride: slice10.setRequirementCostOverride,
			deleteRequirement: slice10.deleteRequirement,
			requirementQueries: slice10.queries,
			subscriptions: slice10.subscriptions,
			markers,
			changeAdapter: new VaultChangeAdapter({
				vault: vault.vault,
				metadataCache: vault.metadataCache,
				index,
				echo,
				logger,
				projectFolder: settings.projectFolder,
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
						assignAsset: persistence.assignAsset,
						setQuantityOverride: persistence.setRequirementQuantityOverride,
						setCostOverride: persistence.setRequirementCostOverride,
						requirements: persistence.requirements,
						assets: persistence.assets,
						locks: persistence.locks,
						logger: root.logger,
					},
					// A new command per call — see `CalibratePlanTransaction`. The three
					// collaborators are the same ones every other write here is built from;
					// only the lifetime differs.
					calibratePlan: () =>
						new ReversibleCalibratePlanCommand(persistence.plans, persistence.geometry, root.eventBus),
				}
			: unavailablePlanEditorCommands(),
		vault,
		onThemeChange: createThemeChangeSource(workspace),
		onPlanChanged: createPlanChangeSource(root.eventBus),
	};
}

/**
 * The Renovation Project view's own dependency bundle (design slice 14) — the seam slice 1
 * reserved in writing, extended by a field rather than relocated.
 *
 * Needs no `Workspace` and no `Vault`, unlike `planEditorDeps`: this view's only dependency
 * today is a read side. `unavailableRenovationProjectQueries()` when `root.persistence` is
 * `null` is the same total-rather-than-nullable shape as `planEditorDeps`, for the same
 * stated reason — a nullable dependency would make every caller branch on it, and refusing
 * to register the view at all would leave a restored leaf pointing at a view type Obsidian
 * does not know.
 */
export function renovationProjectDeps(root: CompositionRoot): RenovationProjectDeps {
	const persistence = root.persistence;
	return {
		queries: persistence
			? createRenovationProjectQueries(persistence.listProjects)
			: unavailableRenovationProjectQueries(),
	};
}
