import type { FileManager, MetadataCache, Vault } from 'obsidian';
import type { Logger } from '../application/ports/Logger';
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
	// readonly eventBus: EventBus;                — arrives with slice 5's first publishing command
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
	if (settings === null || vault === null) {
		return { settings, logger, persistence: null };
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
		persistence: {
			index,
			vaultDeps: deps,
			migrations,
			geometryStore,
			projects,
			plans,
			zones,
			queries,
			changeAdapter,
		},
	};
}
