import type { FileManager, MetadataCache, Vault, Workspace } from 'obsidian';
import { createEventBus, type EventBus } from '../core/events/EventBus';
import type { Logger } from '../application/ports/Logger';
import { createPlanChangeSource } from '../application/events/planChangeSource';
import { CreatePlanCommand } from '../application/commands/plan/CreatePlan';
import { CreateProjectCommand } from '../application/commands/project/CreateProject';
import { CreateZoneCommand } from '../application/commands/zone/CreateZone';
import { ReversibleSetPlanBackgroundCommand } from '../application/commands/plan/ReversibleSetPlanBackground';
import { SetPlanBackgroundCommand } from '../application/commands/plan/SetPlanBackground';
import type { VaultFileProbe } from '../application/ports/VaultFileProbe';
import { createVaultFileProbe } from '../infrastructure/obsidian/vault/vaultFileProbe';
import { createThemeChangeSource } from '../infrastructure/obsidian/workspace/themeChanges';
import {
	createPlanEditorQueries,
	unavailablePlanEditorQueries,
	type PlanEditorQueryServices,
} from '../presentation/read-models/planEditorQueries';
import type { PlanEditorDeps } from '../presentation/views/PlanEditorView';
import { FindZonesByPlan } from '../application/queries/FindZonesByPlan';
import { GetPlan } from '../application/queries/GetPlan';
import { GetProject } from '../application/queries/GetProject';
import { GetZone } from '../application/queries/GetZone';
import type { ProjectIndex } from '../application/ports/ProjectIndex';
import type { PlanRepository } from '../application/ports/PlanRepository';
import type { ProjectRepository } from '../application/ports/ProjectRepository';
import type { ZoneRepository } from '../application/ports/ZoneRepository';
import { PlanGeometryStore } from '../infrastructure/obsidian/repositories/PlanGeometryStore';
import type { NoteVaultDeps } from '../infrastructure/obsidian/repositories/NoteVaultDeps';
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
	readonly projects: ProjectRepository;
	readonly plans: PlanRepository;
	readonly zones: ZoneRepository;
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
	 * The three creates, which existed with full test coverage and NO caller outside
	 * `application/` until something in the app asked for one — so a vault contained no
	 * project, plan or zone note and slices 3, 4 and 5 were unreachable from inside
	 * Obsidian. Composed here for the same reason every other service is: the write side a
	 * command or a view consumes is an interface handed to it, never a repository it built.
	 *
	 * `create-sample-project` is their only caller today (`sampleProject.ts`). Slice 14's
	 * empty-state actions and slice 15's creation dialogs are what give them product-real
	 * ones; neither needs a second wiring point, only a second call.
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

export function createCompositionRoot(
	settings: RenovationPlannerSettings | null,
	logger: Logger,
	vault: VaultStack | null = null,
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

	const migrations = createMigrationRunner({
		project: PROJECT_MIGRATIONS,
		plan: PLAN_MIGRATIONS,
		zone: ZONE_MIGRATIONS,
		'plan-geometry': PLAN_GEOMETRY_MIGRATIONS,
	});

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

	const geometryStore = new PlanGeometryStore(vault.vault, vault.fileManager, index, migrations, echo);
	const projects = new ObsidianProjectRepository(deps);
	const plans = new ObsidianPlanRepository(deps, geometryStore);
	const zones = new ObsidianZoneRepository(deps, geometryStore);

	const queries: QueryServices = {
		getProject: new GetProject(projects),
		getPlan: new GetPlan(plans),
		getZone: new GetZone(zones),
		findZonesByPlan: new FindZonesByPlan(zones),
	};

	const files = createVaultFileProbe(vault.vault);
	const setPlanBackground = new SetPlanBackgroundCommand(plans, files, eventBus);

	const changeAdapter = new VaultChangeAdapter({
		vault: vault.vault,
		metadataCache: vault.metadataCache,
		index,
		echo,
		logger,
		projectFolder: settings.projectFolder,
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
			projects,
			plans,
			zones,
			queries,
			files,
			createProject: new CreateProjectCommand(projects, eventBus),
			createPlan: new CreatePlanCommand(plans, projects, eventBus),
			createZone: new CreateZoneCommand(zones, plans, eventBus),
			planEditorQueries: createPlanEditorQueries(queries),
			setPlanBackground,
			reversibleSetPlanBackground: new ReversibleSetPlanBackgroundCommand(setPlanBackground, plans),
			changeAdapter,
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
		vault,
		onThemeChange: createThemeChangeSource(workspace),
		onPlanChanged: createPlanChangeSource(root.eventBus),
	};
}
