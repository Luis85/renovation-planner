import type { Result } from '../core/result/Result';
import type { AppError, GeometryError, PersistenceError, ReferenceError } from '../core/errors/AppError';
import type { Command } from '../application/commands/Command';
import type { Query } from '../application/queries/Query';
import type { Logger } from '../application/ports/Logger';
import type { LibraryOverlaps } from '../application/ports/LibraryOverlaps';
import type { Loaded } from '../application/ports/versioning';
import type { RepositoryError } from '../application/ports/repositoryErrors';
import type { DiagnosticsLedger, RuntimeVersions } from '../application/ports/diagnostics';
import type { VaultExceptionMapper } from '../application/errors/exceptionMapper';
import { createVaultExceptionMapper } from '../application/errors/exceptionMapper';
import { guardCommand, guardQuery } from '../application/errors/guardAgainstThrowing';
import { GetDiagnosticsSnapshotQuery, type DiagnosticsSnapshot } from '../application/queries/GetDiagnosticsSnapshot';
import { GetProject, type GetProjectInput } from '../application/queries/GetProject';
import { ListPlansByProject, type ListPlansByProjectInput } from '../application/queries/ListPlansByProject';
import { ListProjects } from '../application/queries/ListProjects';
import type { ProjectListResult } from '../application/queries/ListProjects';
import { GetPlan, type GetPlanInput } from '../application/queries/GetPlan';
import { GetZone, type GetZoneInput } from '../application/queries/GetZone';
import { FindZonesByPlan, type FindZonesByPlanInput } from '../application/queries/FindZonesByPlan';
import { GetZoneInspector } from '../application/queries/GetZoneInspector';
import type { GetZoneInspectorInput, ZoneInspectorFields } from '../application/queries/GetZoneInspector';
import { SetPlanBackgroundCommand } from '../application/commands/plan/SetPlanBackground';
import type {
	SetPlanBackgroundInput,
	SetPlanBackgroundOutcome,
	SetPlanBackgroundError,
} from '../application/commands/plan/SetPlanBackground';
import type { DeleteZoneCommand, DeleteZoneInput } from '../application/commands/zone/DeleteZone';
import {
	MoveSpatialObjectCommand,
	type MoveSpatialObjectInput,
	type MoveSpatialObjectResult,
} from '../application/commands/zone/MoveSpatialObject';
import type { CreateAssetCommand, CreateAssetInput } from '../application/commands/asset/CreateAsset';
import type { UpdateAssetCommand, UpdateAssetInput, UpdateAssetErrors } from '../application/commands/asset/UpdateAsset';
import type { DeleteAssetCommand, DeleteAssetInput, DeleteAssetErrors } from '../application/commands/asset/DeleteAsset';
import {
	SetAssetFootprintCommand,
	SetAssetFootprintFromDimensionsCommand,
	type SetAssetFootprintInput,
	type SetAssetFootprintFromDimensionsInput,
} from '../application/commands/asset/SetAssetFootprint';
import { SetAssetClearanceCommand, type SetAssetClearanceInput } from '../application/commands/asset/SetAssetClearance';
import { SetAssetAnchorCommand, type SetAssetAnchorInput } from '../application/commands/asset/SetAssetAnchor';
import { SetAssetFacingCommand, type SetAssetFacingInput } from '../application/commands/asset/SetAssetFacing';
import { SetAssetHeightCommand, type SetAssetHeightInput } from '../application/commands/asset/SetAssetHeight';
import type { VersionedDesignCommand } from '../application/editor/asset/ReversibleAssetDesignCommands';
import type { AssetShapeDeps } from '../application/commands/asset/updateAssetShape';
import type { DispatchResult } from '../application/commands/DispatchOutcome';
import { GetAssetDesignQuery } from '../application/queries/GetAssetDesign';
import type { AssetDesignDto, AssetDesignError } from '../application/queries/GetAssetDesign';
import type { AssetId } from '../domain/asset/AssetId';
import type {
	AssignAssetCommand,
	AssignAssetInput,
	AssignAssetResult,
	AssignAssetErrors,
} from '../application/commands/requirement/AssignAsset';
import type {
	RecalculateRequirementCommand,
	RecalculateRequirementInput,
	RecalculateRequirementErrors,
} from '../application/commands/requirement/RecalculateRequirement';
import type {
	SetRequirementQuantityOverrideCommand,
	SetRequirementQuantityOverrideDoor,
	SetRequirementQuantityOverrideInput,
	SetOverrideErrors,
} from '../application/commands/requirement/SetRequirementQuantityOverride';
import type {
	SetRequirementCostOverrideCommand,
	SetRequirementCostOverrideDoor,
	SetRequirementCostOverrideInput,
} from '../application/commands/requirement/SetRequirementCostOverride';
import type {
	DeleteRequirementCommand,
	DeleteRequirementInput,
} from '../application/commands/requirement/DeleteRequirement';
import type { GetRequirementsForZone, RequirementInspectorDTO } from '../application/queries/GetRequirementsForZone';
import type { ListAssets } from '../application/queries/ListAssets';
import type {
	ListRequirementsReferencing,
	ReferencedTarget,
	ReferencingGroup,
} from '../application/queries/ListRequirementsReferencing';
import type { ListReassignmentTargets } from '../application/queries/ListReassignmentTargets';
import type { ReassignmentTargetDto } from '../application/queries/reassignmentTypes';
import type { ResolvedSequence } from '../application/reference/deleteResolution';
import type { Asset } from '../domain/asset/Asset';
import type { Requirement } from '../domain/requirement/Requirement';
import type { RequirementId } from '../domain/requirement/RequirementId';
import type { Project } from '../domain/project/Project';
import type { Plan } from '../domain/plan/Plan';
import type { Zone } from '../domain/zone/Zone';
import type { ZoneId } from '../domain/zone/ZoneId';
import type { PlanRepository } from '../application/ports/PlanRepository';
import type { ProjectRepository } from '../application/ports/ProjectRepository';
import type { ZoneRepository } from '../application/ports/ZoneRepository';
import type { VaultFileProbe } from '../application/ports/VaultFileProbe';
import type { EventBus } from '../core/events/EventBus';
import type { CalibratePlanTransaction } from '../presentation/editor/planEditorCommands';
import type { MigrationRunner } from '../infrastructure/persistence/migration/MigrationRunner';

/**
 * The Error Boundary's wiring (SDD §66), kept beside the composition root rather than in
 * it: every command and query a view or another layer consumes leaves the root wrapped by
 * `guardCommand`/`guardQuery`, so an unexpected fault below this seam arrives as a
 * resolved failed `Result` and never as a rejection past the application layer. The
 * repositories map the failures they EXPECT to coded errors; these wrappers catch what
 * escapes that net, and each service gets its OWN event name so a log line names the
 * boundary it crossed.
 *
 * Two things this file states rather than implies:
 *
 * - **Every guarded service is typed STRUCTURALLY** (`Command<I, Result<T, E>>`,
 *   `Query<…>`) and never as the concrete class. What leaves the root is a wrapper object
 *   with the same `execute`, so a field typed as the class would be a lie the compiler
 *   would then have to be argued out of.
 * - **Each guard call is a LOCAL `const` first.** Assigning one straight into a field of a
 *   declared return type gives it a contextual type, and `E` then infers from the TARGET
 *   rather than from the command — a widened union that mis-narrows at the call site.
 *   Computing the locals first means the argument is the only thing inference can read.
 */

/**
 * The ONE mapper every guard here wraps with. Stateless and a pure function of its scope,
 * so a second `createVaultExceptionMapper('vault')` elsewhere would behave identically —
 * which is exactly why it is stated once: two spellings of the same decision are two
 * places to change it, and `planEditorDeps` needs it as well as `composeGuarded` does.
 */
export const VAULT_EXCEPTION_MAPPER = createVaultExceptionMapper('vault');

/** The read side a view or command consumes; never a concrete repository or query class. */
export interface QueryServices {
	readonly getProject: Query<GetProjectInput, Result<Loaded<Project> | null, RepositoryError>>;
	readonly getPlan: Query<GetPlanInput, Result<Loaded<Plan> | null, RepositoryError>>;
	readonly getZone: Query<GetZoneInput, Result<Loaded<Zone> | null, RepositoryError>>;
	readonly findZonesByPlan: Query<FindZonesByPlanInput, Result<Loaded<Zone>[], RepositoryError>>;
	/** SDD §68's content-free snapshot — versions, schema versions, migration state, issues. */
	readonly diagnostics: Query<void, DiagnosticsSnapshot>;
}

/**
 * Slice 5's background write and slice 8's zone-editing trio, guarded. Spelled as an
 * interface so `PersistenceServices` can EXTEND it: the guaranteed shape and the guard
 * that produces it stay in one file, and a member added here cannot be forgotten there.
 */
export interface GuardedEditorServices {
	readonly setPlanBackground: Command<SetPlanBackgroundInput, Result<SetPlanBackgroundOutcome, SetPlanBackgroundError>>;
	readonly deleteZone: Command<DeleteZoneInput, Result<ResolvedSequence & { zoneId: ZoneId }, ReferenceError | RepositoryError>>;
	readonly moveZone: Command<MoveSpatialObjectInput, Result<MoveSpatialObjectResult, ReferenceError | GeometryError | RepositoryError>>;
	readonly zoneInspector: Query<GetZoneInspectorInput, Result<ZoneInspectorFields | null, RepositoryError | GeometryError>>;
	/**
	 * The Renovation Project view's own read side (design slice 14), guarded like every
	 * other door here (design slice 11) rather than composed raw. It used to leave the root
	 * as the bare `ListProjects` application class — a throw past the application layer that
	 * `tests/plugin/guardCategory.test.ts` was built to catch and did. Zero-argument, like
	 * `diagnostics` above: `guardQuery` presents it as `Query<void, …>` and a caller invokes
	 * it with no argument, same as every other zero-input query composed here.
	 *
	 * `renovationProjectDeps`'s call to `createRenovationProjectQueries` is still where this
	 * gets mapped into `ProjectSummaryDto` — that mapping happens one level down from the
	 * root, unlike `planEditorQueries`'s, and guarding it here does not change where.
	 */
	readonly listProjects: Query<void, Result<ProjectListResult, RepositoryError>>;
	/**
	 * Design slice 21's detail-state read, guarded like every other door here (design slice
	 * 11) rather than composed raw — a bare application class leaving the root is exactly what
	 * `tests/plugin/guardCategory.test.ts` was built to catch.
	 */
	readonly listPlansByProject: Query<ListPlansByProjectInput, Result<Plan[], RepositoryError>>;
}

/** Design slice 10's write and read side, guarded — the same seam, one slice later. */
export interface GuardedSlice10Services {
	readonly createAsset: Command<CreateAssetInput, Result<Asset, RepositoryError>>;
	readonly updateAsset: Command<UpdateAssetInput, Result<Asset, UpdateAssetErrors>>;
	readonly deleteAsset: Command<DeleteAssetInput, Result<ResolvedSequence, DeleteAssetErrors>>;
	readonly assignAsset: Command<AssignAssetInput, Result<AssignAssetResult, AssignAssetErrors>>;
	readonly recalculateRequirement: Command<RecalculateRequirementInput, Result<Requirement, RecalculateRequirementErrors>>;
	/**
	 * BOTH doors of each override command, each guarded on its own. `execute` is what a
	 * plain caller dispatches; `executeWithVersion` is what the Inspector's reversible
	 * adapters dispatch, and it is a second public entry point — so guarding `execute`
	 * alone would have wrapped the door nobody in this app actually uses and left the
	 * other one throwing past the application layer.
	 */
	readonly setRequirementQuantityOverride: Command<SetRequirementQuantityOverrideInput, Result<Requirement, SetOverrideErrors>> &
		SetRequirementQuantityOverrideDoor;
	readonly setRequirementCostOverride: Command<SetRequirementCostOverrideInput, Result<Requirement, SetOverrideErrors>> &
		SetRequirementCostOverrideDoor;
	readonly deleteRequirement: Command<DeleteRequirementInput, Result<{ requirementId: RequirementId }, ReferenceError | RepositoryError>>;
	/** Slice 10's read side, beside the zone inspector query — guarded member by member. */
	readonly requirementQueries: {
		readonly getRequirementsForZone: Query<ZoneId, Result<readonly RequirementInspectorDTO[], RepositoryError>>;
		readonly listAssets: Query<void, Result<readonly Asset[], RepositoryError>>;
		readonly listRequirementsReferencing: Query<ReferencedTarget, Result<readonly ReferencingGroup[], RepositoryError>>;
		readonly listReassignmentTargets: Query<ReferencedTarget, Result<readonly ReassignmentTargetDto[], RepositoryError>>;
	};
}

/**
 * The asset designer's write and read side, guarded — the same seam two increments later
 * (design slice A9).
 *
 * ONE BUNDLE rather than seven top-level members, because these seven are the whole surface
 * of one thing: a designer view is handed `assetDesign` and reaches every door of the design
 * from it, the way the Plan Editor is handed `requirementQueries`. The alternative spreads
 * the group's membership across `PersistenceServices` and leaves the next command that
 * belongs to it deciding for itself where to go.
 *
 * `get` rather than `getAssetDesign`: the bundle already says which entity, and a member
 * repeating its own bundle's name reads as a second group inside the first one.
 */
export interface GuardedAssetDesignServices {
	readonly assetDesign: {
		readonly setFootprint: GuardedDesignCommand<SetAssetFootprintInput>;
		readonly setFootprintFromDimensions: GuardedDesignCommand<SetAssetFootprintFromDimensionsInput>;
		readonly setClearance: GuardedDesignCommand<SetAssetClearanceInput>;
		readonly setAnchor: GuardedDesignCommand<SetAssetAnchorInput>;
		readonly setFacing: GuardedDesignCommand<SetAssetFacingInput>;
		readonly setHeight: GuardedDesignCommand<SetAssetHeightInput>;
		readonly get: Query<AssetId, Result<AssetDesignDto, AssetDesignError>>;
	};
}

/**
 * A design command as it leaves the root: BOTH doors, each guarded on its own.
 *
 * `executeWithVersion` is what `ReversibleAssetDesignCommands` dispatches — it must, because
 * rediscovering the version with a second read is a window a peer can land in — and a guard
 * on the door nobody dispatches through is a guard nobody has. Declared as one type rather
 * than spelled at six members so a seventh design command cannot arrive carrying one door.
 */
export interface GuardedDesignCommand<TInput>
	extends Command<TInput, DispatchResult>,
		VersionedDesignCommand<TInput> {}

/**
 * The slice-10 commands and queries as `composeSlice10` builds them — concrete classes,
 * one composition, before anything wraps them.
 *
 * `recalculate` is deliberately NOT here: the root also hands it, unguarded, to
 * `DeleteAssetCommand` and to the two cascade handlers. Those uses are INSIDE the
 * application layer and are not the boundary — the guard exists so nothing throws past
 * that layer, not so nothing throws within it — so they take the command itself and only
 * the copy leaving through `PersistenceServices` is wrapped.
 */
export interface UnguardedSlice10Services {
	readonly createAsset: CreateAssetCommand;
	readonly updateAsset: UpdateAssetCommand;
	readonly deleteAsset: DeleteAssetCommand;
	readonly assignAsset: AssignAssetCommand;
	readonly setRequirementQuantityOverride: SetRequirementQuantityOverrideCommand;
	readonly setRequirementCostOverride: SetRequirementCostOverrideCommand;
	readonly deleteRequirement: DeleteRequirementCommand;
	readonly queries: {
		readonly getRequirementsForZone: GetRequirementsForZone;
		readonly listAssets: ListAssets;
		readonly listRequirementsReferencing: ListRequirementsReferencing;
		readonly listReassignmentTargets: ListReassignmentTargets;
	};
}

export function guardedEditorServices(
	repositories: {
		projects: ProjectRepository;
		plans: PlanRepository;
		zones: ZoneRepository;
		deleteZone: DeleteZoneCommand;
	},
	deps: {
		eventBus: EventBus;
		files: VaultFileProbe;
		logger: Logger;
		map: VaultExceptionMapper;
		/**
		 * §83's third site, which has no door to refuse at (ADR-0013 derives a project's
		 * folder from where its note sits). `ListProjects` answers it beside the list rather
		 * than a second query answering it separately — one read, one failure mode.
		 */
		overlaps: LibraryOverlaps;
	},
	diagnosticsSources: {
		versions: RuntimeVersions;
		migrations: MigrationRunner;
		ledger: DiagnosticsLedger;
	},
): { queries: QueryServices } & GuardedEditorServices {
	const { projects, plans, zones } = repositories;
	const { eventBus, files, logger, map, overlaps } = deps;

	const getProject = guardQuery(new GetProject(projects), 'query.getProject.failed', logger, map);
	const getPlan = guardQuery(new GetPlan(plans), 'query.getPlan.failed', logger, map);
	const getZone = guardQuery(new GetZone(zones), 'query.getZone.failed', logger, map);
	const findZonesByPlan = guardQuery(new FindZonesByPlan(zones), 'query.findZonesByPlan.failed', logger, map);
	const diagnostics = new GetDiagnosticsSnapshotQuery({
		versions: diagnosticsSources.versions,
		latestSchemaVersions: () => diagnosticsSources.migrations.latestVersions,
		lastAppliedMigration: () => diagnosticsSources.migrations.lastApplied,
		ledger: diagnosticsSources.ledger,
	});

	const setPlanBackground = guardCommand(
		new SetPlanBackgroundCommand(plans, files, eventBus),
		'command.setPlanBackground.failed',
		logger,
		map,
	);
	const deleteZone = guardCommand(repositories.deleteZone, 'command.deleteZone.failed', logger, map);
	// The one call here that needs its type arguments SPELLED: `MoveSpatialObjectCommand`'s
	// own union is wider than what inference reads off its `implements` clause, and left
	// alone `E` comes back as `GeometryError` alone.
	const moveZone = guardCommand<MoveSpatialObjectInput, MoveSpatialObjectResult, ReferenceError | GeometryError | RepositoryError>(
		new MoveSpatialObjectCommand(zones, eventBus),
		'command.moveZone.failed',
		logger,
		map,
	);
	const zoneInspector = guardQuery(new GetZoneInspector(zones), 'query.zoneInspector.failed', logger, map);
	const listProjects = guardQuery(new ListProjects(projects, overlaps), 'query.listProjects.failed', logger, map);
	const listPlansByProject = guardQuery(new ListPlansByProject(plans), 'query.listPlansByProject.failed', logger, map);

	return {
		queries: { getProject, getPlan, getZone, findZonesByPlan, diagnostics },
		setPlanBackground,
		deleteZone,
		moveZone,
		zoneInspector,
		listProjects,
		listPlansByProject,
	};
}

/**
 * A two-door command's doors, guarded separately so each names its own boundary in
 * the log. A single event for both would make "which entry point faulted" unanswerable
 * from a log line, and the two are reached by different callers.
 *
 * `TPlain` is a type parameter rather than `Requirement`: the two override commands were the
 * only callers when this was written, and the six asset design commands answer a
 * `DispatchOutcome` at their plain door. Widening it is what let them use this function
 * instead of a second one shaped the same way.
 */
function guardBothDoors<TInput, TPlain, TVersioned, E extends AppError>(
	command: {
		execute(input: TInput): Promise<Result<TPlain, E>>;
		executeWithVersion(input: TInput): Promise<Result<TVersioned, E>>;
	},
	events: { readonly execute: string; readonly executeWithVersion: string },
	logger: Logger,
	map: VaultExceptionMapper,
): {
	execute(input: TInput): Promise<Result<TPlain, E | PersistenceError>>;
	executeWithVersion(input: TInput): Promise<Result<TVersioned, E | PersistenceError>>;
} {
	// Both doors are called THROUGH their wrapper rather than lifted off it: a bare
	// `….execute` is an unbound method, which `@typescript-eslint/unbound-method` refuses
	// on principle and which would break the day `guardCommand` returns a class.
	const guardedExecute = guardCommand(command, events.execute, logger, map);
	const guardedVersioned = guardCommand(
		{ execute: (input: TInput) => command.executeWithVersion(input) },
		events.executeWithVersion,
		logger,
		map,
	);
	// BOTH doors route through a wrapper. `tests/plugin/guardCategory.test.ts` drives a
	// fault through every door this facade exposes and requires the mapped refusal back,
	// which is what makes "the guard is on the door the app dispatches through" checkable
	// rather than asserted here.
	return {
		execute: (input: TInput) => guardedExecute.execute(input),
		executeWithVersion: (input: TInput) => guardedVersioned.execute(input),
	};
}

/**
 * Slice 10's half of the same seam. Separate from `guardedEditorServices` only because one
 * function holding both would outgrow the size budget every function here shares — the
 * rule is identical and there is exactly one of it.
 */
export function guardSlice10(
	slice10: UnguardedSlice10Services,
	recalculate: RecalculateRequirementCommand,
	logger: Logger,
	map: VaultExceptionMapper,
): GuardedSlice10Services {
	const createAsset = guardCommand(slice10.createAsset, 'command.createAsset.failed', logger, map);
	const updateAsset = guardCommand(slice10.updateAsset, 'command.updateAsset.failed', logger, map);
	const deleteAsset = guardCommand(slice10.deleteAsset, 'command.deleteAsset.failed', logger, map);
	const assignAsset = guardCommand(slice10.assignAsset, 'command.assignAsset.failed', logger, map);
	const recalculateRequirement = guardCommand(recalculate, 'command.recalculateRequirement.failed', logger, map);
	const setRequirementQuantityOverride = guardBothDoors(
		slice10.setRequirementQuantityOverride,
		{
			execute: 'command.setRequirementQuantityOverride.failed',
			executeWithVersion: 'command.setRequirementQuantityOverride.with-version.failed',
		},
		logger,
		map,
	);
	const setRequirementCostOverride = guardBothDoors(
		slice10.setRequirementCostOverride,
		{
			execute: 'command.setRequirementCostOverride.failed',
			executeWithVersion: 'command.setRequirementCostOverride.with-version.failed',
		},
		logger,
		map,
	);
	const deleteRequirement = guardCommand(slice10.deleteRequirement, 'command.deleteRequirement.failed', logger, map);

	const q = slice10.queries;
	const requirementQueries = {
		getRequirementsForZone: guardQuery(q.getRequirementsForZone, 'query.getRequirementsForZone.failed', logger, map),
		listAssets: guardQuery(q.listAssets, 'query.listAssets.failed', logger, map),
		listRequirementsReferencing: guardQuery(
			q.listRequirementsReferencing,
			'query.listRequirementsReferencing.failed',
			logger,
			map,
		),
		listReassignmentTargets: guardQuery(q.listReassignmentTargets, 'query.listReassignmentTargets.failed', logger, map),
	};

	return {
		createAsset,
		updateAsset,
		deleteAsset,
		assignAsset,
		recalculateRequirement,
		setRequirementQuantityOverride,
		setRequirementCostOverride,
		deleteRequirement,
		requirementQueries,
	};
}

/**
 * One event name per DOOR of a design command, derived from the command's own so the pair
 * reads as a pair in a log. Module scope rather than a local, because it captures nothing.
 */
function designDoors(name: string): { readonly execute: string; readonly executeWithVersion: string } {
	return {
		execute: `command.${name}.failed`,
		executeWithVersion: `command.${name}.with-version.failed`,
	};
}

/**
 * The asset designer's half of the same seam, composed and guarded in one place — the shape
 * `guardedEditorServices` takes rather than `guardSlice10`'s, because nothing above this
 * function needs the unguarded commands: `composeSlice10` exists to hand `recalculate` and
 * the delete sequence their raw collaborators INSIDE the application layer, and no design
 * command is dispatched from in there.
 *
 * **`guardBothDoors`, because the day this paragraph predicted has arrived.** It used to read
 * "`guardCommand` and not `guardBothDoors`, measured rather than assumed", on the true
 * observation that all six design commands exposed exactly one entry point — and it named the
 * trigger: "the day one of them dispatches through an `executeWithVersion`, guarding
 * `execute` alone would wrap the door nobody uses". `ReversibleAssetDesignCommands` dispatches
 * through exactly that door now, so both are wrapped, each under its own event name so a log
 * line says which entry point faulted. `tests/plugin/guardCategory.test.ts` drives every door
 * of everything the root hands out, which is what catches the next one rather than anybody
 * remembering this paragraph — and it is what would have caught this had the trigger fired
 * without the prediction being re-read.
 *
 * One `AssetShapeDeps` rather than three parameters, because that is already the shape the
 * five geometry commands take and the other two are built from its members: re-spelling it
 * here would be a second statement of what a design command needs.
 */
export function guardAssetDesign(
	deps: AssetShapeDeps,
	logger: Logger,
	map: VaultExceptionMapper,
): GuardedAssetDesignServices {
	const { sidecar, assets, events } = deps;
	const setFootprint = guardBothDoors(new SetAssetFootprintCommand(deps), designDoors('setAssetFootprint'), logger, map);
	const setFootprintFromDimensions = guardBothDoors(
		new SetAssetFootprintFromDimensionsCommand(deps),
		designDoors('setAssetFootprintFromDimensions'),
		logger,
		map,
	);
	const setClearance = guardBothDoors(new SetAssetClearanceCommand(deps), designDoors('setAssetClearance'), logger, map);
	const setAnchor = guardBothDoors(new SetAssetAnchorCommand(deps), designDoors('setAssetAnchor'), logger, map);
	const setFacing = guardBothDoors(new SetAssetFacingCommand(deps), designDoors('setAssetFacing'), logger, map);
	const setHeight = guardBothDoors(
		new SetAssetHeightCommand(assets, events),
		designDoors('setAssetHeight'),
		logger,
		map,
	);
	const get = guardQuery(new GetAssetDesignQuery(assets, sidecar), 'query.getAssetDesign.failed', logger, map);

	return {
		assetDesign: { setFootprint, setFootprintFromDimensions, setClearance, setAnchor, setFacing, setHeight, get },
	};
}

/**
 * The calibration transaction, guarded on BOTH halves.
 *
 * It is not a `Command` and never leaves the root through `PersistenceServices`: the
 * editor is handed a FACTORY, because each gesture needs its own inverse state. That made
 * it the one command in the app that presentation held raw — and the tool's dispatch path
 * has no `.catch`, so a throw inside it was an unhandled rejection rather than a refusal.
 * `CalibratePlanTransaction` is already a structural interface, so the wrapper satisfies it
 * without the command class having to change.
 *
 * `undo()` takes no input, so it is presented to the guard as a `Command` over `void` —
 * the guard cares about the shape of the call, not about who supplies the argument.
 */
export function guardCalibratePlan(
	transaction: CalibratePlanTransaction,
	logger: Logger,
	map: VaultExceptionMapper,
): CalibratePlanTransaction {
	const guardedUndo = guardCommand(
		{ execute: () => transaction.undo() },
		'command.calibratePlan.undo.failed',
		logger,
		map,
	);
	const guardedExecute = guardCommand(transaction, 'command.calibratePlan.failed', logger, map);
	return {
		execute: (input) => guardedExecute.execute(input),
		undo: () => guardedUndo.execute(undefined),
	};
}
