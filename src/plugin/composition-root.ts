import type { Vault, Workspace } from 'obsidian';
import { createEventBus, type EventBus } from '../core/events/EventBus';
import type { Result } from '../core/result/Result';
import type { Logger } from '../application/ports/Logger';
import type { Command } from '../application/commands/Command';
import { createAssetCatalogueChangeSource } from '../application/events/assetCatalogueChangeSource';
import { createProjectPricesChangeSource } from '../application/events/projectPricesChangeSource';
import { createProjectListChangeSource } from '../application/events/projectListChangeSource';
import { createProjectPlansChangeSource } from '../application/events/projectPlansChangeSource';
import { CreatePlanCommand } from '../application/commands/plan/CreatePlan';
import type { CreatePlanInput, CreatePlanError } from '../application/commands/plan/CreatePlan';
import { CreateProjectCommand } from '../application/commands/project/CreateProject';
import type { CreateProjectInput, CreateProjectError } from '../application/commands/project/CreateProject';
import { CreateZoneCommand } from '../application/commands/zone/CreateZone';
import type { CreateZoneInput, CreateZoneError } from '../application/commands/zone/CreateZone';
import { DeleteZoneCommand } from '../application/commands/zone/DeleteZone';
import { ReversibleSetPlanBackgroundCommand } from '../application/commands/plan/ReversibleSetPlanBackground';
import { SetPlanBackgroundCommand } from '../application/commands/plan/SetPlanBackground';
import type {
	SetPlanBackgroundInput,
	SetPlanBackgroundOutcome,
	SetPlanBackgroundError,
} from '../application/commands/plan/SetPlanBackground';
import type { VaultFileProbe } from '../application/ports/VaultFileProbe';
import type { LibraryOverlaps } from '../application/ports/LibraryOverlaps';
import type { ProjectListFacts } from '../application/ports/ProjectListFacts';
import { createVaultFileProbe } from '../infrastructure/obsidian/vault/vaultFileProbe';
import { ReferenceLocks } from '../application/reference/ReferenceLocks';
import { RecalculateRequirementCommand } from '../application/commands/requirement/RecalculateRequirement';
import {
	createPlanEditorQueries,
	type PlanEditorQueryServices,
} from '../presentation/read-models/planEditorQueries';
import {
	createRenovationProjectQueries,
	unavailableRenovationProjectQueries,
} from '../presentation/read-models/renovationProjectQueries';
import { unavailableRenovationProjectCommands } from '../presentation/views/renovationProjectCommands';
import type { RenovationProjectDeps } from '../presentation/views/RenovationProjectContext';
import type { ContinueContext } from '../application/continueContext';
import {
	renovationProjectOpenAsset,
	renovationProjectOpenAssetLibrary,
	renovationProjectOpenPlan,
	renovationProjectOpenProject,
} from './renovationProjectOpenSeams';
import { renovationProjectCommandBundle } from './renovationProjectCommandBundle';
import type { ProjectIndex } from '../application/ports/ProjectIndex';
import type { SequenceMarkerStore } from '../application/ports/SequenceMarkerStore';
import type { PlanGeometrySidecar } from '../application/ports/PlanGeometrySidecar';
import type { AssetGeometrySidecar } from '../application/ports/AssetGeometrySidecar';
import type { AssetRepository as AssetRepositoryPort } from '../application/ports/AssetRepository';
import type { RequirementRepository as RequirementRepositoryPort } from '../application/ports/RequirementRepository';
import type { AssetPriceOverrideRepository as AssetPriceOverrideRepositoryPort } from '../application/ports/AssetPriceOverrideRepository';
import type { PlanRepository } from '../application/ports/PlanRepository';
import type { ProjectRepository } from '../application/ports/ProjectRepository';
import type { ZoneRepository } from '../application/ports/ZoneRepository';
import type { Loaded } from '../application/ports/versioning';
import type { Currency } from '../core/money/Money';
import type { Project } from '../domain/project/Project';
import type { Plan } from '../domain/plan/Plan';
import type { Zone } from '../domain/zone/Zone';
import type { PlanGeometryStore } from '../infrastructure/obsidian/repositories/PlanGeometryStore';
import type { NoteVaultDeps } from '../infrastructure/obsidian/repositories/NoteVaultDeps';
import { ObsidianPlanGeometrySidecar } from '../infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { createMigrationRunner, type MigrationRunner } from '../infrastructure/persistence/migration/MigrationRunner';
import { MIGRATION_SET } from '../infrastructure/persistence/migration/migrationSet';
import { EchoWindow } from '../infrastructure/persistence/index/EchoWindow';
import { InMemoryProjectIndex } from '../infrastructure/persistence/index/InMemoryProjectIndex';
import { ReconcilingProjectIndex } from '../infrastructure/persistence/index/ReconcilingProjectIndex';
import { VaultChangeAdapter } from '../infrastructure/persistence/index/VaultChangeAdapter';
import { guardCommand } from '../application/errors/guardAgainstThrowing';
import { InMemoryDiagnosticsLedger } from '../infrastructure/logging/diagnosticsLedger';
import type { DiagnosticsLedger, RuntimeVersions } from '../application/ports/diagnostics';
import {
	VAULT_EXCEPTION_MAPPER,
	guardAssetDesign,
	guardSlice10,
	guardedEditorServices,
	type GuardedAssetDesignServices,
	type GuardedEditorServices,
	type GuardedSlice10Services,
	type QueryServices,
	type UnguardedSlice10Services,
} from './guardedServices';
import { guardAssetPriceServices, type GuardedAssetPriceServices } from './guardedAssetPrice';
import { guardAssetLibrary, type GuardedAssetLibraryServices } from './guardedAssetLibrary';
import { SetAssetPriceOverrideCommand } from '../application/commands/asset-price/SetAssetPriceOverride';
import { ClearAssetPriceOverrideCommand } from '../application/commands/asset-price/ClearAssetPriceOverride';
import { ListProjectAssetPrices } from '../application/queries/ListProjectAssetPrices';
import { composeSlice10, sequenceNotices, type Slice10Wiring } from './slice10Composition';
import { composeRepositories, type VaultStack } from './repositoryComposition';
import type { RenovationPlannerSettings } from './settings/settings';

// Re-exported so every existing `import { …, type VaultStack } from './composition-root'`
// keeps resolving: the interface itself moved to `repositoryComposition.ts` alongside the
// unguarded repository construction it describes, the way `guardedServices.ts` already
// holds the guarded half of the same seam.
export type { VaultStack };

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
		GuardedAssetPriceServices,
		GuardedAssetDesignServices,
		GuardedAssetLibraryServices {
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
	/**
	 * A project's own price for a shared catalogue Asset. Exposed here, beside its sibling
	 * repositories, so `guardCategory.test.ts` can detonate it: `SetAssetPriceOverrideCommand`,
	 * `ClearAssetPriceOverrideCommand` and `ListProjectAssetPrices` all read and write through
	 * this port, and it was the one collaborator this increment's two commands and query added
	 * that the seven-name detonation list had not yet named.
	 */
	readonly overrides: AssetPriceOverrideRepositoryPort;
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
	 * The Home surface's plan count and last-worked time (§8), exposed for the reason
	 * `overlaps` states one field up and answered by the same instrument at both doors:
	 * `ListProjects` takes it for the list, and `createRenovationProjectQueries` takes it so
	 * the single-project door states facts it actually asked for rather than a zero it never
	 * counted.
	 */
	readonly listFacts: ProjectListFacts;
	readonly defaultCurrency: Currency;
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

/**
 * Design slice 10's lock set, the `RecalculateRequirementCommand` both the write side and
 * the cascade handlers dispatch through, and the `Slice10Wiring` bundle `composeSlice10` and
 * `composeGuarded` both take — pulled out of `createCompositionRoot`'s own body when the
 * currency-override increment's wiring pushed that function over its 100-line cap.
 *
 * **An extraction, not a second collapsed literal.** `runtime.ts` already recorded the wrong
 * remedy for this shape: a budget bought back by reformatting is a budget already spent, and
 * the next line of code — of any size — trips the cap again. This is that next line, in the
 * same file, one slice later; the fix is the seam `composeRepositories`/`composeGuarded`
 * already model, not a third one.
 */
function composeSlice10Wiring(
	repositories: ReturnType<typeof composeRepositories>,
	index: ProjectIndex,
	events: EventBus,
	logger: Logger,
	markers: SequenceMarkerStore | undefined,
): { locks: ReferenceLocks; wiring: Slice10Wiring; slice10: ReturnType<typeof composeSlice10> } {
	const { projects, zones, assets, requirements, overrides } = repositories;
	// One lock set per plugin: assignment, unit changes and delete resolutions across
	// every view serialize against the same keys.
	const locks = new ReferenceLocks();
	const recalculate = new RecalculateRequirementCommand({
		requirements,
		zones,
		assets,
		events,
		projects,
		overrides,
	});
	const wiring: Slice10Wiring = {
		zones,
		assets,
		requirements,
		projects,
		index,
		recalculate,
		events,
		locks,
		logger,
		markers,
		overrides,
	};
	return { locks, wiring, slice10: composeSlice10(wiring) };
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
	const { projects, plans, zones, assets, assetGeometry, requirements, overlaps, listFacts, defaultCurrency, overrides } =
		repositories;
	const { events: eventBus, logger, recalculate, locks, markers, index } = wiring;
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
		{ eventBus, files, logger, map, overlaps, listFacts },
		diagnostics,
	);
	// Task 5's repository is what these needed; nothing else is built here beyond the two
	// commands and the query Tasks 4 and 8 wrote. `index` is `wiring.index` — the same
	// instance every repository and `IndexLibraryOverlaps` already share — so this is a
	// wiring change at one call site, not a new construction.
	// The library's three reads, composed and guarded together — `guardAssetDesign`'s shape,
	// and every port here is one this function already holds.
	const assetLibrary = guardAssetLibrary({ assets, index, geometry: assetGeometry, overrides }, logger, map);
	const assetPrice = guardAssetPriceServices(
		{
			setAssetPriceOverride: new SetAssetPriceOverrideCommand({ overrides, projects, assets, events: eventBus, locks }),
			clearAssetPriceOverride: new ClearAssetPriceOverrideCommand({ overrides, events: eventBus, locks }),
			listProjectAssetPrices: new ListProjectAssetPrices(assets, overrides, index, logger),
		},
		logger,
		map,
	);
	return {
		...editor,
		...guardSlice10(slice10, recalculate, logger, map),
		...assetPrice,
		...assetLibrary,
		// The SAME `locks` the delete resolution takes — `wiring.locks`, one instance per root. A
		// second `new ReferenceLocks()` here would be two mutual-exclusion sets that exclude
		// nothing from each other, which is the shape this file already refuses for the event bus.
		...guardAssetDesign({ sidecar: assetGeometry, assets, events: eventBus, locks }, files, logger, map),
		createProject: guardCommand(new CreateProjectCommand(projects, eventBus, defaultCurrency), 'command.createProject.failed', logger, map),
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
	const echo = new EchoWindow();
	// The index every writer holds is the RECONCILING one, and that is the whole of how §5.1a's
	// two-collection invariant reaches the six repositories: they mutate the index themselves on
	// their own writes, so a rule kept inside `VaultChangeAdapter` held for the file explorer and
	// for no command. Wrapping is what answers writers not yet written — there is one object, and
	// nothing can hold anything else. (`ReconcilingProjectIndex`'s header carries the six's
	// measurement; several older comments in this tree still say five.)
	// Annotated as the PORT, which is what fallow resolves a class's members through: the
	// delegating reads here are reached from repositories typed to `ProjectIndex`, and an
	// inferred concrete type reports every one of them as an unused class member.
	const index: ProjectIndex = new ReconcilingProjectIndex(new InMemoryProjectIndex(), {
		vault: vault.vault,
		metadataCache: vault.metadataCache,
		echo,
		events: eventBus,
		logger,
	});
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
	const repositories = composeRepositories(
		deps,
		vault,
		settings.projectFolder,
		settings.libraryFolder,
		settings.defaultCurrency,
	);
	const { geometryStore, projects, plans, zones, assets, requirements, overrides } = repositories;
	const { locks, wiring, slice10 } = composeSlice10Wiring(repositories, index, eventBus, logger, markers);

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
			overrides,
			locks,
			files,
			overlaps: repositories.overlaps,
			listFacts: repositories.listFacts,
			defaultCurrency: repositories.defaultCurrency,
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
 * Obsidian's own `notifyFault`-mapped `reportFault` shape twice), `indexScanCompleted`
 * reads a session-scoped flag the plugin owns, and `continueContext`/`rememberContinue`
 * (Task 10) reach the plugin's own `ContinueContextStore` the identical way — this function
 * may not import `infrastructure/obsidian/plugin-data/` and reach for `App` itself, since it
 * takes `Workspace` and `Vault` rather than the whole app, and neither depends on
 * `persistence` the other members above it do (a session with unrecovered settings can still
 * remember and restore where the user was). A default here would let a composition forget one
 * and still compile — the same self-declared shape this repository already refuses, and the
 * reason Task 3's own wiring case grows an explicit fourth argument instead.
 */
export function renovationProjectDeps(
	root: CompositionRoot,
	workspace: Workspace,
	vault: Vault,
	options: {
		projectId: string | null;
		navigate: (projectId: string | null, section?: 'details' | 'prices') => void;
		indexScanCompleted: () => boolean;
		/**
		 * The Continue context and its writer — plugin-local, per-device state Task 10 composes
		 * over `App.loadLocalStorage`/`saveLocalStorage`, independent of `persistence`
		 * (`RenovationPlannerPlugin` owns the store; this function only carries it through, the
		 * same shape `indexScanCompleted` above already takes).
		 */
		continueContext: () => Promise<ContinueContext | null>;
		rememberContinue: (context: ContinueContext) => void;
	},
): RenovationProjectDeps {
	const persistence = root.persistence;
	return {
		projectId: options.projectId,
		navigate: options.navigate,
		indexScanCompleted: options.indexScanCompleted,
		continueContext: options.continueContext,
		rememberContinue: options.rememberContinue,
		openPlan: persistence ? renovationProjectOpenPlan(workspace, root.logger) : () => Promise.resolve('failed'),
		openAsset: persistence ? renovationProjectOpenAsset(workspace, root.logger) : () => Promise.resolve(),
		// UNCONDITIONAL, persistence or not — `onProjectsChanged`'s own reason two screens down:
		// revealing the library needs no repository at all, and a refusing bundle underneath it
		// simply draws its own failure state (§4) the way `unavailableAssetLibraryQueries` does.
		openAssetLibrary: renovationProjectOpenAssetLibrary(workspace, root.logger),
		// Wired from the bus UNCONDITIONALLY, persistence or not, for the reason
		// `onProjectsChanged` states three lines down: the bus is the root's own and exists
		// either way, and a refusal bundle re-reading simply refuses again.
		onPlansChanged: createProjectPlansChangeSource(root.eventBus),
		// The price section's two doors, wired from the bus for the same reason. The catalogue
		// source is the SAME one the Plan Editor's assign picker takes, reused rather than
		// duplicated; the price source reports which project changed and this view narrows at its
		// own end, where the id already is.
		onCatalogueChanged: createAssetCatalogueChangeSource(root.eventBus),
		onProjectPricesChanged: createProjectPricesChangeSource(root.eventBus),
		queries: persistence
			? createRenovationProjectQueries({
					listProjects: persistence.listProjects,
					getProject: persistence.queries.getProject,
					listPlansByProject: persistence.listPlansByProject,
					overlaps: persistence.overlaps,
					facts: persistence.listFacts,
					listAssetPrices: persistence.listProjectAssetPrices,
				})
			: unavailableRenovationProjectQueries(),
		// `renovationProjectCommandBundle` is the same line-budget extraction
		// `renovationProjectOpenSeams.ts` already carries for this function's two open doors —
		// every member is still the GUARDED service composed above.
		commands: persistence
			? renovationProjectCommandBundle(persistence, root.logger)
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
