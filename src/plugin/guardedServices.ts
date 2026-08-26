import type { Result } from '../core/result/Result';
import type { GeometryError, ReferenceError } from '../core/errors/AppError';
import type { Command } from '../application/commands/Command';
import type { Query } from '../application/queries/Query';
import type { Logger } from '../application/ports/Logger';
import type { Loaded } from '../application/ports/versioning';
import type { RepositoryError } from '../application/ports/repositoryErrors';
import type { DiagnosticsLedger, RuntimeVersions } from '../application/ports/diagnostics';
import type { VaultExceptionMapper } from '../application/errors/exceptionMapper';
import { guardCommand, guardQuery } from '../application/errors/guardAgainstThrowing';
import { GetDiagnosticsSnapshotQuery, type DiagnosticsSnapshot } from '../application/queries/GetDiagnosticsSnapshot';
import { GetProject, type GetProjectInput } from '../application/queries/GetProject';
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
import { MoveSpatialObjectCommand, type MoveSpatialObjectInput } from '../application/commands/zone/MoveSpatialObject';
import type { CreateAssetCommand, CreateAssetInput } from '../application/commands/asset/CreateAsset';
import type { UpdateAssetCommand, UpdateAssetInput, UpdateAssetErrors } from '../application/commands/asset/UpdateAsset';
import type { DeleteAssetCommand, DeleteAssetInput, DeleteAssetErrors } from '../application/commands/asset/DeleteAsset';
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
	SetRequirementQuantityOverrideInput,
	SetOverrideErrors,
} from '../application/commands/requirement/SetRequirementQuantityOverride';
import type {
	SetRequirementCostOverrideCommand,
	SetRequirementCostOverrideInput,
} from '../application/commands/requirement/SetRequirementCostOverride';
import type {
	DeleteRequirementCommand,
	DeleteRequirementInput,
} from '../application/commands/requirement/DeleteRequirement';
import type { GetRequirementsForZone, RequirementInspectorDTO } from '../application/queries/GetRequirementsForZone';
import type { ListAssets } from '../application/queries/ListAssets';
import type { ListRequirementsReferencing, ReferencedTarget } from '../application/queries/ListRequirementsReferencing';
import type { ListReassignmentTargets } from '../application/queries/ListReassignmentTargets';
import type { ReassignmentTargetDto } from '../application/queries/reassignmentTypes';
import type { ResolvedSequence } from '../application/reference/deleteResolution';
import type { Asset } from '../domain/asset/Asset';
import type { Requirement } from '../domain/requirement/Requirement';
import type { RequirementId } from '../domain/requirement/RequirementId';
import type { ProjectId } from '../domain/project/ProjectId';
import type { Project } from '../domain/project/Project';
import type { Plan } from '../domain/plan/Plan';
import type { Zone } from '../domain/zone/Zone';
import type { ZoneId } from '../domain/zone/ZoneId';
import type { PlanRepository } from '../application/ports/PlanRepository';
import type { ProjectRepository } from '../application/ports/ProjectRepository';
import type { ZoneRepository } from '../application/ports/ZoneRepository';
import type { VaultFileProbe } from '../application/ports/VaultFileProbe';
import type { EventBus } from '../core/events/EventBus';
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
	readonly moveZone: Command<MoveSpatialObjectInput, Result<{ zone: Loaded<Zone> }, ReferenceError | GeometryError | RepositoryError>>;
	readonly zoneInspector: Query<GetZoneInspectorInput, Result<ZoneInspectorFields | null, RepositoryError | GeometryError>>;
}

/** Design slice 10's write and read side, guarded — the same seam, one slice later. */
export interface GuardedSlice10Services {
	readonly createAsset: Command<CreateAssetInput, Result<Asset, RepositoryError>>;
	readonly updateAsset: Command<UpdateAssetInput, Result<Asset, UpdateAssetErrors>>;
	readonly deleteAsset: Command<DeleteAssetInput, Result<ResolvedSequence, DeleteAssetErrors>>;
	readonly assignAsset: Command<AssignAssetInput, Result<AssignAssetResult, AssignAssetErrors>>;
	readonly recalculateRequirement: Command<RecalculateRequirementInput, Result<Requirement, RecalculateRequirementErrors>>;
	readonly setRequirementQuantityOverride: Command<SetRequirementQuantityOverrideInput, Result<Requirement, SetOverrideErrors>>;
	readonly setRequirementCostOverride: Command<SetRequirementCostOverrideInput, Result<Requirement, SetOverrideErrors>>;
	readonly deleteRequirement: Command<DeleteRequirementInput, Result<{ requirementId: RequirementId }, ReferenceError | RepositoryError>>;
	/** Slice 10's read side, beside the zone inspector query — guarded member by member. */
	readonly requirementQueries: {
		readonly getRequirementsForZone: Query<ZoneId, Result<readonly RequirementInspectorDTO[], RepositoryError>>;
		readonly listAssets: Query<ProjectId, Result<readonly Asset[], RepositoryError>>;
		readonly listRequirementsReferencing: Query<ReferencedTarget, Result<readonly RequirementId[], RepositoryError>>;
		readonly listReassignmentTargets: Query<ReferencedTarget, Result<readonly ReassignmentTargetDto[], RepositoryError>>;
	};
}

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
	},
	diagnosticsSources: {
		versions: RuntimeVersions;
		migrations: MigrationRunner;
		ledger: DiagnosticsLedger;
	},
): { queries: QueryServices } & GuardedEditorServices {
	const { projects, plans, zones } = repositories;
	const { eventBus, files, logger, map } = deps;

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
	const moveZone = guardCommand<MoveSpatialObjectInput, { zone: Loaded<Zone> }, ReferenceError | GeometryError | RepositoryError>(
		new MoveSpatialObjectCommand(zones, eventBus),
		'command.moveZone.failed',
		logger,
		map,
	);
	const zoneInspector = guardQuery(new GetZoneInspector(zones), 'query.zoneInspector.failed', logger, map);

	return {
		queries: { getProject, getPlan, getZone, findZonesByPlan, diagnostics },
		setPlanBackground,
		deleteZone,
		moveZone,
		zoneInspector,
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
	const setRequirementQuantityOverride = guardCommand(
		slice10.setRequirementQuantityOverride,
		'command.setRequirementQuantityOverride.failed',
		logger,
		map,
	);
	const setRequirementCostOverride = guardCommand(
		slice10.setRequirementCostOverride,
		'command.setRequirementCostOverride.failed',
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
