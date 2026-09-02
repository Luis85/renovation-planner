import { err, type Result } from '../../core/result/Result';
import { createEventBus } from '../../core/events/EventBus';
import type {
	CalculationError,
	GeometryError,
	PersistenceError,
	ReferenceError,
} from '../../core/errors/AppError';
import type { Command } from '../../application/commands/Command';
import type { DispatchOutcome } from '../../application/commands/DispatchOutcome';
import type { Query } from '../../application/queries/Query';
import type { CalibratePlanInput } from '../../application/commands/plan/ReversibleCalibratePlan';
import type { CreateZoneInput } from '../../application/commands/zone/CreateZone';
import type { MoveSpatialObjectInput, MoveSpatialObjectResult } from '../../application/commands/zone/MoveSpatialObject';
import type { DeleteZoneInput } from '../../application/commands/zone/DeleteZone';
import type { GetZoneInspectorInput, ZoneInspectorFields } from '../../application/queries/GetZoneInspector';
import { AssignAssetCommand } from '../../application/commands/requirement/AssignAsset';
import type {
	AssignAssetInput,
	AssignAssetResult,
	AssignAssetErrors,
} from '../../application/commands/requirement/AssignAsset';
import { SetRequirementQuantityOverrideCommand } from '../../application/commands/requirement/SetRequirementQuantityOverride';
import type { SetRequirementQuantityOverrideDoor } from '../../application/commands/requirement/SetRequirementQuantityOverride';
import { SetRequirementCostOverrideCommand } from '../../application/commands/requirement/SetRequirementCostOverride';
import type { SetRequirementCostOverrideDoor } from '../../application/commands/requirement/SetRequirementCostOverride';
import { ReferenceLocks } from '../../application/reference/ReferenceLocks';
import type { RepositoryError } from '../../application/ports/repositoryErrors';
import type { Loaded } from '../../application/ports/versioning';
import type { Logger } from '../../application/ports/Logger';
import type { ResolvedSequence } from '../../application/reference/deleteResolution';
import type { ZoneRepository } from '../../application/ports/ZoneRepository';
import type { RequirementRepository } from '../../application/ports/RequirementRepository';
import type { AssetRepository } from '../../application/ports/AssetRepository';
import type { Zone } from '../../domain/zone/Zone';
import type { ZoneId } from '../../domain/zone/ZoneId';

/**
 * The reversible calibration, as the editor consumes it. A STRUCTURAL type rather than the
 * concrete `ReversibleCalibratePlanCommand`, so `unavailablePlanEditorCommands` can answer
 * the refusal shape without constructing a real command around refusing ports.
 */
export interface CalibratePlanTransaction {
	execute(
		input: CalibratePlanInput,
	): Promise<Result<DispatchOutcome, ReferenceError | CalculationError | RepositoryError>>;
	undo(): Promise<Result<DispatchOutcome, RepositoryError>>;
}

/**
 * The write side (and the Inspector's read side) of the Plan Editor, as slice 8 consumes
 * them. The mirror of `PlanEditorQueryServices`: application-layer interfaces handed to
 * presentation, composed at the root, never a repository the view built.
 *
 * The reversible ADAPTERS (`ReversibleCreateZoneCommand` & co.) are deliberately absent:
 * each holds one transaction's snapshot, so tools construct one PER GESTURE out of these
 * shared, stateless collaborators plus their history's `WriteLedger`. What crosses this
 * boundary is exactly what has no per-transaction state.
 */
export interface PlanEditorCommandServices {
	readonly createZone: Command<
		CreateZoneInput,
		Result<{ zone: Loaded<Zone> }, ReferenceError | GeometryError | RepositoryError>
	>;
	readonly moveObject: Command<
		MoveSpatialObjectInput,
		Result<MoveSpatialObjectResult, ReferenceError | GeometryError | RepositoryError>
	>;
	/**
	 * Slice 10's reference-aware delete: the payload carries what the resolution touched
	 * (`affectedBefore`) and the expectation each of its writes left (`affectedAfter`), which
	 * is what the reversible adapter's compensated undo restores from.
	 */
	readonly deleteZone: Command<
		DeleteZoneInput,
		Result<ResolvedSequence & { zoneId: ZoneId }, ReferenceError | RepositoryError>
	>;
	/**
	 * The repository PORT, not a concrete type — the two restore halves of the create and
	 * delete adapters read their snapshots through it and write their restores back into
	 * it. Presentation holding a port is the same bargain `PlanEditorQueryServices` makes;
	 * only `infrastructure/` knows what stands behind it.
	 */
	readonly zones: ZoneRepository;
	/** The Inspector query (SDD §59), beside the commands it shares a selection with. */
	readonly zoneInspector: Query<
		GetZoneInspectorInput,
		Result<ZoneInspectorFields | null, RepositoryError | GeometryError>
	>;
	/**
	 * A FACTORY, unlike every other member here, and the exception is the rule this
	 * interface's header already states: what crosses this boundary is exactly what has no
	 * per-transaction state. `ReversibleCalibratePlanCommand` holds one gesture's inverse,
	 * so the editor gets the means to make one per gesture rather than a shared instance
	 * two overlapping gestures would fight over.
	 */
	readonly calibratePlan: () => CalibratePlanTransaction;
	/**
	 * Design slice 10's Requirements panel: the shared, stateless collaborators the
	 * Inspector's reversible adapters are constructed from PER EDIT — the same bargain the
	 * header states for `calibratePlan`, one seam over. The repository ports and the lock
	 * set cross because the adapters' undo halves restore through them; presentation holds
	 * ports, never concrete repositories.
	 */
	readonly requirementEdits: {
		/**
		 * STRUCTURAL, like every other command on this interface, and for the reason this
		 * interface already gives: what leaves the composition root is a GUARDED wrapper
		 * with the same doors, never the class. These three named their concrete classes
		 * until round 1 of slice 11's review, and that nominal spelling was the only thing
		 * keeping them outside the Error Boundary.
		 */
		readonly assignAsset: Command<AssignAssetInput, Result<AssignAssetResult, AssignAssetErrors>>;
		readonly setQuantityOverride: SetRequirementQuantityOverrideDoor;
		readonly setCostOverride: SetRequirementCostOverrideDoor;
		readonly requirements: RequirementRepository;
		readonly assets: AssetRepository;
		readonly locks: ReferenceLocks;
	};
	/**
	 * The composition root's logger, reaching the leaf.
	 *
	 * Presentation has no logger of ITS own and this changes nothing about that: what
	 * crosses is the same `Logger` port the application layer takes, composed at the root
	 * like every other member here. THREE things need it, and each is the developer half of
	 * an error the user is already being shown:
	 *
	 * - a compensation that ALSO failed inside a reversible adapter's undo. The undo halves
	 *   return their ORIGINAL failure to the caller, so a second fault has nowhere else to
	 *   be recorded.
	 * - `notifyFault`, at the two doors in `runtime.ts` that catch a throw from one of the
	 *   RAW repository ports above. Those ports are outside the Error Boundary by design,
	 *   so no guard logged the cause on its way here — and SDD §66's two representations
	 *   are only produced together if this door produces both, which is why `notifyFault`
	 *   takes this and maps once for both halves.
	 * - `RequirementRow`'s two `useFieldCommit` override fields (design slice 16), reached
	 *   through `InspectorPanel` as a prop. A coalesced round's own continuation rejects with
	 *   nobody holding that promise, so `faultError` there is likewise the only step where the
	 *   cause can be recorded at all — the same argument as `notifyFault`'s, one door over.
	 *
	 * It sits at the top level rather than inside `requirementEdits` because it is now the
	 * LEAF's logger rather than that bundle's: two unrelated callers reaching into a
	 * sibling's bundle for it was the shape that made the second one easy to forget.
	 */
	readonly logger: Logger;
}

type CreateZoneResult = Awaited<ReturnType<PlanEditorCommandServices['createZone']['execute']>>;
type MoveObjectResult = Awaited<ReturnType<PlanEditorCommandServices['moveObject']['execute']>>;
type DeleteZoneResult = Awaited<ReturnType<PlanEditorCommandServices['deleteZone']['execute']>>;
type ZoneInspectorResult = Awaited<ReturnType<PlanEditorCommandServices['zoneInspector']['execute']>>;
type CalibratePlanExecuteResult = Awaited<ReturnType<CalibratePlanTransaction['execute']>>;
type CalibratePlanUndoResult = Awaited<ReturnType<CalibratePlanTransaction['undo']>>;

/**
 * The write side for a session whose settings could not be recovered — the same refusal
 * shape `unavailablePlanEditorQueries` gives the read side. Every gesture resolves a
 * failed `Result` rather than throwing where the caller checks one, so the editor stays
 * mounted and its failure surfaces through the same path any other failed write takes.
 */
function persistenceFailure(): PersistenceError {
	return {
		category: 'Persistence',
		code: 'settings.unrecovered',
		message: 'Settings could not be read, so nothing can be written.',
	};
}

/**
 * A port whose every method refuses with `settings.unrecovered`. One proxy instead of
 * twelve hand-written object methods: each property access answers a function resolving
 * the same failed `Result`, so a member this version does not even know about refuses
 * too rather than answering `undefined`.
 */
function noop(): void {
	// A logger member that records nothing — see `requirementEdits.logger` below.
}

function refusingPort<T>(): T {
	return new Proxy({}, {
		get: () => () => Promise.resolve(err(persistenceFailure())),
	}) as T;
}

export function unavailablePlanEditorCommands(): PlanEditorCommandServices {
	const locks = new ReferenceLocks();
	// Real command classes over the refusing ports: their constructors are the type the
	// adapters take, and every read and write inside them refuses with the SAME
	// `settings.unrecovered` shape, so a gesture that reaches one fails exactly like any
	// other write in an unrecovered session.
	const events = createEventBus(() => undefined);

	return {
		createZone: {
			execute(): Promise<CreateZoneResult> {
				return Promise.resolve(err(persistenceFailure()) as CreateZoneResult);
			},
		},
		moveObject: {
			execute(): Promise<MoveObjectResult> {
				return Promise.resolve(err(persistenceFailure()) as MoveObjectResult);
			},
		},
		deleteZone: {
			execute(): Promise<DeleteZoneResult> {
				return Promise.resolve(err(persistenceFailure()) as DeleteZoneResult);
			},
		},
		zones: refusingPort(),
		zoneInspector: {
			execute(): Promise<ZoneInspectorResult> {
				return Promise.resolve(err(persistenceFailure()) as ZoneInspectorResult);
			},
		},
		calibratePlan: () => ({
			execute(): Promise<CalibratePlanExecuteResult> {
				return Promise.resolve(err(persistenceFailure()) as CalibratePlanExecuteResult);
			},
			undo(): Promise<CalibratePlanUndoResult> {
				return Promise.resolve(err(persistenceFailure()) as CalibratePlanUndoResult);
			},
		}),
		requirementEdits: {
			assignAsset: new AssignAssetCommand({
				zones: refusingPort(),
				assets: refusingPort(),
				requirements: refusingPort(),
				events,
				locks,
				projects: refusingPort(),
				overrides: refusingPort(),
			}),
			setQuantityOverride: new SetRequirementQuantityOverrideCommand(refusingPort(), events, locks),
			setCostOverride: new SetRequirementCostOverrideCommand(refusingPort(), events, locks),
			requirements: refusingPort(),
			assets: refusingPort(),
			locks,
		},
		// Nothing can reach a compensation or a raw-port fault in a session with no
		// repositories — every port here REFUSES rather than throwing — so the sink is the
		// honest shape: a console writer would be a log line about a fault that cannot occur.
		logger: { debug: noop, info: noop, warn: noop, error: noop },
	};
}
