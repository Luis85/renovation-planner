import type { FileManager, MetadataCache, Vault, Workspace } from 'obsidian';
import { createEventBus, type EventBus } from '../core/events/EventBus';
import type { Result } from '../core/result/Result';
import type { Logger } from '../application/ports/Logger';
import type { Command } from '../application/commands/Command';
import { createPlanChangeSource } from '../application/events/planChangeSource';
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
import type { ProjectIndex } from '../application/ports/ProjectIndex';
import type { SequenceMarkerStore } from '../application/ports/SequenceMarkerStore';
import type { PlanGeometrySidecar } from '../application/ports/PlanGeometrySidecar';
import type { AssetRepository as AssetRepositoryPort } from '../application/ports/AssetRepository';
import type { RequirementRepository as RequirementRepositoryPort } from '../application/ports/RequirementRepository';
import type { PlanRepository } from '../application/ports/PlanRepository';
import type { ProjectRepository } from '../application/ports/ProjectRepository';
import type { ZoneRepository } from '../application/ports/ZoneRepository';
import type { Loaded } from '../application/ports/versioning';
import type { Project } from '../domain/project/Project';
import type { Plan } from '../domain/plan/Plan';
import type { Zone } from '../domain/zone/Zone';
import { PlanGeometryStore } from '../infrastructure/obsidian/repositories/PlanGeometryStore';
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
	guardCalibratePlan,
	guardSlice10,
	guardedEditorServices,
	type GuardedEditorServices,
	type GuardedSlice10Services,
	type QueryServices,
	type UnguardedSlice10Services,
} from './guardedServices';
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

/**
 * Everything the persistence stack hands out, with the Error Boundary already around it:
 * every `Command` and `Query` member here is a GUARDED wrapper (SDD §66), which is why the
 * two guarded groups are EXTENDED rather than re-declared — the shapes and the guards that
 * produce them live together in `guardedServices.ts`, so a member added there cannot be
 * forgotten here.
 */
export interface PersistenceServices extends GuardedEditorServices, GuardedSlice10Services {
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
 *
 * Nothing this returns is guarded: it is the raw composition, and `guardSlice10` wraps the
 * copy that LEAVES the root. `recalculate` reaches `DeleteAssetCommand` and both cascade
 * handlers unguarded on purpose — those uses are INSIDE the application layer, which is
 * not the boundary the guard defends.
 */
function composeSlice10(
	wiring: Slice10Wiring,
): UnguardedSlice10Services & { subscriptions: { dispose(): void }[] } {
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

function composeRepositories(deps: NoteVaultDeps, vault: VaultStack, newProjectRoot: string) {
	const geometryStore = new PlanGeometryStore(vault.vault, vault.fileManager, deps.index, deps.migrations, deps.echo);
	return {
		geometryStore,
		// `newProjectRoot` is a real argument, not `deps.projectFolder` read inline — this
		// repository is the only one that ever writes a note whose folder does not already
		// exist to be derived from, so it takes the setting as its own constructor
		// argument rather than through the shared `NoteVaultDeps` field. That field is what
		// Task 7 deletes; reading it here would have left this call site needing a second
		// edit the day it goes.
		projects: new ObsidianProjectRepository(deps, newProjectRoot),
		plans: new ObsidianPlanRepository(deps, geometryStore),
		zones: new ObsidianZoneRepository(deps, geometryStore),
		assets: new ObsidianAssetRepository(deps),
		requirements: new ObsidianRequirementRepository(deps),
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
	const { projects, plans, zones, requirements } = repositories;
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
	});
	const editor = guardedEditorServices(
		{ projects, plans, zones, deleteZone },
		{ eventBus, files, logger, map },
		diagnostics,
	);
	return {
		...editor,
		...guardSlice10(slice10, recalculate, logger, map),
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
	const repositories = composeRepositories(deps, vault, settings.projectFolder);
	const { geometryStore, projects, plans, zones, assets, requirements } = repositories;

	// One lock set per plugin: assignment, unit changes and delete resolutions across
	// every view serialize against the same keys.
	const locks = new ReferenceLocks();
	const recalculate = new RecalculateRequirementCommand(requirements, zones, assets, eventBus);
	const wiring: Slice10Wiring = { zones, assets, requirements, recalculate, events: eventBus, locks, logger, markers };
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
			projects,
			plans,
			zones,
			assets,
			requirements,
			locks,
			files,
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
